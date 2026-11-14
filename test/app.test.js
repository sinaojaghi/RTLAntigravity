import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPackageWithOptions, extractFile, getRawHeader, uncache } from '@electron/asar';
import { patchApp, restoreApp, inspectApp, resolveAppAsarPath } from '../bin/patch-app.js';
import { readArchive, changeArchive, packedFile } from '../bin/archive.js';

async function fixture(t, { version = '2.31.2', utils = 'function createWindow(win, url) {\n    void win.loadURL(url);\n}\n' } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-app-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const resources = path.join(root, 'نسخه تست', 'resources');
    fs.mkdirSync(path.join(source, 'dist'), { recursive: true });
    fs.mkdirSync(resources, { recursive: true });
    fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ name: 'antigravity', version }));
    fs.writeFileSync(path.join(source, 'dist', 'utils.js'), utils);
    fs.writeFileSync(path.join(source, 'dist', 'main.js'), 'console.log("application");');
    fs.writeFileSync(path.join(source, 'dist', 'native.node'), 'native binary bytes');
    const archive = path.join(resources, 'app.asar');
    await createPackageWithOptions(source, archive, { unpack: '*.node' });
    uncache(archive);
    // Executable flags must survive even when testing on Windows.
    const parsed = readArchive(fs.readFileSync(archive));
    parsed.header.files.dist.files['main.js'].executable = true;
    fs.writeFileSync(archive, changeArchive(parsed, new Map()));
    uncache(archive);
    return { root, source, resources, archive, original: fs.readFileSync(archive) };
}

test('install, repeat, restore and repeat restore preserve all application bytes and unpacked metadata', async t => {
    const f = await fixture(t);
    const beforeHeader = getRawHeader(f.archive).header;
    const unpacked = fs.readFileSync(f.archive + '.unpacked/dist/native.node');
    assert.equal(resolveAppAsarPath(path.dirname(f.resources)), f.archive);
    await patchApp(f.archive);
    uncache(f.archive);
    const first = fs.readFileSync(f.archive);
    const afterHeader = getRawHeader(f.archive).header;
    assert.deepEqual(afterHeader.files.dist.files['native.node'], beforeHeader.files.dist.files['native.node']);
    assert.deepEqual(afterHeader.files.dist.files['main.js'], beforeHeader.files.dist.files['main.js']);
    assert.equal(afterHeader.files.dist.files['main.js'].executable, true);
    assert.match(extractFile(f.archive, 'dist/utils.js').toString(), /antigravity-rtl-runtime\.cjs/);
    assert.match(extractFile(f.archive, 'dist/antigravity-rtl-client.js').toString(), /sinaojaghi/);
    assert.deepEqual(extractFile(f.archive, 'dist/native.node'), unpacked);
    assert.equal(inspectApp(f.archive).patched, true);
    await patchApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), first);
    assert.deepEqual(fs.readFileSync(f.archive + '.rtl-bak'), f.original);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
    assert.deepEqual(fs.readFileSync(f.archive + '.unpacked/dist/native.node'), unpacked);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
});

test('app update refreshes its backup and restore never downgrades an updated unpatched app', async t => {
    const f = await fixture(t);
    await patchApp(f.archive);
    const updated = changeArchive(readArchive(f.original), new Map([
        ['package.json', Buffer.from(JSON.stringify({ name: 'antigravity', version: '2.32.0' }))],
        ['dist/main.js', Buffer.from('console.log("updated");')]
    ]));
    fs.writeFileSync(f.archive, updated);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), updated);
    await patchApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive + '.rtl-bak'), updated);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), updated);
});

for (const suffix of ['.bak', '.rtl-bak']) {
    test('legacy patch migrates and restores using ' + suffix, async t => {
        const f = await fixture(t);
        const original = readArchive(f.original);
        const utils = packedFile(original, 'dist/utils.js').toString();
        const old = utils.replace('void win.loadURL(url);', '/* ANTIGRAVITY RTL PATCH */\nconsole.log("legacy");\nvoid win.loadURL(url);\n/* END ANTIGRAVITY RTL PATCH */');
        fs.writeFileSync(f.archive, changeArchive(original, new Map([['dist/utils.js', Buffer.from(old)]])));
        fs.writeFileSync(f.archive + suffix, f.original);
        await patchApp(f.archive);
        assert.match(packedFile(readArchive(fs.readFileSync(f.archive)), 'dist/utils.js').toString(), /antigravity-rtl-runtime/);
        await restoreApp(f.archive);
        assert.deepEqual(fs.readFileSync(f.archive), f.original);
    });
}

test('stale backup for another version cannot replace the current patched app', async t => {
    const f = await fixture(t);
    await patchApp(f.archive);
    const stale = changeArchive(readArchive(f.original), new Map([
        ['package.json', Buffer.from(JSON.stringify({ name: 'antigravity', version: '1.0.0' }))]
    ]));
    fs.writeFileSync(f.archive + '.rtl-bak', stale);
    const current = fs.readFileSync(f.archive);
    await assert.rejects(restoreApp(f.archive), /No clean backup matches/);
    await assert.rejects(patchApp(f.archive), /clean backup matching/);
    assert.deepEqual(fs.readFileSync(f.archive), current);
});

