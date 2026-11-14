import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseOptions } from '../bin/index.js';

const cli = fileURLToPath(new URL('../bin/index.js', import.meta.url));

test('CLI rejects invalid combinations before touching an installation', () => {
    for (const args of [['--path'], ['--unknown'], ['--check', '--restore'], ['--app', '--ide', '--path', 'app'], ['one', 'two'], ['--path', 'one', 'two']]) {
        assert.throws(() => parseOptions(args));
    }
    assert.equal(parseOptions(['--path', 'a path with spaces', '--app']).path, 'a path with spaces');
    assert.equal(parseOptions(['-r', '--ide']).restore, true);
    assert.equal(parseOptions(['somewhere']).path, 'somewhere');
});

test('help works from outside the package and invalid arguments exit nonzero', () => {
    const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /github\.com\/sinaojaghi/);
    assert.match(help.stdout, /--check/);
    const invalid = spawnSync(process.execPath, [cli, '--path'], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /path/);
});
