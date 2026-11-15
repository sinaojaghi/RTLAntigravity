import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';

const client = fs.readFileSync(new URL('../bin/client.js', import.meta.url), 'utf8');
const defaults = { faFont: '', enFont: '', codeFont: '', lh: '1.6', fs: '16', isRTL: true, forceRTL: false, fixAtSign: true };

function page(t, html, changes = {}, kind = 'app') {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
        runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://127.0.0.1:1234/'
    });
    t.after(() => dom.window.close());
    const messages = [];
    dom.window.console.log = message => messages.push(message);
    dom.window.eval(`(${client})(${JSON.stringify({ config: { ...defaults, ...changes }, fontBase64: 'dGVzdA==', savePrefix: 'test|', kind })});`);
    const doc = dom.window.document;
    return { window: dom.window, doc, messages, byId: id => doc.getElementById(id) };
}

test('uses first letter for Persian, Arabic and mixed text without touching code', t => {
    const { byId } = page(t, `<div class="prose">
        <p id="fa">۱۲۳ سلام دنیا</p><p id="ar">مرحبا بالعالم</p>
        <p id="en">Hello سلام</p><p id="empty">123 !?</p><p id="greek">Ελληνικά فارسی</p>
        <pre><code id="code">فارسی</code></pre><div class="monaco-editor"><p id="editor">سلام</p></div>
        <div><p id="nested">فارسی</p></div></div><div contenteditable="true" id="input">سلام</div>`);
    for (const id of ['fa', 'ar', 'nested', 'input']) assert.equal(byId(id).getAttribute('dir'), 'rtl', id);
    for (const id of ['en', 'greek']) assert.equal(byId(id).getAttribute('dir'), 'ltr', id);
    assert.equal(byId('empty').getAttribute('dir'), 'auto');
    assert.equal(byId('code').hasAttribute('data-antigravity-rtl-text'), false);
    assert.equal(byId('editor').getAttribute('dir'), null);
});

test('tracks streaming character updates and newly inserted paragraphs', async t => {
    const { byId, doc } = page(t, '<div class="prose" id="chat"><p id="stream">Loading</p></div>');
    byId('stream').firstChild.data = 'پاسخ فارسی';
    const paragraph = doc.createElement('p');
    paragraph.textContent = 'مرحبا';
    byId('chat').append(paragraph);
    await delay(180);
    assert.equal(byId('stream').getAttribute('dir'), 'rtl');
    assert.equal(paragraph.getAttribute('dir'), 'rtl');
});

test('Chinese and mixed-script paragraphs and inputs use their first letter', async t => {
    const { byId, doc, window, messages } = page(t, `<div class="prose">
        <p id="simplified">你好，世界</p><p id="traditional">歡迎使用</p>
        <p id="mixed">中文 سلام</p><p id="persian-first">سلام 中文</p>
        <p id="numbered">１２３ 你好</p><pre><code id="code">const 文本 = "你好";</code></pre>
        </div><div contenteditable="true" id="input">你好</div>`);
    for (const id of ['simplified', 'traditional', 'mixed', 'numbered', 'input']) {
        assert.equal(byId(id).getAttribute('dir'), 'ltr', id);
    }
    assert.equal(byId('persian-first').getAttribute('dir'), 'rtl');
    assert.equal(byId('code').hasAttribute('data-antigravity-rtl-text'), false);
    byId('simplified').firstChild.data = 'سلام 中文';
    await delay(180);
    assert.equal(byId('simplified').getAttribute('dir'), 'rtl');
    byId('antigravity-rtl-statusbar-btn').click();
    const font = byId('rtl-panel-en-font');
    assert.equal(font.getAttribute('aria-label'), 'English and Chinese font');
    font.value = 'Microsoft YaHei';
    font.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.deepEqual(messages, ['test|{"enFont":"Microsoft YaHei"}']);
    const css = byId('antigravity-rtl-style').textContent;
    assert.ok(css.includes('"Microsoft YaHei"'));
    assert.ok(css.includes('"PingFang SC"'));
    assert.ok(css.includes('"Noto Sans CJK SC"'));
    assert.equal(doc.getElementById('rtl-panel-master-btn').getAttribute('aria-checked'), 'true');
});

