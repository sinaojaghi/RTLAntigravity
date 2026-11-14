import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { patchIde, restoreIde, resolveIdeAppDir, inspectIde, hasIdeBackup, patchFontCsp } from '../bin/patch-ide.js';

const WORKBENCH = 'out/vs/code/electron-browser/workbench';
const MAIN = 'out/main.js';
const HTML = `${WORKBENCH}/workbench.html`;
const STATE = 'out/.antigravity-rtl-state.json';
const START = '/* RTLAntigravity IDE START */';
const hash = data => createHash('sha256').update(data).digest('hex');

function fixture(context, type = 'module') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-ide-test-'));
    const app = path.join(root, 'resources', 'app');
    fs.mkdirSync(path.join(app, WORKBENCH), { recursive: true });
    const main = type === 'module'
        ? '#!/usr/bin/env node\r\nimport fs from "node:fs";\r\nexport const original = 1;\r\n'
        : '#!/usr/bin/env node\n"use strict";\nmodule.exports = { original: 1 };\n';
    const html = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; font-src \'self\'; style-src \'self\' \'unsafe-inline\';"><main>IDE</main>';
    fs.writeFileSync(path.join(app, MAIN), main);
    fs.writeFileSync(path.join(app, HTML), html);
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.5.5', type }));
    context.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    return { root, app, main, html };
}

function read(app, file) {
    return fs.readFileSync(path.join(app, file), 'utf8');
}

test('IDE resolves installation, resources, app, and main.js paths', context => {
    const { root, app } = fixture(context);
    for (const candidate of [root, path.join(root, 'resources'), app, path.join(app, MAIN)]) {
        assert.equal(resolveIdeAppDir(candidate), fs.realpathSync(app));
    }
    assert.equal(resolveIdeAppDir(path.join(root, 'missing')), null);
    assert.equal(inspectIde(root).status, 'unpatched');
    assert.equal(inspectIde(root).version, '2.5.5');
});

for (const type of ['module', 'commonjs']) {
    test(`IDE ${type} installs, repeats, and restores byte-for-byte`, async context => {
        const { root, app, main, html } = fixture(context, type);
        assert.equal(hasIdeBackup(app), false);
        await patchIde(root);
        const installed = read(app, MAIN);
        const saved = read(app, STATE);
        assert.ok(installed.startsWith(main.slice(0, main.indexOf('\n') + 1)));
        assert.ok(installed.includes(type === 'module'
            ? "import './antigravity-rtl-main.cjs';"
            : "require('./antigravity-rtl-main.cjs');"));
        if (type === 'commonjs') assert.ok(installed.indexOf('"use strict";') < installed.indexOf(START));
        assert.ok(read(app, HTML).includes('data:'));
        assert.equal(inspectIde(app).status, 'patched');
        assert.equal(hasIdeBackup(app), true);
        await patchIde(app);
        assert.equal(read(app, MAIN), installed);
        assert.equal(read(app, STATE), saved);
        await restoreIde(app);
        assert.equal(read(app, MAIN), main);
        assert.equal(read(app, HTML), html);
        assert.equal(fs.existsSync(path.join(app, STATE)), false);
        assert.equal(fs.existsSync(path.join(app, 'out/antigravity-rtl-main.cjs')), false);
        await restoreIde(app);
        assert.equal(read(app, MAIN), main);
    });
}

test('IDE restore preserves updated host code and HTML', async context => {
    const { app } = fixture(context);
    await patchIde(app);
    const newerMain = 'export const upgraded = 2;\n';
    const newerHtml = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; font-src https://fonts.test;">';
    fs.writeFileSync(path.join(app, MAIN), newerMain);
    fs.writeFileSync(path.join(app, HTML), newerHtml);
    await restoreIde(app);
    assert.equal(read(app, MAIN), newerMain);
    assert.equal(read(app, HTML), newerHtml);
});

test('IDE re-patch after an update records the new originals', async context => {
    const { app } = fixture(context);
    await patchIde(app);
    const newerMain = 'export const upgraded = 3;\n';
    const newerHtml = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\';">';
    fs.writeFileSync(path.join(app, MAIN), newerMain);
    fs.writeFileSync(path.join(app, HTML), newerHtml);
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.5.6', type: 'module' }));
    await patchIde(app);
    assert.equal(JSON.parse(read(app, STATE)).version, '2.5.6');
    await restoreIde(app);
    assert.equal(read(app, MAIN), newerMain);
    assert.equal(read(app, HTML), newerHtml);
});

test('IDE restore strips its hook from a file changed after patching', async context => {
    const { app, main } = fixture(context);
    await patchIde(app);
    fs.appendFileSync(path.join(app, MAIN), 'export const laterChange = true;\n');
    await restoreIde(app);
    assert.equal(read(app, MAIN), main + 'export const laterChange = true;\n');
});

