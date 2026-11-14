import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Script } from 'node:vm';
import { readArchive, changeArchive, packedFile, archiveFingerprint } from './archive.js';

const assetsDirectory = path.dirname(fileURLToPath(import.meta.url));
const start = '/* ANTIGRAVITY RTL PATCH */';
const end = '/* END ANTIGRAVITY RTL PATCH */';
const anchor = 'void win.loadURL(url);';
const block = /\/\* ANTIGRAVITY RTL PATCH \*\/[\s\S]*?\/\* END ANTIGRAVITY RTL PATCH \*\//g;
const assets = {
    'dist/antigravity-rtl-runtime.cjs': 'runtime.cjs',
    'dist/antigravity-rtl-client.js': 'client.js',
    'dist/Vazirmatn-Variable.woff2': 'Vazirmatn-Variable.woff2'
};
const ignored = new Set(['dist/utils.js', ...Object.keys(assets)]);
const hash = data => createHash('sha256').update(data).digest('hex');

export function resolveAppAsarPath(inputPath) {
    if (!inputPath) return null;
    const absolute = path.resolve(inputPath);
    for (const candidate of [absolute, path.join(absolute, 'app.asar'), path.join(absolute, 'resources', 'app.asar'), path.join(absolute, 'Contents', 'Resources', 'app.asar')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && path.basename(candidate) === 'app.asar') return fs.realpathSync(candidate);
    }
    return null;
}

function candidates() {
    if (process.platform === 'darwin') return ['/Applications/Antigravity.app', path.join(os.homedir(), 'Applications', 'Antigravity.app')];
    if (process.platform === 'win32') {
        return [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Antigravity'), process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Antigravity'), process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Antigravity')].filter(Boolean);
    }
    return ['/opt/Antigravity', '/opt/antigravity', '/usr/share/antigravity', path.join(os.homedir(), '.local', 'share', 'antigravity')];
}

export function detectAppAsarPath() {
    return candidates().map(resolveAppAsarPath).find(Boolean) || null;
}

export async function getAppAsarPath() {
    const found = detectAppAsarPath();
    if (!found) throw new Error('Antigravity App was not found. Pass --path with the installation directory or app.asar.');
    return found;
}

export function hasAppBackup(inputPath) {
    const archive = resolveAppAsarPath(inputPath);
    return Boolean(archive && ['.rtl-bak', '.bak'].some(suffix => fs.existsSync(archive + suffix)));
}

function inspectArchive(buffer) {
    const archive = readArchive(buffer);
    const metadata = JSON.parse(packedFile(archive, 'package.json').toString('utf8'));
    if (!/antigravity/i.test(metadata.name || '') || typeof metadata.version !== 'string') throw new Error('This ASAR is not a recognized Antigravity application.');
    const utils = packedFile(archive, 'dist/utils.js').toString('utf8');
    return { archive, metadata, utils, patched: utils.includes(start) };
}

function assertPatchable(utils) {
    if (utils.split(anchor).length !== 2) throw new Error('Expected one supported window-loading hook in dist/utils.js. This Antigravity build needs a compatibility update.');
    new Script(utils, { filename: 'dist/utils.js' });
}

function cleanUtils(utils) {
    const matches = [...utils.matchAll(block)];
    if (matches.length !== 1) throw new Error('The existing RTL patch has no unique closing marker. Restore its original backup before updating.');
    return utils.replace(block, anchor);
}

function equivalentUtils(left, right) {
    // Earlier versions add indentation around the injected block.
    return left.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n') === right.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n');
}

function findBackup(archivePath, current) {
    for (const suffix of ['.rtl-bak', '.bak']) {
        const filename = archivePath + suffix;
        if (!fs.existsSync(filename)) continue;
        try {
            const data = fs.readFileSync(filename);
            const original = inspectArchive(data);
            if (original.patched || original.metadata.version !== current.metadata.version) continue;
            const cleaned = cleanUtils(current.utils);
            const legacyDevtools = original.utils.replace(/devTools:\s*!electron_1?\.app\.isPackaged/g, 'devTools: true');
            const matchesLegacy = !current.utils.includes('antigravity-rtl-runtime.cjs') && equivalentUtils(cleaned, legacyDevtools);
            if (!equivalentUtils(cleaned, original.utils) && !matchesLegacy) continue;
            if (archiveFingerprint(current.archive, ignored) !== archiveFingerprint(original.archive, ignored)) continue;
            return data;
        } catch { /* A different backup may still match this installation. */ }
    }
    return null;
}

