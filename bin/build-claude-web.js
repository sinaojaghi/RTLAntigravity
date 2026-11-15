import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import runtime from './runtime.cjs';

const source = fileURLToPath(new URL('./', import.meta.url));

export function buildClaudeWeb(outputDirectory) {
    const output = path.resolve(outputDirectory);
    const read = file => fs.readFileSync(path.join(source, file));
    const manifest = read('claude-web/manifest.json');
    const config = {
        defaults: runtime.defaults,
        fontBase64: read('Vazirmatn-Variable.woff2').toString('base64')
    };
    const contentScript = `(() => {\nconst rtlClaudeAssets = ${JSON.stringify(config)};\n${read('client.js')}\n${read('claude-web/content.js')}\n})();\n`;
    const files = new Map([
        ['manifest.json', manifest],
        ['content.js', Buffer.from(contentScript)],
        ['LICENSE', read('../LICENSE')],
        ['OFL-Vazirmatn.txt', read('../OFL-Vazirmatn.txt')]
    ]);

    fs.mkdirSync(output, { recursive: true });
    if (!fs.lstatSync(output).isDirectory()) throw new Error('Choose a regular folder for the Claude Web extension.');
    const entries = fs.readdirSync(output, { withFileTypes: true });
    const manifestPath = path.join(output, 'manifest.json');
    if (entries.length) {
        if (entries.some(entry => !files.has(entry.name) || !entry.isFile()) || !fs.existsSync(manifestPath) ||
            JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name !== JSON.parse(manifest).name) {
            throw new Error(`Choose an empty folder or a previous Claude Web export. Found other files in ${output}.`);
        }
    }

    for (const [name, content] of files) {
        const target = path.join(output, name);
        if (fs.existsSync(target) && fs.readFileSync(target).equals(content)) continue;
        const temporary = `${target}.${randomUUID()}.tmp`;
        try {
            fs.writeFileSync(temporary, content, { flag: 'wx' });
            fs.renameSync(temporary, target);
        } finally {
            fs.rmSync(temporary, { force: true });
        }
    }
    return output;
}