test('disabling RTL restores owned attributes and respects app changes', t => {
    const { byId, doc } = page(t, '<div class="prose"><p id="saved" dir="auto">سلام</p><p id="plain">فارسی</p><p id="changed">متن</p></div><div id="external" dir="rtl">Elsewhere</div>');
    byId('changed').setAttribute('dir', 'auto');
    byId('antigravity-rtl-statusbar-btn').click();
    byId('rtl-panel-master-btn').click();
    assert.equal(byId('saved').getAttribute('dir'), 'auto');
    assert.equal(byId('plain').hasAttribute('dir'), false);
    assert.equal(byId('changed').getAttribute('dir'), 'auto');
    assert.equal(byId('external').getAttribute('dir'), 'rtl');
    assert.equal(doc.querySelectorAll('[data-antigravity-rtl-text]').length, 0);
    assert.equal(byId('antigravity-rtl-style').textContent, '');
    assert.equal(byId('rtl-panel-master-btn').getAttribute('aria-checked'), 'false');
    assert.equal(byId('rtl-panel-fa-font').disabled, true);
});

test('Force RTL applies to output while inputs follow their text', t => {
    const { byId } = page(t, '<div class="prose"><p id="out">English</p></div><div id="in" contenteditable="true">English</div>', { forceRTL: true });
    assert.equal(byId('out').getAttribute('dir'), 'rtl');
    assert.equal(byId('in').getAttribute('dir'), 'ltr');
});

test('settings use DOM properties and safely quote custom CSS font names', t => {
    const font = 'Font"; color: red; /*<img src=x>\\line';
    const { byId, doc, messages } = page(t, '<div class="prose"><p>سلام</p></div>', { faFont: font, enFont: font });
    byId('antigravity-rtl-statusbar-btn').click();
    assert.equal(byId('rtl-panel-fa-font').value, font);
    assert.equal(doc.querySelector('img'), null);
    assert.ok(byId('antigravity-rtl-style').textContent.includes('Font\\22 ; color: red;'));
    byId('rtl-panel-force-btn').click();
    assert.deepEqual(messages, ['test|{"forceRTL":true}']);
    assert.equal(byId('rtl-panel-force-btn').getAttribute('aria-checked'), 'true');
});

test('settings button attaches to IDE status bar and falls back when absent', t => {
    const { byId } = page(t, '<div class="part statusbar"><div class="right-items" id="status"></div></div>', {}, 'ide');
    assert.equal(byId('antigravity-rtl-statusbar-btn').parentNode, byId('status'));
    byId('antigravity-rtl-statusbar-btn').click();
    assert.equal(byId('antigravity-rtl-settings-panel').style.display, 'block');
    assert.equal(byId('antigravity-rtl-statusbar-btn').getAttribute('aria-expanded'), 'true');
    byId('rtl-panel-close-btn').click();
    assert.equal(byId('antigravity-rtl-statusbar-btn').getAttribute('aria-expanded'), 'false');
});

test('Persian Shift+2 changes editable text only and respects master switch', t => {
    const { window, byId } = page(t, '<textarea id="text"></textarea><div class="monaco-editor"><textarea id="code"></textarea></div>');
    const key = () => new window.KeyboardEvent('keydown', { code: 'Digit2', key: '٬', shiftKey: true, bubbles: true, cancelable: true });
    const event = key();
    byId('text').dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(byId('text').value, '@');
    const codeEvent = key();
    byId('code').dispatchEvent(codeEvent);
    assert.equal(codeEvent.defaultPrevented, false);
    byId('antigravity-rtl-statusbar-btn').click();
    byId('rtl-panel-master-btn').click();
    const disabledEvent = key();
    byId('text').dispatchEvent(disabledEvent);
    assert.equal(disabledEvent.defaultPrevented, false);
});
