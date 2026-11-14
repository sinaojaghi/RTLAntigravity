import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import { Script } from 'node:vm';
import runtime from '../bin/runtime.cjs';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtl-runtime-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.copyFileSync(new URL('../bin/client.js', import.meta.url), path.join(root, 'antigravity-rtl-client.js'));
    fs.writeFileSync(path.join(root, 'Vazirmatn-Variable.woff2'), 'test-font');
    const contents = new EventEmitter();
    contents.mainFrame = {};
    contents.isDestroyed = () => false;
    contents.url = 'https://127.0.0.1:12345/';
    contents.getURL = () => contents.url;
    contents.executeJavaScript = async code => {
        new Script(code);
        contents.settings = JSON.parse(code.slice(code.lastIndexOf(')(') + 2, -2));
    };
    const configPath = path.join(root, 'config.json');
    const options = { expectedURL: contents.url, assetDirectory: root, configPath };
    return { contents, options, root, configPath };
}

test('validates old settings and rejects malformed values', () => {
    assert.deepEqual(runtime.sanitizeConfig({ isRTL: 'false', forceRTL: true, fs: 'Infinity', lh: 100, faFont: 'font\nname', __proto__: { fixAtSign: false } }), {
        forceRTL: true, faFont: 'fontname', lh: '2.5'
    });
    assert.deepEqual(runtime.sanitizeConfig(null), {});
    assert.deepEqual(runtime.sanitizeConfig([]), {});
    assert.deepEqual(runtime.sanitizeConfig({ fs: 3, lh: '1.8', codeFont: 42 }), { fs: '11', lh: '1.8' });
});

test('URL trust matches loopback origin and local workbench paths', () => {
    const app = { expectedURL: 'https://127.0.0.1:4321/' };
    assert.equal(runtime.isTrustedURL('https://127.0.0.1:4321/chat', app), true);
    assert.equal(runtime.isTrustedURL('https://127.0.0.1:43210/', app), false);
    assert.equal(runtime.isTrustedURL('https://127.0.0.1.evil.test:4321/', app), false);
    assert.equal(runtime.isTrustedURL('file:///workbench.html', app), false);
    const localAppDirectory = path.resolve(os.tmpdir(), 'RTL App');
    const workbench = pathToFileURL(path.join(localAppDirectory, 'out', 'workbench.html')).href;
    const options = { kind: 'ide', localAppDirectory };
    assert.equal(runtime.isTrustedURL(workbench, options), true);
    assert.equal(runtime.isTrustedURL(workbench.replace('file://', 'vscode-file://vscode-app'), options), true);
    assert.equal(runtime.isTrustedURL(workbench.replace('workbench.html', 'untrusted.html'), options), false);
    assert.equal(runtime.isTrustedURL(pathToFileURL(path.join(localAppDirectory + '-other', 'workbench.html')).href, options), false);
    assert.equal(runtime.isTrustedURL('https://evil.test/workbench.html', options), false);
});

test('new and deprecated Electron console signatures save valid JSON', async t => {
    const { contents, options, configPath } = fixture(t);
    runtime.attach(contents, options);
    runtime.attach(contents, options);
    assert.equal(contents.listenerCount('dom-ready'), 1);
    contents.emit('dom-ready');
    await new Promise(resolve => setImmediate(resolve));
    const prefix = contents.settings.savePrefix;
    contents.emit('console-message', { message: prefix + JSON.stringify({ fs: '18' }), frame: contents.mainFrame });
    assert.equal(JSON.parse(fs.readFileSync(configPath)).fs, '18');
    contents.emit('console-message', {}, 1, prefix + JSON.stringify({ isRTL: false }), 1, contents.url);
    const saved = JSON.parse(fs.readFileSync(configPath));
    assert.equal(saved.isRTL, false);
    assert.equal(saved.fs, '18');
    contents.emit('console-message', {}, { message: prefix + JSON.stringify({ lh: '1.9' }), frame: contents.mainFrame });
    assert.equal(JSON.parse(fs.readFileSync(configPath)).lh, '1.9');
    contents.emit('destroyed');
    assert.equal(contents.listenerCount('dom-ready'), 0);
});

test('ignores other frames, missing tokens and navigation away from app', async t => {
    const { contents, options, configPath } = fixture(t);
    runtime.attach(contents, options);
    contents.emit('dom-ready');
    await new Promise(resolve => setImmediate(resolve));
    const message = contents.settings.savePrefix + JSON.stringify({ fs: '18' });
    contents.emit('console-message', { message, frame: {} });
    contents.emit('console-message', { message: 'SAVE_RTL_CONFIG|{"fs":"18"}', frame: contents.mainFrame });
    assert.equal(fs.existsSync(configPath), false);
    contents.url = 'https://example.org/';
    contents.emit('console-message', { message, frame: contents.mainFrame });
    contents.settings = null;
    contents.emit('dom-ready');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(contents.settings, null);
    assert.equal(fs.existsSync(configPath), false);
});

test('retains settings on partial save and preserves malformed file for recovery', t => {
    const { configPath, root } = fixture(t);
    runtime.saveConfig(configPath, { fs: '20', enFont: 'Inter' });
    runtime.saveConfig(configPath, { forceRTL: true });
    assert.equal(runtime.readConfig(configPath).fs, '20');
    assert.equal(runtime.readConfig(configPath).enFont, 'Inter');
    fs.writeFileSync(configPath, '{broken');
    runtime.saveConfig(configPath, { isRTL: false });
    assert.equal(runtime.readConfig(configPath).isRTL, false);
    const preserved = fs.readdirSync(root).find(name => name.startsWith('config.json.invalid-'));
    assert.equal(fs.readFileSync(path.join(root, preserved), 'utf8'), '{broken');
    assert.equal(fs.readdirSync(root).some(name => name.endsWith('.tmp')), false);
});