test('IDE migrates legacy patches without restoring stale main.js backups', async context => {
    const { app, html } = fixture(context);
    const currentMain = 'export const currentVersion = 10;\n';
    fs.writeFileSync(path.join(app, MAIN), "import './antigravity-rtl-main.js';\n" + currentMain);
    fs.writeFileSync(path.join(app, MAIN + '.rtl-bak'), 'export const obsoleteVersion = 1;\n');
    fs.writeFileSync(path.join(app, HTML + '.rtl-bak'), html);
    fs.writeFileSync(path.join(app, HTML), html.replace(/(font-src[\s\S]*?'self')/i, "$1\n\t\t\t\t\tdata:"));
    await patchIde(app);
    assert.equal(read(app, MAIN).split(START).length, 2);
    assert.ok(!read(app, MAIN).includes("'./antigravity-rtl-main.js'"));
    await restoreIde(app);
    assert.equal(read(app, MAIN), currentMain);
    assert.equal(read(app, HTML), html);
});

test('IDE restore preserves external changes to injected assets', async context => {
    const { app } = fixture(context);
    await patchIde(app);
    const filename = 'out/antigravity-rtl-runtime.cjs';
    fs.writeFileSync(path.join(app, filename), '// modified by another tool\n');
    await restoreIde(app);
    assert.equal(read(app, filename), '// modified by another tool\n');
});

test('IDE denies a concurrent patch operation before mutation', async context => {
    const { app, main } = fixture(context);
    fs.writeFileSync(path.join(app, '.antigravity-rtl.lock'), String(process.pid));
    await assert.rejects(patchIde(app), /Another RTL operation/);
    assert.equal(read(app, MAIN), main);
    assert.equal(fs.existsSync(path.join(app, STATE)), false);
});

test('IDE rolls back all staged changes when replacement fails', async context => {
    const { app, main, html } = fixture(context);
    const originalRename = fs.renameSync;
    let injected = false;
    fs.renameSync = function (source, destination) {
        if (!injected && destination === path.join(app, HTML)) {
            injected = true;
            throw new Error('simulated replacement failure');
        }
        return originalRename(source, destination);
    };
    try { await assert.rejects(patchIde(app), /simulated replacement failure/); }
    finally { fs.renameSync = originalRename; }
    assert.equal(read(app, MAIN), main);
    assert.equal(read(app, HTML), html);
    assert.equal(fs.existsSync(path.join(app, STATE)), false);
    assert.equal(fs.existsSync(path.join(app, 'out/antigravity-rtl-main.cjs')), false);
    assert.equal(fs.existsSync(path.join(app, '.antigravity-rtl-journal.json')), false);
});

test('IDE recovers an interrupted replacement from its journal', async context => {
    const { app, main } = fixture(context);
    const partial = main + '// partially replaced\n';
    fs.writeFileSync(path.join(app, MAIN), partial);
    fs.writeFileSync(path.join(app, '.antigravity-rtl-journal.json'), JSON.stringify([
        { path: MAIN, before: Buffer.from(main).toString('base64'), afterHash: hash(partial) }
    ]));
    await patchIde(app);
    await restoreIde(app);
    assert.equal(read(app, MAIN), main);
    assert.equal(fs.existsSync(path.join(app, '.antigravity-rtl-journal.json')), false);
});

test('IDE rejects unexpected paths in backup manifests', async context => {
    const { app, main } = fixture(context);
    fs.writeFileSync(path.join(app, STATE), JSON.stringify({ format: 1, files: [{ path: '../other.txt', original: null, patchedHash: null }] }));
    await assert.rejects(restoreIde(app), /Unexpected IDE patch path/);
    assert.equal(read(app, MAIN), main);
});

test('font CSP handles existing sources, none, inherited directives, and repeated runs', () => {
    const policies = [
        "font-src 'self'; script-src 'self';",
        "default-src 'none'; font-src 'none';",
        "default-src 'self' https://static.test;",
        'font-src https://static.test/fonts;',
        'font-src data:;'
    ];
    for (const policy of policies) {
        const html = `<meta content="${policy}" HTTP-EQUIV="Content-Security-Policy">`;
        const result = patchFontCsp(html);
        assert.ok(result.includes('data:'));
        assert.equal(patchFontCsp(result), result);
        assert.ok(!/font-src\s+'none'\s+data:/.test(result));
    }
    const noPolicy = '<meta name="description" content="font-src words"><p>font-src</p>';
    assert.equal(patchFontCsp(noPolicy), noPolicy);
});
