(() => {
    const editable = '[contenteditable="true"]';
    const composer = `:is(.tiptap${editable}, .ProseMirror${editable}, [data-testid="chat-input"]${editable}, [data-testid="chat-input"] ${editable}, [data-testid="user-message"] ${editable}, textarea[data-testid="chat-input"], [data-testid="chat-input"] textarea)`;
    const inputSelector = `${composer}, ${composer} p`;
    const assistant = ':is(.font-claude-message, .font-claude-response-body, .standard-markdown, .streaming-markdown, [data-testid="assistant-message"])';
    const user = '[data-testid="user-message"]';
    const prose = ':is(p, li, h1, h2, h3, h4, h5, h6, th, td)';
    const outputSelector = [
        `${assistant} ${prose}`,
        `${assistant}:not(:has(${prose}, pre, code, button, ${editable}))`,
        `${user} ${prose}`,
        `${user} .whitespace-pre-wrap:not(:has(${prose}, pre, code, ${editable}))`,
        `${user}:not(:has(${prose}, pre, code, button, ${editable}, .whitespace-pre-wrap))`,
        '.font-user-message.whitespace-pre-wrap:not(:has(p, pre, code))'
    ].join(', ');
    const protectedSelector = '.cm-editor, .katex, [role="math"], [role="code"], [data-testid="artifact-panel"]';

    async function start() {
        let config = rtlClaudeAssets.defaults;
        try {
            config = await chrome.storage.local.get(rtlClaudeAssets.defaults);
        } catch (error) {
            console.warn('[RTLAntigravity] Could not load Claude preferences.', error.message);
        }

        // Load the bundled font from bytes. Its range leaves Latin and CJK glyphs to the system fonts.
        const fontBytes = Uint8Array.from(atob(rtlClaudeAssets.fontBase64), character => character.charCodeAt(0));
        const font = new FontFace('RTLAntigravity Persian', fontBytes, {
            weight: '100 900',
            unicodeRange: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF'
        });
        font.load().then(loaded => document.fonts.add(loaded)).catch(error => {
            console.warn('[RTLAntigravity] Could not load Vazirmatn.', error.message);
        });

        const sheet = new CSSStyleSheet();
        document.adoptedStyleSheets.push(sheet);
        installRTLAntigravity({
            kind: 'claude-web', config, inputSelector, outputSelector, protectedSelector,
            applyStyles: styles => sheet.replaceSync(styles),
            saveConfig: changes => {
                chrome.storage.local.set(changes).catch(error => {
                    console.warn('[RTLAntigravity] Could not save Claude preferences.', error.message);
                });
            }
        });
    }

    const observer = new MutationObserver(startIfChat);
    function startIfChat() {
        const candidate = document.querySelector(`${inputSelector}, ${outputSelector}`);
        if (!candidate) return;
        observer.disconnect();
        start().catch(error => console.error('[RTLAntigravity] Could not initialize Claude Web.', error.message));
    }

    observer.observe(document.body, { childList: true, subtree: true });
    startIfChat();
})();
