import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildClaudeWeb } from '../bin/build-claude-web.js';

const cli = fileURLToPath(new URL('../bin/index.js', import.meta.url));

function workspace(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-web-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
    return directory;
}

test('CLI exports a reloadable extension scoped to Claude Web without patching a desktop app', t => {
    const directory = workspace(t);
    const output = path.join(directory, 'claude-web-extension');
    const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: directory, encoding: 'utf8' });
    const result = run('--claude-web');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(output));
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.content_scripts[0].matches, ['https://claude.ai/*']);
    assert.deepEqual(manifest.content_scripts[0].js, ['content.js']);
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.equal(manifest.host_permissions, undefined);
    const original = fs.readFileSync(path.join(output, 'content.js'));
    assert.equal(run('--claude-web', '--path', output).status, 0);
    assert.deepEqual(fs.readFileSync(path.join(output, 'content.js')), original);
    assert.equal(run('--claude-web', '--restore').status, 1);
    assert.ok(fs.existsSync(path.join(output, 'OFL-Vazirmatn.txt')));

    const unrelated = path.join(directory, 'keep.txt');
    fs.writeFileSync(unrelated, 'keep');
    assert.equal(run('--claude-web', '--path', directory).status, 1);
    assert.equal(fs.readFileSync(unrelated, 'utf8'), 'keep');
});

test('packaged Claude content script formats streamed chat text and saves preferences locally', async t => {
    const output = buildClaudeWeb(path.join(workspace(t), 'extension'));
    const source = fs.readFileSync(path.join(output, 'content.js'), 'utf8');
    const dom = new JSDOM('<nav><p id="nav">راهنما</p></nav><main></main>', {
        url: 'https://claude.ai/new', runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    const { window } = dom;
    const { document } = window;
    const get = id => document.getElementById(id);
    const saved = [];
    const fonts = [];
    let styles = '';
    window.chrome = { storage: { local: {
        get: async defaults => ({ ...defaults, enFont: 'Microsoft YaHei' }),
        set: async changes => saved.push(changes)
    } } };
    window.FontFace = class {
        constructor(family, bytes) { assert.equal(bytes.length > 100_000, true); this.family = family; }
        async load() { return this; }
    };
    document.fonts = { add: font => fonts.push(font.family) };
    window.CSSStyleSheet = class { replaceSync(css) { styles = css; } };
    document.adoptedStyleSheets = [];
    window.eval(source);
    assert.equal(get('antigravity-rtl-statusbar-btn'), null);

    document.querySelector('main').innerHTML = `
        <div data-testid="user-message"><div id="prompt" class="whitespace-pre-wrap">سلام دنیا</div></div>
        <div class="font-claude-response-body"><div class="standard-markdown">
            <p id="response">درود! </p><p id="english">Hello there.</p><p id="chinese">你好，世界</p>
            <pre id="code"><code>const متن = "سلام";</code></pre>
        </div></div>
        <div class="tiptap ProseMirror" contenteditable="true" id="composer"><p>یک سؤال</p></div>
        <div data-testid="artifact-panel"><div class="ProseMirror" contenteditable="true" id="artifact">متن</div></div>`;
    await delay(0);
    for (const id of ['prompt', 'response', 'composer']) assert.equal(get(id).getAttribute('dir'), 'rtl', id);
    for (const id of ['english', 'chinese']) assert.equal(get(id).getAttribute('dir'), 'ltr', id);
    for (const id of ['nav', 'code', 'artifact']) assert.equal(get(id).hasAttribute('dir'), false, id);
    assert.deepEqual(fonts, ['RTLAntigravity Persian']);
    assert.match(styles, /Microsoft YaHei/);
    get('response').firstChild.data = 'A streamed English response';
    await delay(180);
    assert.equal(get('response').getAttribute('dir'), 'ltr');

    get('antigravity-rtl-statusbar-btn').click();
    get('rtl-panel-master-btn').click();
    assert.equal(get('prompt').hasAttribute('dir'), false);
    assert.equal(get('composer').hasAttribute('dir'), false);
    assert.equal(styles, '');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].isRTL, false);
});
