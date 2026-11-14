const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fileURLToPath } = require('node:url');
const { randomBytes } = require('node:crypto');

const defaults = Object.freeze({
    faFont: '', enFont: '', codeFont: '', lh: '1.6', fs: '16',
    isRTL: true, forceRTL: false, fixAtSign: true
});
const attached = new WeakSet();

function sanitizeConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const key of ['isRTL', 'forceRTL', 'fixAtSign']) {
        if (Object.hasOwn(value, key) && typeof value[key] === 'boolean') result[key] = value[key];
    }
    for (const key of ['faFont', 'enFont', 'codeFont']) {
        if (Object.hasOwn(value, key) && typeof value[key] === 'string') result[key] = value[key].replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 128);
    }
    for (const [key, min, max] of [['lh', 1.2, 2.5], ['fs', 11, 22]]) {
        if (!Object.hasOwn(value, key) || !['number', 'string'].includes(typeof value[key]) || value[key] === '') continue;
        const number = Number(value[key]);
        if (Number.isFinite(number)) result[key] = String(Math.min(max, Math.max(min, number)));
    }
    return result;
}

function isTrustedURL(value, options) {
    try {
        const parsed = new URL(value);
        if (options.kind !== 'ide') {
            const expected = new URL(options.expectedURL);
            return ['http:', 'https:'].includes(parsed.protocol) &&
                ['127.0.0.1', '[::1]', 'localhost'].includes(parsed.hostname) &&
                parsed.origin === expected.origin;
        }
        if (!['file:', 'vscode-file:'].includes(parsed.protocol) || !options.localAppDirectory) return false;
        if (parsed.protocol === 'vscode-file:' && parsed.hostname !== 'vscode-app') return false;
        if (parsed.protocol === 'file:' && parsed.hostname && parsed.hostname !== 'localhost') return false;
        const localURL = new URL('file://' + parsed.pathname);
        const localFile = fileURLToPath(localURL);
        const relative = path.relative(path.resolve(options.localAppDirectory), localFile);
        return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative) &&
            /^workbench(?:-jetski-agent)?\.html$/i.test(path.basename(localFile));
    } catch {
        return false;
    }
}

function readConfig(configPath) {
    try {
        return { ...defaults, ...sanitizeConfig(JSON.parse(fs.readFileSync(configPath, 'utf8'))) };
    } catch (error) {
        if (error.code !== 'ENOENT') console.warn('[RTLAntigravity] Settings could not be read. Using defaults.', error.message);
        return { ...defaults };
    }
}

function saveConfig(configPath, changes) {
    let existing = {};
    if (fs.existsSync(configPath)) {
        try {
            existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
            fs.copyFileSync(configPath, configPath + '.invalid-' + Date.now() + '-' + randomBytes(4).toString('hex'), fs.constants.COPYFILE_EXCL);
        }
    }
    const merged = { ...defaults, ...sanitizeConfig(existing), ...sanitizeConfig(changes) };
    const temporary = configPath + '.' + process.pid + '.' + randomBytes(6).toString('hex') + '.tmp';
    try {
        fs.writeFileSync(temporary, JSON.stringify(merged, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, configPath);
    } finally {
        fs.rmSync(temporary, { force: true });
    }
    return merged;
}

function consoleDetails(event, args) {
    if (typeof event?.message === 'string') return event;
    if (args[0] && typeof args[0] === 'object') return args[0];
    return { message: args[1], sourceId: args[3] };
}

function attach(contents, options = {}) {
    if (!contents || attached.has(contents)) return;
    attached.add(contents);
    const assetDirectory = options.assetDirectory || __dirname;
    const configPath = options.configPath || path.join(os.homedir(), '.antigravity-rtl.json');
    const savePrefix = 'RTLANTIGRAVITY_CONFIG|' + randomBytes(24).toString('hex') + '|';

    const onConsole = (event, ...args) => {
        const details = consoleDetails(event, args);
        if (typeof details.message !== 'string' || !details.message.startsWith(savePrefix)) return;
        if (contents.isDestroyed() || !isTrustedURL(contents.getURL(), options)) return;
        if (details.frame && details.frame !== contents.mainFrame) return;
        try {
            if (details.message.length > 4096) throw new Error('Settings message is too large.');
            saveConfig(configPath, JSON.parse(details.message.slice(savePrefix.length)));
        } catch (error) {
            console.error('[RTLAntigravity] Could not save settings.', error.message);
        }
    };
    const inject = async () => {
        if (contents.isDestroyed() || !isTrustedURL(contents.getURL(), options)) return;
        try {
            const source = fs.readFileSync(path.join(assetDirectory, 'antigravity-rtl-client.js'), 'utf8');
            const fontBase64 = fs.readFileSync(path.join(assetDirectory, 'Vazirmatn-Variable.woff2')).toString('base64');
            const settings = { config: readConfig(configPath), fontBase64, savePrefix, kind: options.kind || 'app' };
            await contents.executeJavaScript(`(${source})(${JSON.stringify(settings)});`);
        } catch (error) {
            console.error('[RTLAntigravity] Could not initialize RTL.', error.message);
        }
    };
    contents.on('console-message', onConsole);
    contents.on('dom-ready', inject);
    contents.once('destroyed', () => {
        contents.removeListener('console-message', onConsole);
        contents.removeListener('dom-ready', inject);
        attached.delete(contents);
    });
}

module.exports = { attach, sanitizeConfig, isTrustedURL, readConfig, saveConfig, consoleDetails };
