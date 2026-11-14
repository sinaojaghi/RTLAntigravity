function installRTLAntigravity(options) {
    if (window.__antigravity_rtl_injected) return;
    window.__antigravity_rtl_injected = true;
    function init() {
        const state = { ...options.config };
        let savedState = { ...state };
        const tracked = new Map();
        const marker = 'data-antigravity-rtl-text';
        const protectedSelector = 'pre, code, .monaco-editor, .monaco-diff-editor, .terminal, .terminal-wrapper, .xterm, .codicon, [class*="codicon-"], .google-symbols, [contenteditable="false"]';
        const ownUI = '#antigravity-rtl-settings-panel, #antigravity-rtl-statusbar-btn';
        const inputSelector = '[contenteditable="true"], [contenteditable="true"] p, textarea[data-testid="ask-question-writein"], textarea[aria-label="Message input"]';
        const outputSelector = '.prose > *, .prose :is(p, li, h1, h2, h3, h4, h5, h6), .markdown-body > *, .markdown-body :is(p, li, h1, h2, h3, h4, h5, h6), .rendered-markdown > *, .leading-relaxed > *, [data-testid="chat-message"] > *, [data-testid="conversation-view"] p, [data-testid="conversation-view"] li, [data-testid="conversation-view"] h1, [data-testid="conversation-view"] h2, [data-testid="conversation-view"] h3, [data-testid="user-input-step"], label[for^="ask-opt-"]';
        const rtlStyle = document.createElement('style');
        rtlStyle.id = 'antigravity-rtl-style';
        document.head.appendChild(rtlStyle);

        // A quoted CSS string protects font names containing quotes, slashes or line breaks.
        function cssString(value) {
            return '"' + String(value).replace(/[\\"\n\r\f]/g, character => '\\' + character.codePointAt(0).toString(16) + ' ') + '"';
        }

        function updateDynamicCSS() {
            if (!state.isRTL) {
                rtlStyle.textContent = '';
                return;
            }
            const faFont = state.faFont ? '"RTLAntigravity Custom Persian", ' : '';
            const enFont = state.enFont ? `${cssString(state.enFont)}, ` : '';
            const codeFont = state.codeFont ? `font-family: ${cssString(state.codeFont)}, ui-monospace, monospace !important;` : '';
            const fontStack = `${faFont}"RTLAntigravity Persian", ${enFont}system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`;
            rtlStyle.textContent = `
                ${state.faFont ? `@font-face {
                    font-family: "RTLAntigravity Custom Persian";
                    src: local(${cssString(state.faFont)});
                    unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
                }` : ''}
                @font-face {
                    font-family: "RTLAntigravity Persian";
                    src: url("data:font/woff2;base64,${options.fontBase64}") format("woff2");
                    font-weight: 100 900;
                    unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;
                }
                [${marker}] {
                    font-family: ${fontStack} !important;
                    line-height: ${state.lh} !important;
                    unicode-bidi: plaintext;
                    text-align: start !important;
                }
                [${marker}]:is(p, li, div, textarea, [contenteditable="true"]) {
                    font-size: ${state.fs}px !important;
                }
                [${marker}] [data-lexical-text="true"] {
                    font-family: inherit !important;
                }
                [${marker}][dir="rtl"] { direction: rtl !important; }
                [${marker}][dir="ltr"] { direction: ltr !important; }
                [${marker}] ul, [${marker}] ol, ul[${marker}], ol[${marker}] {
                    padding-inline-start: 1.5em;
                    padding-inline-end: 0;
                }
                [${marker}] pre, [${marker}] code, [${marker}] pre *, [${marker}] code *,
                .monaco-editor, .monaco-editor *, .monaco-diff-editor, .monaco-diff-editor *,
                .terminal, .terminal *, .terminal-wrapper, .terminal-wrapper *, .xterm, .xterm * {
                    direction: ltr !important;
                    text-align: left !important;
                    unicode-bidi: isolate !important;
                    ${codeFont}
                }
                [${marker}] .codicon, [${marker}] [class*="codicon-"] { font-family: codicon !important; }
                [${marker}] .google-symbols { font-family: "Google Symbols" !important; }
            `;
        }

        function restoreElement(element, previous) {
            if (element.getAttribute('dir') === previous.applied) {
                if (previous.dir === null) element.removeAttribute('dir');
                else element.setAttribute('dir', previous.dir);
            }
            if (previous.marker === null) element.removeAttribute(marker);
            else element.setAttribute(marker, previous.marker);
        }

        function textDirection(text) {
            const firstLetter = text.match(/\p{Letter}/u)?.[0];
            if (!firstLetter) return 'auto';
            return /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(firstLetter) ? 'rtl' : 'ltr';
        }

        function updateDir() {
            for (const [element, previous] of tracked) {
                if (!state.isRTL || !element.isConnected || element.closest(protectedSelector)) {
                    restoreElement(element, previous);
                    tracked.delete(element);
                }
            }
            if (!state.isRTL) return;
            document.querySelectorAll(`${inputSelector}, ${outputSelector}`).forEach(element => {
                if (element.closest(protectedSelector) || element.closest(ownUI)) return;
                const isInput = element.matches(inputSelector);
                const text = element.tagName === 'TEXTAREA' ? element.value : element.textContent;
                const direction = state.forceRTL && !isInput ? 'rtl' : textDirection(text || '');
                let previous = tracked.get(element);
                if (!previous) {
                    previous = { dir: element.getAttribute('dir'), marker: element.getAttribute(marker), applied: null };
                    tracked.set(element, previous);
                } else if (element.getAttribute('dir') !== previous.applied) {
                    previous.dir = element.getAttribute('dir');
                }
                previous.applied = direction;
                if (element.getAttribute('dir') !== direction) element.setAttribute('dir', direction);
                if (!element.hasAttribute(marker)) element.setAttribute(marker, '');
            });
        }

        function saveConfig() {
            const changes = {};
            for (const key of Object.keys(state)) {
                if (state[key] !== savedState[key]) changes[key] = state[key];
            }
            if (Object.keys(changes).length) {
                console.log(options.savePrefix + JSON.stringify(changes));
                savedState = { ...state };
            }
        }

        function closeSettingsPanel() {
            const panel = document.getElementById('antigravity-rtl-settings-panel');
            if (panel) panel.style.display = 'none';
            const button = document.getElementById('antigravity-rtl-statusbar-btn');
            button?.setAttribute('aria-expanded', 'false');
            if (panel?.contains(document.activeElement)) button?.focus();
        }

        function el(tag, styles, children, attrs) {
            const element = document.createElement(tag);
            if (styles) element.style.cssText = styles;
            if (attrs) Object.assign(element, attrs);
            if (children) {
                if (typeof children === 'string') {
                    element.textContent = children;
                } else if (Array.isArray(children)) {
                    for (const child of children) {
                        if (child) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
                    }
                } else {
                    element.appendChild(children);
                }
            }
            return element;
        }

        // Settings Panel Creation (Pure DOM - immune to Trusted Types & CSP)
        function ensureSettingsPanel() {
            let panel = document.getElementById('antigravity-rtl-settings-panel');
            if (panel) return panel;

            panel = el('div', `
                display: none;
                position: fixed;
                z-index: 100000;
                bottom: 48px;
                right: 12px;
                width: min(290px, calc(100vw - 24px));
                max-height: calc(100vh - 80px);
                overflow-y: auto;
                background: var(--vscode-editorWidget-background, #1e293b);
                color: var(--vscode-editorWidget-foreground, #f3f4f6);
                border: 1px solid var(--vscode-widget-border, #334155);
                border-radius: 12px;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                padding: 14px;
                direction: ltr;
                box-sizing: border-box;
                user-select: none;
            `, null, { id: 'antigravity-rtl-settings-panel', role: 'dialog', ariaLabel: 'RTLAntigravity settings' });

            // 1. Header
            const headerTitle = el('div', null, [
                el('span', 'font-weight:600;font-size:13px;display:block;', 'RTLAntigravity'),
                el('span', 'font-size:10px;color:var(--vscode-descriptionForeground,#94a3b8);', 'Settings & Font Control')
            ]);
            const closeBtn = el('button', 'background:none;border:none;color:inherit;cursor:pointer;font-size:16px;line-height:1;opacity:0.7;padding:4px;', '✕', { id: 'rtl-panel-close-btn', type: 'button', title: 'Close' });
            const header = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vscode-widget-border, rgba(255,255,255,0.15));', [headerTitle, closeBtn]);
            panel.appendChild(header);

            // 2. Master Toggle
            const toggleLabel = el('span', 'font-weight:500;font-size:12px;', state.isRTL ? 'Enabled' : 'Disabled', { id: 'rtl-panel-toggle-label' });
            const masterKnob = el('span', `display:block;width:16px;height:16px;border-radius:50%;background:#ffffff;position:absolute;top:3px;left:${state.isRTL ? '21px' : '3px'};transition:left 0.2s;`, null, { id: 'rtl-panel-master-knob' });
            const masterBtn = el('button', `cursor:pointer;width:40px;height:22px;border-radius:11px;border:none;background:${state.isRTL ? 'var(--vscode-button-background, #3b82f6)' : '#64748b'};position:relative;padding:0;outline:none;transition:background 0.2s;`, [masterKnob], { id: 'rtl-panel-master-btn', type: 'button', role: 'switch', ariaLabel: 'Enable RTL', ariaChecked: String(state.isRTL) });
            const masterRow = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;', [toggleLabel, masterBtn]);
            panel.appendChild(masterRow);

            // 3. Panel Body
            const panelBody = el('div', `display:flex;flex-direction:column;gap:9px;opacity:${state.isRTL ? '1' : '0.4'};pointer-events:${state.isRTL ? 'auto' : 'none'};transition:opacity 0.2s;`, null, { id: 'rtl-panel-body' });

            // Force RTL Toggle
            const forceLabel = el('span', 'font-size:11px;color:var(--vscode-descriptionForeground,#94a3b8);', 'Force RTL', { title: 'Force conversation text to RTL direction' });
            const forceKnob = el('span', `display:block;width:12px;height:12px;border-radius:50%;background:#ffffff;position:absolute;top:3px;left:${state.forceRTL ? '19px' : '3px'};transition:left 0.2s;`, null, { id: 'rtl-panel-force-knob' });
            const forceBtn = el('button', `cursor:pointer;width:34px;height:18px;border-radius:9px;border:none;background:${state.forceRTL ? 'var(--vscode-button-background, #3b82f6)' : '#64748b'};position:relative;padding:0;outline:none;transition:background 0.2s;`, [forceKnob], { id: 'rtl-panel-force-btn', type: 'button', role: 'switch', ariaLabel: 'Force RTL', ariaChecked: String(state.forceRTL) });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;', [forceLabel, forceBtn]));

            panelBody.appendChild(el('div', 'height:1px;background:var(--vscode-widget-border,rgba(255,255,255,0.1));margin:2px 0;'));

            const inputStyle = 'width:140px;padding:4px 8px;font-size:11px;border-radius:5px;border:1px solid var(--vscode-input-border,#334155);background:var(--vscode-input-background,#0f172a);color:var(--vscode-input-foreground,#f3f4f6);outline:none;box-sizing:border-box;';

            // FA Font
            const faInput = el('input', inputStyle, null, { id: 'rtl-panel-fa-font', ariaLabel: 'Persian and Arabic font', type: 'text', placeholder: 'Default: Vazirmatn', value: state.faFont });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [
                el('span', 'font-size:11px;white-space:nowrap;', 'FA Font', { title: 'Persian/Arabic Font' }),
                faInput
            ]));

            // EN Font
            const enInput = el('input', inputStyle, null, { id: 'rtl-panel-en-font', ariaLabel: 'English font', type: 'text', placeholder: 'Default: System', value: state.enFont });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [
                el('span', 'font-size:11px;white-space:nowrap;', 'EN Font', { title: 'English UI Font' }),
                enInput
            ]));

            // Code Font
            const codeInput = el('input', inputStyle, null, { id: 'rtl-panel-code-font', ariaLabel: 'Code font', type: 'text', placeholder: 'Monaco, Consolas', value: state.codeFont });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;', [
                el('span', 'font-size:11px;white-space:nowrap;', 'Code Font', { title: 'Monaco Editor & Terminal Font' }),
                codeInput
            ]));

            // Line Height
            const lhInput = el('input', 'width:85px;cursor:pointer;', null, { id: 'rtl-panel-lh', ariaLabel: 'Line height', type: 'range', min: '1.2', max: '2.5', step: '0.1', value: state.lh });
            const lhReset = el('button', 'background:none;border:none;color:inherit;opacity:0.6;cursor:pointer;padding:0;font-size:10px;', '↺', { id: 'rtl-panel-lh-reset', type: 'button', title: 'Reset to 1.6' });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;', [
                el('span', 'font-size:11px;', 'Line Height'),
                el('div', 'display:flex;align-items:center;gap:6px;', [lhInput, lhReset])
            ]));

            // Font Size
            const fsInput = el('input', 'width:85px;cursor:pointer;', null, { id: 'rtl-panel-fs', ariaLabel: 'Font size', type: 'range', min: '11', max: '22', step: '1', value: state.fs });
            const fsReset = el('button', 'background:none;border:none;color:inherit;opacity:0.6;cursor:pointer;padding:0;font-size:10px;', '↺', { id: 'rtl-panel-fs-reset', type: 'button', title: 'Reset to 16px' });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;', [
                el('span', 'font-size:11px;', 'Font Size'),
                el('div', 'display:flex;align-items:center;gap:6px;', [fsInput, fsReset])
            ]));

            panelBody.appendChild(el('div', 'height:1px;background:var(--vscode-widget-border,rgba(255,255,255,0.1));margin:2px 0;'));

            // Shift+2 for @
            const atLabel = el('span', 'font-size:11px;color:var(--vscode-descriptionForeground,#94a3b8);', 'Shift+2 for @', { title: 'Type @ using Shift+2 in Persian layout' });
            const atKnob = el('span', `display:block;width:12px;height:12px;border-radius:50%;background:#ffffff;position:absolute;top:3px;left:${state.fixAtSign ? '19px' : '3px'};transition:left 0.2s;`, null, { id: 'rtl-panel-at-knob' });
            const atBtn = el('button', `cursor:pointer;width:34px;height:18px;border-radius:9px;border:none;background:${state.fixAtSign ? 'var(--vscode-button-background, #3b82f6)' : '#64748b'};position:relative;padding:0;outline:none;transition:background 0.2s;`, [atKnob], { id: 'rtl-panel-at-btn', type: 'button', role: 'switch', ariaLabel: 'Shift+2 for @', ariaChecked: String(state.fixAtSign) });
            panelBody.appendChild(el('div', 'display:flex;align-items:center;justify-content:space-between;', [atLabel, atBtn]));

            panel.appendChild(panelBody);

            // 4. Footer
            const footerLink = el('a', 'font-size:10px;color:var(--vscode-textLink-foreground,#38bdf8);text-decoration:none;opacity:0.8;', 'github.com/sinaojaghi', { href: 'https://github.com/sinaojaghi', target: '_blank', rel: 'noopener noreferrer' });
            const footer = el('div', 'margin-top:10px;padding-top:8px;border-top:1px solid var(--vscode-widget-border,rgba(255,255,255,0.1));text-align:center;', [footerLink]);
            panel.appendChild(footer);

            document.body.appendChild(panel);

            // Bind events
            closeBtn.addEventListener('click', closeSettingsPanel);
            masterBtn.addEventListener('click', () => { setRTLActive(!state.isRTL); });
            forceBtn.addEventListener('click', () => {
                state.forceRTL = !state.forceRTL;
                saveConfig();
                updateUI();
            });
            atBtn.addEventListener('click', () => {
                state.fixAtSign = !state.fixAtSign;
                saveConfig();
                updateUI();
            });

            faInput.addEventListener('input', (e) => {
                state.faFont = e.target.value.trim();
                saveConfig();
                updateDynamicCSS();
            });
            enInput.addEventListener('input', (e) => {
                state.enFont = e.target.value.trim();
                saveConfig();
                updateDynamicCSS();
            });
            codeInput.addEventListener('input', (e) => {
                state.codeFont = e.target.value.trim();
                saveConfig();
                updateDynamicCSS();
            });
            lhInput.addEventListener('input', (e) => {
                state.lh = e.target.value;
                saveConfig();
                updateDynamicCSS();
            });
            lhReset.addEventListener('click', () => {
                state.lh = '1.6';
                lhInput.value = '1.6';
                saveConfig();
                updateDynamicCSS();
            });
            fsInput.addEventListener('input', (e) => {
                state.fs = e.target.value;
                saveConfig();
                updateDynamicCSS();
            });
            fsReset.addEventListener('click', () => {
                state.fs = '16';
                fsInput.value = '16';
                saveConfig();
                updateDynamicCSS();
            });

            return panel;
        }

        function toggleSettingsPanel() {
            const panel = ensureSettingsPanel();
            if (panel.style.display === 'block') {
                closeSettingsPanel();
            } else {
                updateUI();
                panel.style.display = 'block';
                document.getElementById('antigravity-rtl-statusbar-btn')?.setAttribute('aria-expanded', 'true');
                document.getElementById('rtl-panel-close-btn').focus();
            }
        }

        function updateUI() {
            updateDynamicCSS();
            updateDir();

            // Update Status Bar Item
            const statusLink = document.getElementById('antigravity-rtl-statusbar-btn');
            if (statusLink) {
                const label = state.isRTL ? '⇄ RTL: On' : '⇄ RTL: Off';
                if (statusLink.textContent !== label) statusLink.textContent = label;
                statusLink.style.color = state.isRTL ? '#38bdf8' : 'inherit';
            }

            // Update Panel State
            const toggleLabel = document.getElementById('rtl-panel-toggle-label');
            if (toggleLabel) toggleLabel.textContent = state.isRTL ? 'Enabled' : 'Disabled';

            const masterBtn = document.getElementById('rtl-panel-master-btn');
            const masterKnob = document.getElementById('rtl-panel-master-knob');
            if (masterBtn && masterKnob) {
                masterBtn.setAttribute('aria-checked', String(state.isRTL));
                masterBtn.style.background = state.isRTL ? 'var(--vscode-button-background, #3b82f6)' : '#64748b';
                masterKnob.style.left = state.isRTL ? '21px' : '3px';
            }

            const panelBody = document.getElementById('rtl-panel-body');
            if (panelBody) {
                panelBody.querySelectorAll('button, input').forEach(input => { input.disabled = !state.isRTL; });
                panelBody.style.opacity = state.isRTL ? '1' : '0.4';
                panelBody.style.pointerEvents = state.isRTL ? 'auto' : 'none';
            }

            const forceBtn = document.getElementById('rtl-panel-force-btn');
            const forceKnob = document.getElementById('rtl-panel-force-knob');
            if (forceBtn && forceKnob) {
                forceBtn.setAttribute('aria-checked', String(state.forceRTL));
                forceBtn.style.background = state.forceRTL ? 'var(--vscode-button-background, #3b82f6)' : '#64748b';
                forceKnob.style.left = state.forceRTL ? '19px' : '3px';
            }

            const atBtn = document.getElementById('rtl-panel-at-btn');
            const atKnob = document.getElementById('rtl-panel-at-knob');
            if (atBtn && atKnob) {
                atBtn.setAttribute('aria-checked', String(state.fixAtSign));
                atBtn.style.background = state.fixAtSign ? 'var(--vscode-button-background, #3b82f6)' : '#64748b';
                atKnob.style.left = state.fixAtSign ? '19px' : '3px';
            }
        }

        function setRTLActive(active) {
            state.isRTL = active;
            saveConfig();
            updateUI();
        }

        function tryInsertStatusBarItem() {
            const statusBar = document.querySelector('.part.statusbar .right-items, [id="workbench.parts.statusbar"] .right-items') ||
                document.querySelector('.part.statusbar, [id="workbench.parts.statusbar"]');
            const target = options.kind === 'ide' && statusBar ? statusBar : document.body;
            let button = document.getElementById('antigravity-rtl-statusbar-btn');
            if (!button) {
                button = el('button', '', state.isRTL ? '⇄ RTL: On' : '⇄ RTL: Off', {
                    id: 'antigravity-rtl-statusbar-btn', type: 'button',
                    title: 'RTLAntigravity settings (Alt+R toggles RTL)',
                    ariaLabel: 'RTLAntigravity settings', ariaExpanded: 'false',
                    ariaControls: 'antigravity-rtl-settings-panel'
                });
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    toggleSettingsPanel();
                });
            }
            if (button.parentNode !== target) {
                button.style.cssText = 'font-family:system-ui,sans-serif;font-size:12px;cursor:pointer;padding:4px 9px;border:1px solid #64748b;border-radius:6px;color:#e2e8f0;background:#1e293b;direction:ltr;';
                if (target === document.body) {
                    button.style.cssText += 'position:fixed;right:12px;bottom:12px;z-index:100001;';
                }
                target.appendChild(button);
            }
        }

        document.addEventListener('click', event => {
            if (!event.target.closest?.(ownUI)) closeSettingsPanel();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeSettingsPanel();
            if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyR' && !event.repeat) {
                event.preventDefault();
                setRTLActive(!state.isRTL);
            }
        });
        document.addEventListener('keydown', event => {
            if (!state.isRTL || !state.fixAtSign || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
            if (event.code !== 'Digit2' || !event.shiftKey || !['٬', '،'].includes(event.key)) return;
            const input = event.target;
            if (!input || input.closest?.(protectedSelector + ', ' + ownUI)) return;
            const plainInput = input.matches?.('textarea, input[type="text"], input[type="search"], input:not([type])');
            if ((!plainInput && !input.isContentEditable) || input.readOnly || input.disabled) return;
            event.preventDefault();
            // execCommand retains the editor undo history and framework input events.
            if (document.execCommand?.('insertText', false, '@')) return;
            if (plainInput && typeof input.selectionStart === 'number') {
                input.setRangeText('@', input.selectionStart, input.selectionEnd, 'end');
                input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '@' }));
            }
        }, { capture: true });

        let domUpdateTimer = null;
        function scheduleDOMUpdate() {
            if (domUpdateTimer !== null) return;
            domUpdateTimer = setTimeout(() => {
                domUpdateTimer = null;
                updateDir();
                tryInsertStatusBarItem();
            }, 100);
        }
        document.body.addEventListener('input', updateDir, { capture: true });
        document.body.addEventListener('focusin', scheduleDOMUpdate, { capture: true });
        const observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => {
                const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
                return !target?.closest(ownUI);
            })) scheduleDOMUpdate();
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
        updateUI();
        tryInsertStatusBarItem();
    }
    const initialize = () => {
        try { init(); }
        catch (error) {
            delete window.__antigravity_rtl_injected;
            console.error('[RTLAntigravity] Could not initialize settings.', error);
        }
    };
    if (document.body) initialize();
    else document.addEventListener('DOMContentLoaded', initialize, { once: true });
}

