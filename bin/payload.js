/* ANTIGRAVITY RTL PATCH */
require('./antigravity-rtl-runtime.cjs').attach(win.webContents, { expectedURL: url, kind: 'app' });
void win.loadURL(url);
