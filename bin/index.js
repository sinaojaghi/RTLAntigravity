#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

export function parseOptions(args) {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
        app: { type: 'boolean' }, ide: { type: 'boolean' },
        restore: { type: 'boolean', short: 'r' }, path: { type: 'string' },
        check: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' }
    } });
    if (positionals.length > 1 || (values.path && positionals.length)) {
        throw new Error('Supply one installation path using --path or a positional argument.');
    }
    values.path ??= positionals[0];
    if (values.path !== undefined && (!values.path.trim() || values.path.startsWith('--'))) {
        throw new Error('--path requires an installation directory or app.asar filename.');
    }
    if (values.check && values.restore) throw new Error('Choose --check or --restore.');
    if (values.path && values.app && values.ide) throw new Error('Choose one target for a custom path.');
    return values;
}

function help() {
    console.log(`RTLAntigravity ${pkg.version}
https://github.com/sinaojaghi

Usage
  node bin/index.js [options] [installation path]

Options
  --app             Target the standalone app
  --ide             Target the IDE
  --path <path>     Select an installation or app.asar explicitly
  --check           Inspect detected installations without applying a patch
  -r, --restore     Restore the original application files
  -h, --help        Print this help
  -v, --version     Print the package version

Without a target flag, both installed editions are processed.
Close Antigravity completely before applying or restoring the patch.
Local execution uses only the installed Node.js runtime.`);
}

export async function main(args = process.argv.slice(2)) {
    const options = parseOptions(args);
    if (options.help) return help();
    if (options.version) return console.log(pkg.version);
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js 22.12 or newer is required. Download it from https://nodejs.org/');
    const app = await import('./patch-app.js');
    const ide = await import('./patch-ide.js');
    const targets = [];
    if (options.path) {
        const customPath = path.resolve(options.path);
        const idePath = ide.resolveIdeAppDir(customPath);
        const appPath = app.resolveAppAsarPath(customPath);
        if (options.ide || (!options.app && idePath)) {
            if (!idePath) throw new Error(`Antigravity IDE was not found at ${customPath}`);
            targets.push({ label: 'Antigravity IDE', path: idePath, api: ide, kind: 'Ide' });
        } else {
            if (!appPath) throw new Error(`Antigravity app.asar was not found at ${customPath}`);
            targets.push({ label: 'Antigravity App', path: appPath, api: app, kind: 'App' });
        }
    } else {
        const both = options.app === options.ide;
        const appPath = (both || options.app) && app.detectAppAsarPath();
        const idePath = (both || options.ide) && ide.detectIdeAppPath();
        if (appPath) targets.push({ label: 'Antigravity App', path: appPath, api: app, kind: 'App' });
        if (idePath) targets.push({ label: 'Antigravity IDE', path: idePath, api: ide, kind: 'Ide' });
    }
    if (!targets.length) throw new Error('No matching Antigravity installation found. Use --path with its installation directory.');
    console.log(`RTLAntigravity ${pkg.version} · https://github.com/sinaojaghi`);
    if (!options.check) console.log('Antigravity must be fully closed while application files are updated.');
    let failed = false;
    for (const target of targets) {
        console.log(`\n${target.label}\n${target.path}`);
        try {
            if (options.check) {
                console.log(JSON.stringify(await target.api[`inspect${target.kind}`](target.path), null, 2));
            } else {
                const action = options.restore ? 'restore' : 'patch';
                const result = await target.api[`${action}${target.kind}`](target.path);
                if (result === false) throw new Error(`${action} did not complete.`);
                console.log(options.restore ? 'Restore completed.' : 'Patch completed. Reopen Antigravity and use the RTL settings button.');
            }
        } catch (error) {
            failed = true;
            console.error(`${target.label}: ${error.message}`);
            if (['EACCES', 'EPERM'].includes(error.code)) console.error('Close the app and retry. For a system installation, use an elevated terminal.');
        }
    }
    if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch(error => {
        console.error(`RTLAntigravity: ${error.message}`);
        process.exitCode = 1;
    });
}