function integrityEnabled(archivePath) {
    const resources = path.dirname(archivePath);
    const appRoot = path.dirname(resources);
    const executables = [path.join(appRoot, 'Antigravity.exe'), path.join(appRoot, 'antigravity'), path.join(appRoot, 'Antigravity'), path.join(appRoot, 'MacOS', 'Antigravity'), path.join(appRoot, 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework')];
    const sentinel = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
    for (const filename of executables) {
        if (!fs.existsSync(filename)) continue;
        const bytes = fs.readFileSync(filename);
        const position = bytes.indexOf(sentinel);
        if (position < 0) continue;
        const offset = position + sentinel.length;
        if (bytes[offset] === 1 && bytes[offset + 1] > 4 && bytes[offset + 6] === 49) return true;
    }
    return false;
}

export function inspectApp(inputPath) {
    const archivePath = resolveAppAsarPath(inputPath);
    if (!archivePath) throw new Error('Cannot find app.asar at the supplied path.');
    const info = inspectArchive(fs.readFileSync(archivePath));
    assertPatchable(info.patched ? cleanUtils(info.utils) : info.utils);
    const protectedArchive = integrityEnabled(archivePath);
    return { path: archivePath, version: info.metadata.version, patched: info.patched, hasBackup: hasAppBackup(archivePath), integrityProtected: protectedArchive, supported: !protectedArchive };
}

function atomicWrite(filename, data, mode = 0o644) {
    const temporary = filename + '.' + randomUUID() + '.tmp';
    let fd;
    try {
        fd = fs.openSync(temporary, 'wx', mode);
        fs.writeFileSync(fd, data);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;
        fs.renameSync(temporary, filename);
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
        fs.rmSync(temporary, { force: true });
    }
}

function withLock(archivePath, work) {
    const lock = archivePath + '.rtl-lock';
    let fd;
    try {
        fd = fs.openSync(lock, 'wx', 0o600);
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        throw new Error('Another patch operation holds ' + lock + '. If its process has ended, remove that lock file and retry.');
    }
    try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
        return work();
    } finally {
        fs.closeSync(fd);
        fs.unlinkSync(lock);
    }
}

export async function patchApp(inputPath) {
    const archivePath = resolveAppAsarPath(inputPath);
    if (!archivePath) throw new Error('Cannot find app.asar at the supplied path.');
    return withLock(archivePath, () => {
        if (integrityEnabled(archivePath)) throw new Error('This Antigravity build enforces an embedded ASAR signature and cannot load a modified archive. This build is unsupported.');
        const currentBytes = fs.readFileSync(archivePath);
        const current = inspectArchive(currentBytes);
        let originalBytes = currentBytes;
        if (current.patched) {
            originalBytes = findBackup(archivePath, current);
            if (!originalBytes) throw new Error('A clean backup matching this Antigravity version and its contents is required to update the existing patch. Reinstall the app to obtain clean files.');
        }
        const original = inspectArchive(originalBytes);
        assertPatchable(original.utils);
        const replacements = new Map();
        for (const [destination, source] of Object.entries(assets)) {
            replacements.set(destination, fs.readFileSync(path.join(assetsDirectory, source)));
        }
        const payload = fs.readFileSync(path.join(assetsDirectory, 'payload.js'), 'utf8').trimEnd();
        const patchedUtils = original.utils.replace(anchor, () => payload + '\n' + end);
        new Script(patchedUtils, { filename: 'dist/utils.js' });
        replacements.set('dist/utils.js', Buffer.from(patchedUtils));
        const patchedBytes = changeArchive(original.archive, replacements);
        const verified = inspectArchive(patchedBytes);
        for (const [filename, bytes] of replacements) {
            if (!packedFile(verified.archive, filename).equals(bytes)) throw new Error('Archive verification failed for ' + filename);
        }
        if (patchedBytes.equals(currentBytes)) return true;
        if (!fs.readFileSync(archivePath).equals(currentBytes)) throw new Error('Antigravity changed during preparation. Close it and retry.');
        const mode = fs.statSync(archivePath).mode;
        atomicWrite(archivePath + '.rtl-bak', originalBytes, mode);
        const allowedPatchedHashes = current.patched ? [hash(currentBytes), hash(patchedBytes)] : [hash(patchedBytes)];
        atomicWrite(archivePath + '.rtl-state.json', JSON.stringify({ version: original.metadata.version, originalHash: hash(originalBytes), allowedPatchedHashes }, null, 2), 0o600);
        atomicWrite(archivePath, patchedBytes, mode);
        return true;
    });
}

export async function restoreApp(inputPath) {
    const archivePath = resolveAppAsarPath(inputPath);
    if (!archivePath) throw new Error('Cannot find app.asar at the supplied path.');
    return withLock(archivePath, () => {
        const currentBytes = fs.readFileSync(archivePath);
        const current = inspectArchive(currentBytes);
        // An app update may already have removed the patch.
        if (!current.patched) return true;
        const originalBytes = findBackup(archivePath, current);
        if (!originalBytes) throw new Error('No clean backup matches this app version and its current contents. Restoring an older app backup would undo its update.');
        const statePath = archivePath + '.rtl-state.json';
        if (fs.existsSync(statePath)) {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            const allowedPatchedHashes = state.allowedPatchedHashes || [state.patchedHash];
            if (state.version === current.metadata.version && (state.originalHash !== hash(originalBytes) || !allowedPatchedHashes.includes(hash(currentBytes)))) {
                throw new Error('The patched archive has changed since installation. Its saved fingerprint does not match.');
            }
        }
        if (!fs.readFileSync(archivePath).equals(currentBytes)) throw new Error('Antigravity changed during restore. Close it and retry.');
        atomicWrite(archivePath, originalBytes, fs.statSync(archivePath).mode);
        fs.rmSync(statePath, { force: true });
        return true;
    });
}
