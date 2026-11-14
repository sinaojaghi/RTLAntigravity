import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const START = '/* RTLAntigravity IDE START */';
const END = '/* RTLAntigravity IDE END */';
const BLOCK = /\/\* RTLAntigravity IDE START \*\/[\s\S]*?\/\* RTLAntigravity IDE END \*\/\r?\n?/g;
const LEGACY_IMPORT = /^import\s+['"]\.\/antigravity-rtl-main\.js['"];?[\t ]*(?:\r?\n|$)/gm;
const STATE = 'out/.antigravity-rtl-state.json';
const JOURNAL = '.antigravity-rtl-journal.json';
const LOCK = '.antigravity-rtl.lock';
const MAIN = 'out/main.js';
const WORKBENCH = 'out/vs/code/electron-browser/workbench';
const HTML_FILES = [`${WORKBENCH}/workbench.html`, `${WORKBENCH}/workbench-jetski-agent.html`];
const ASSETS = new Map([
    ['out/antigravity-rtl-main.cjs', 'ide-main.js'],
    ['out/antigravity-rtl-runtime.cjs', 'runtime.cjs'],
    ['out/antigravity-rtl-client.js', 'client.js'],
    ['out/Vazirmatn-Variable.woff2', 'Vazirmatn-Variable.woff2']
]);
const MANAGED_FILES = new Set([MAIN, ...HTML_FILES, ...ASSETS.keys(), STATE]);
const hash = data => data === null ? null : createHash('sha256').update(data).digest('hex');

function readOptional(filename) {
    try { return fs.readFileSync(filename); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function atomicWrite(filename, data) {
    if (data === null) {
        fs.rmSync(filename, { force: true });
        return;
    }
    const temporary = `${filename}.${randomUUID()}.tmp`;
    const mode = fs.existsSync(filename) ? fs.statSync(filename).mode : 0o644;
    try {
        fs.writeFileSync(temporary, data, { flag: 'wx', mode });
        fs.renameSync(temporary, filename);
    } finally {
        fs.rmSync(temporary, { force: true });
    }
}

function localFile(appDirectory, relativePath) {
    if (!MANAGED_FILES.has(relativePath)) throw new Error(`Unexpected IDE patch path ${relativePath}`);
    const target = path.join(appDirectory, relativePath);
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
        throw new Error(`The IDE file is a symbolic link: ${target}`);
    }
    return target;
}

function readState(appDirectory) {
    const raw = readOptional(path.join(appDirectory, STATE));
    if (!raw) return null;
    const state = JSON.parse(raw.toString('utf8'));
    if (state.format !== 1 || !Array.isArray(state.files)) throw new Error('Invalid IDE RTL backup manifest.');
    for (const record of state.files) {
        localFile(appDirectory, record.path);
        if (record.path === STATE || (record.original !== null && typeof record.original !== 'string') ||
            (record.patchedHash !== null && !/^[a-f0-9]{64}$/.test(record.patchedHash))) {
            throw new Error('Invalid IDE RTL backup record.');
        }
    }
    return state;
}

function rollback(appDirectory, records) {
    for (const record of [...records].reverse()) {
        const filename = localFile(appDirectory, record.path);
        const original = record.before === null ? null : Buffer.from(record.before, 'base64');
        const currentHash = hash(readOptional(filename));
        if (currentHash === hash(original)) continue;
        if (currentHash !== record.afterHash) {
            throw new Error(`IDE file changed during recovery: ${filename}. Keep the journal for recovery.`);
        }
        atomicWrite(filename, original);
    }
}

function withLock(appDirectory, operation) {
    const lockPath = path.join(appDirectory, LOCK);
    let handle;
    try { handle = fs.openSync(lockPath, 'wx'); }
    catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const owner = Number(fs.readFileSync(lockPath, 'utf8'));
        let active = true;
        if (Number.isSafeInteger(owner) && owner > 0) {
            try { process.kill(owner, 0); }
            catch (failure) { active = failure.code !== 'ESRCH'; }
        }
        if (active) throw new Error(`Another RTL operation is using this IDE. Lock file: ${lockPath}`);
        fs.unlinkSync(lockPath);
        handle = fs.openSync(lockPath, 'wx');
    }
    fs.writeFileSync(handle, String(process.pid));
    fs.closeSync(handle);
    const journalPath = path.join(appDirectory, JOURNAL);
    try {
        const raw = readOptional(journalPath);
        if (raw) {
            const journal = JSON.parse(raw.toString('utf8'));
            if (!Array.isArray(journal)) throw new Error('Invalid IDE recovery journal.');
            rollback(appDirectory, journal);
            fs.unlinkSync(journalPath);
        }
        return operation();
    } finally {
        fs.unlinkSync(lockPath);
    }
}

function commit(appDirectory, changes) {
    const records = changes.map(change => ({
        path: change.path,
        before: change.before?.toString('base64') ?? null,
        afterHash: hash(change.after)
    }));
    const journalPath = path.join(appDirectory, JOURNAL);
    atomicWrite(journalPath, Buffer.from(JSON.stringify(records)));
    try {
        for (const change of changes) {
            const filename = localFile(appDirectory, change.path);
            if (hash(readOptional(filename)) !== hash(change.before)) {
                throw new Error(`The IDE changed during patching: ${filename}. Close the application and retry.`);
            }
            atomicWrite(filename, change.after);
        }
        fs.unlinkSync(journalPath);
    } catch (error) {
        try {
            rollback(appDirectory, records);
            fs.unlinkSync(journalPath);
        } catch (recoveryError) {
            throw new AggregateError([error, recoveryError], `${error.message}\n${recoveryError.message}`);
        }
        throw error;
    }
}

function stripHook(code) {
    return code.replace(BLOCK, '').replace(LEGACY_IMPORT, '');
}

function addHook(code, esm) {
    const newline = code.includes('\r\n') ? '\r\n' : '\n';
    const statement = esm ? "import './antigravity-rtl-main.cjs';" : "require('./antigravity-rtl-main.cjs');";
    const block = `${START}${newline}${statement}${newline}${END}${newline}`;
    const prefix = code.startsWith('\uFEFF') ? '\uFEFF' : '';
    const body = code.slice(prefix.length);
    const shebangEnd = body.startsWith('#!') ? body.indexOf('\n') + 1 : 0;
    if (body.startsWith('#!') && !shebangEnd) return prefix + body + newline + block;
    let insertion = shebangEnd;
    if (!esm) {
        // Keep CommonJS directive prologues effective after adding the require.
        const directive = /^(?:(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/))*(?:"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*')[\t ]*(?:;|\r?\n|$)/;
        let match;
        while ((match = body.slice(insertion).match(directive))) insertion += match[0].length;
    }
    const needsNewline = insertion > 0 && body[insertion - 1] !== '\n';
    return prefix + body.slice(0, insertion) + (needsNewline ? newline : '') + block + body.slice(insertion);
}

export function patchFontCsp(html) {
    return html.replace(/<meta\b[^>]*>/gi, tag => {
        if (!/http-equiv\s*=\s*(['"])Content-Security-Policy\1/i.test(tag)) return tag;
        return tag.replace(/(\bcontent\s*=\s*)(["'])([\s\S]*?)\2/i, (all, prefix, quote, policy) => {
            let updated = policy;
            const fontDirective = /(^|;)\s*font-src\s+([^;]*)/i;
            const match = updated.match(fontDirective);
            if (match) {
                if (/(?:^|\s)data:(?:\s|$)/i.test(match[2])) return all;
                const sources = match[2].replace(/(?:'|&#39;|&apos;)none(?:'|&#39;|&apos;)/gi, '').trim();
                updated = updated.replace(fontDirective, () => `${match[1]} font-src ${sources} data:`);
            } else {
                const inherited = updated.match(/(?:^|;)\s*default-src\s+([^;]*)/i)?.[1]
                    .replace(/(?:'|&#39;|&apos;)none(?:'|&#39;|&apos;)/gi, '').trim();
                if (inherited === undefined) return all;
                updated += `${updated.trimEnd().endsWith(';') ? '' : ';'} font-src ${inherited} data:;`;
            }
            return `${prefix}${quote}${updated}${quote}`;
        });
    });
}

function getIdeCandidatePaths() {
    const names = ['Antigravity IDE', 'antigravity-ide', 'Antigravity', 'antigravity'];
    if (process.platform === 'darwin') {
        return ['/Applications', path.join(os.homedir(), 'Applications')]
            .flatMap(root => ['Antigravity IDE.app', 'Antigravity.app'].map(name => path.join(root, name)));
    }
    if (process.platform === 'win32') {
        const roots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'),
            process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
        return roots.flatMap(root => names.map(name => path.join(root, name)));
    }
    return ['/opt', '/usr/share', '/usr/lib', '/usr/local/share', path.join(os.homedir(), '.local', 'share'),
        path.join(os.homedir(), 'Downloads')].flatMap(root => names.map(name => path.join(root, name)));
}

export function resolveIdeAppDir(inputPath) {
    if (!inputPath) return null;
    let candidate = path.resolve(inputPath.replace(/^~(?=$|[\\/])/, os.homedir()));
    if (!fs.existsSync(candidate)) return null;
    if (fs.statSync(candidate).isFile()) {
        candidate = path.basename(candidate) === 'main.js' ? path.dirname(path.dirname(candidate)) : path.dirname(candidate);
    }
    const paths = [candidate, path.join(candidate, 'resources', 'app'), path.join(candidate, 'app'),
        path.join(candidate, 'Contents', 'Resources', 'app')];
    const found = paths.find(directory => fs.existsSync(path.join(directory, MAIN)));
    return found ? fs.realpathSync(found) : null;
}

export function detectIdeAppPath() {
    return getIdeCandidatePaths().map(resolveIdeAppDir).find(Boolean) ?? null;
}

export async function getIdeAppPath() {
    const detected = detectIdeAppPath();
    if (!detected) throw new Error('Antigravity IDE was not found. Use --ide --path "installation directory".');
    return detected;
}

export function hasIdeBackup(inputPath) {
    const appDirectory = resolveIdeAppDir(inputPath);
    if (!appDirectory) return false;
    const code = fs.readFileSync(path.join(appDirectory, MAIN), 'utf8');
    return fs.existsSync(path.join(appDirectory, STATE)) || code.includes(START) || code.includes('antigravity-rtl-main.js') ||
        fs.existsSync(path.join(appDirectory, MAIN + '.rtl-bak'));
}

export function inspectIde(inputPath) {
    const appDirectory = resolveIdeAppDir(inputPath);
    if (!appDirectory) throw new Error(`Could not locate IDE out/main.js under ${inputPath}`);
    const code = fs.readFileSync(path.join(appDirectory, MAIN), 'utf8');
    const packageBytes = readOptional(path.join(appDirectory, 'package.json'));
    const metadata = packageBytes ? JSON.parse(packageBytes.toString('utf8')) : {};
    return { path: appDirectory, version: metadata.version ?? 'unknown', compatible: true,
        status: code.includes(START) || code.includes('antigravity-rtl-main.js') ? 'patched' : 'unpatched' };
}

function cleanFile(appDirectory, relativePath, current, previous) {
    if (previous && hash(current) === previous.patchedHash) {
        return previous.original === null ? null : Buffer.from(previous.original, 'base64');
    }
    if (relativePath === MAIN && current) return Buffer.from(stripHook(current.toString('utf8')));
    if (HTML_FILES.includes(relativePath) && current) {
        const legacy = readOptional(path.join(appDirectory, relativePath + '.rtl-bak'));
        if (legacy) {
            const original = legacy.toString('utf8');
            const legacyPatch = original.replace(/(font-src[\s\S]*?'self')/i, "$1\n\t\t\t\t\tdata:");
            if ([patchFontCsp(original), legacyPatch].includes(current.toString('utf8'))) return legacy;
        }
    }
    return current;
}

export async function patchIde(inputPath) {
    const info = inspectIde(inputPath);
    const appDirectory = info.path;
    return withLock(appDirectory, () => {
        const previous = readState(appDirectory);
        const records = new Map(previous?.files.map(record => [record.path, record]));
        const changes = [];
        const saved = [];
        const desired = new Map(ASSETS);
        const mainBytes = fs.readFileSync(path.join(appDirectory, MAIN));
        const cleanMain = cleanFile(appDirectory, MAIN, mainBytes, records.get(MAIN));
        const metadata = JSON.parse(readOptional(path.join(appDirectory, 'package.json'))?.toString('utf8') || '{}');
        const esm = metadata.type === 'module' || /(?:^|\n)\s*(?:import\s*[{'"*\w$]|export\b)/.test(cleanMain.toString('utf8'));
        desired.set(MAIN, Buffer.from(addHook(cleanMain.toString('utf8'), esm)));
        for (const relativePath of HTML_FILES) {
            const current = readOptional(path.join(appDirectory, relativePath));
            if (current) {
                const clean = cleanFile(appDirectory, relativePath, current, records.get(relativePath));
                desired.set(relativePath, Buffer.from(patchFontCsp(clean.toString('utf8'))));
            }
        }
        for (const [relativePath, source] of desired) {
            const filename = localFile(appDirectory, relativePath);
            const before = readOptional(filename);
            const original = cleanFile(appDirectory, relativePath, before, records.get(relativePath));
            const after = typeof source === 'string' ? fs.readFileSync(path.join(sourceDirectory, source)) : source;
            saved.push({ path: relativePath, original: original?.toString('base64') ?? null, patchedHash: hash(after) });
            if (hash(before) !== hash(after)) changes.push({ path: relativePath, before, after });
        }
        const stateBefore = readOptional(path.join(appDirectory, STATE));
        const stateAfter = Buffer.from(JSON.stringify({ format: 1, version: info.version, files: saved }, null, 2));
        if (hash(stateBefore) !== hash(stateAfter)) changes.push({ path: STATE, before: stateBefore, after: stateAfter });
        if (changes.length) commit(appDirectory, changes);
        return true;
    });
}

export async function restoreIde(inputPath) {
    const appDirectory = resolveIdeAppDir(inputPath);
    if (!appDirectory) throw new Error(`Could not locate IDE out/main.js under ${inputPath}`);
    return withLock(appDirectory, () => {
        const previous = readState(appDirectory);
        if (!previous && !hasIdeBackup(appDirectory)) return true;
        const records = new Map(previous?.files.map(record => [record.path, record]));
        const files = new Set([MAIN, ...HTML_FILES, ...records.keys()]);
        const changes = [];
        for (const relativePath of files) {
            const filename = localFile(appDirectory, relativePath);
            const before = readOptional(filename);
            const after = cleanFile(appDirectory, relativePath, before, records.get(relativePath));
            if (hash(before) !== hash(after)) changes.push({ path: relativePath, before, after });
        }
        const stateBefore = readOptional(path.join(appDirectory, STATE));
        if (stateBefore) changes.push({ path: STATE, before: stateBefore, after: null });
        if (changes.length) commit(appDirectory, changes);
        return true;
    });
}
