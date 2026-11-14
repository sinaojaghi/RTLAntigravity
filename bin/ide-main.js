// Copied to antigravity-rtl-main.cjs for both ESM and CommonJS IDE entry points.
const { app } = require('electron');
const path = require('node:path');
const { attach } = require('./antigravity-rtl-runtime.cjs');

app.on('web-contents-created', (_event, contents) => {
    attach(contents, {
        kind: 'ide',
        assetDirectory: __dirname,
        localAppDirectory: path.resolve(__dirname, '..')
    });
});