test('manual modifications outside RTL are not discarded by restore', async t => {
    const f = await fixture(t);
    await patchApp(f.archive);
    const modified = changeArchive(readArchive(fs.readFileSync(f.archive)), new Map([
        ['dist/main.js', Buffer.from('console.log("third party customization");')]
    ]));
    fs.writeFileSync(f.archive, modified);
    await assert.rejects(restoreApp(f.archive), /No clean backup matches/);
    assert.deepEqual(fs.readFileSync(f.archive), modified);
});

test('unsupported window hook fails before creating a backup', async t => {
    const f = await fixture(t, { utils: 'function start() { return 1; }' });
    await assert.rejects(patchApp(f.archive), /supported window-loading hook/);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
    assert.equal(fs.existsSync(f.archive + '.rtl-bak'), false);
    assert.equal(fs.existsSync(f.archive + '.rtl-lock'), false);
});

test('a competing patch lock prevents mutation', async t => {
    const f = await fixture(t);
    fs.writeFileSync(f.archive + '.rtl-lock', JSON.stringify({ pid: process.pid }));
    await assert.rejects(patchApp(f.archive), /Another patch operation/);
    await assert.rejects(restoreApp(f.archive), /Another patch operation/);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
});

test('embedded integrity-protected app is detected before patching', async t => {
    const f = await fixture(t);
    const executable = Buffer.concat([Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from([1, 9]), Buffer.from('101110011')]);
    fs.writeFileSync(path.join(path.dirname(f.resources), 'Antigravity.exe'), executable);
    assert.equal(inspectApp(f.archive).integrityProtected, true);
    await assert.rejects(patchApp(f.archive), /embedded ASAR signature/);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
});

test('tampered packed entry fails checksum verification', async t => {
    const f = await fixture(t);
    const original = Buffer.from(f.original);
    const start = original.readUInt32LE(4) + 8;
    const entry = readArchive(original).header.files.dist.files['utils.js'];
    original[start + Number(entry.offset)] ^= 1;
    fs.writeFileSync(f.archive, original);
    await assert.rejects(patchApp(f.archive), /checksum mismatch/);
    assert.deepEqual(fs.readFileSync(f.archive), original);
});

test('legacy DevTools mutation is reverted along with the legacy patch', async t => {
    const f = await fixture(t, { utils: 'const options = { devTools: !electron_1.app.isPackaged };\nfunction createWindow(win, url) {\n    void win.loadURL(url);\n}\n' });
    const original = readArchive(f.original);
    const legacy = packedFile(original, 'dist/utils.js').toString()
        .replace('devTools: !electron_1.app.isPackaged', 'devTools: true')
        .replace('void win.loadURL(url);', '/* ANTIGRAVITY RTL PATCH */\nvoid win.loadURL(url);\n/* END ANTIGRAVITY RTL PATCH */');
    fs.writeFileSync(f.archive, changeArchive(original, new Map([['dist/utils.js', Buffer.from(legacy)]])));
    fs.writeFileSync(f.archive + '.bak', f.original);
    await patchApp(f.archive);
    const patched = packedFile(readArchive(fs.readFileSync(f.archive)), 'dist/utils.js').toString();
    assert.match(patched, /devTools: !electron_1\.app\.isPackaged/);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
});

test('a failed archive swap leaves the old patch restorable and clears its lock', async t => {
    const f = await fixture(t);
    const original = readArchive(f.original);
    const legacy = packedFile(original, 'dist/utils.js').toString()
        .replace('void win.loadURL(url);', '/* ANTIGRAVITY RTL PATCH */\nconsole.log("legacy");\nvoid win.loadURL(url);\n/* END ANTIGRAVITY RTL PATCH */');
    const oldBytes = changeArchive(original, new Map([['dist/utils.js', Buffer.from(legacy)]]));
    fs.writeFileSync(f.archive, oldBytes);
    fs.writeFileSync(f.archive + '.bak', f.original);
    const rename = fs.renameSync;
    fs.renameSync = function(source, destination) {
        if (destination === f.archive) {
            const error = new Error('Simulated sharing violation');
            error.code = 'EPERM';
            throw error;
        }
        return rename(source, destination);
    };
    try {
        await assert.rejects(patchApp(f.archive), /Simulated sharing violation/);
    } finally {
        fs.renameSync = rename;
    }
    assert.deepEqual(fs.readFileSync(f.archive), oldBytes);
    assert.equal(fs.existsSync(f.archive + '.rtl-lock'), false);
    assert.equal(fs.readdirSync(f.resources).some(name => name.endsWith('.tmp')), false);
    await restoreApp(f.archive);
    assert.deepEqual(fs.readFileSync(f.archive), f.original);
});
