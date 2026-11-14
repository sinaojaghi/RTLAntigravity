import { createHash } from 'node:crypto';

const sha256 = data => createHash('sha256').update(data).digest('hex');

export function readArchive(buffer) {
    if (buffer.length < 16 || buffer.readUInt32LE(0) !== 4) throw new Error('Invalid ASAR archive header.');
    const headerSize = buffer.readUInt32LE(4);
    const jsonSize = buffer.readUInt32LE(12);
    if (headerSize < 8 || 8 + headerSize > buffer.length || jsonSize > headerSize - 8) throw new Error('Invalid ASAR archive size.');
    const header = JSON.parse(buffer.subarray(16, 16 + jsonSize).toString('utf8'));
    if (!header.files) throw new Error('ASAR archive has no file index.');
    return { header, data: buffer.subarray(8 + headerSize) };
}

function entryAt(header, filename) {
    let entry = header;
    for (const component of filename.split('/')) entry = entry?.files?.[component];
    if (!entry) throw new Error('Unsupported Antigravity layout, missing ' + filename);
    return entry;
}

export function packedFile(archive, filename) {
    const entry = entryAt(archive.header, filename);
    const offset = Number(entry.offset);
    if (entry.unpacked || entry.link || entry.files || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(entry.size) || entry.size < 0 || offset + entry.size > archive.data.length) {
        throw new Error('Unsupported packed ASAR entry ' + filename);
    }
    const bytes = archive.data.subarray(offset, offset + entry.size);
    if (entry.integrity?.algorithm === 'SHA256' && sha256(bytes) !== entry.integrity.hash) throw new Error('ASAR checksum mismatch for ' + filename);
    return bytes;
}

export function changeArchive(archive, replacements) {
    const header = structuredClone(archive.header);
    const buffers = [archive.data];
    let offset = archive.data.length;
    for (const [filename, bytes] of replacements) {
        const components = filename.split('/');
        const basename = components.pop();
        let parent = header;
        for (const component of components) {
            parent.files[component] ??= { files: {} };
            parent = parent.files[component];
            if (!parent.files || parent.unpacked) throw new Error('Cannot inject into ASAR directory ' + component);
        }
        const previous = parent.files[basename];
        if (previous?.unpacked || previous?.link || previous?.files) throw new Error('Cannot replace unpacked or linked entry ' + filename);
        const blockSize = 4 * 1024 * 1024;
        const blocks = [];
        for (let pos = 0; pos < bytes.length; pos += blockSize) blocks.push(sha256(bytes.subarray(pos, pos + blockSize)));
        if (blocks.length === 0) blocks.push(sha256(bytes));
        parent.files[basename] = { ...previous, size: bytes.length, offset: String(offset), integrity: { algorithm: 'SHA256', hash: sha256(bytes), blockSize, blocks } };
        buffers.push(bytes);
        offset += bytes.length;
    }
    // ASAR stores a Chromium Pickle containing its JSON file index.
    const json = Buffer.from(JSON.stringify(header));
    const headerBytes = Buffer.alloc(8 + Math.ceil(json.length / 4) * 4);
    headerBytes.writeUInt32LE(headerBytes.length - 4, 0);
    headerBytes.writeUInt32LE(json.length, 4);
    json.copy(headerBytes, 8);
    const sizeBytes = Buffer.alloc(8);
    sizeBytes.writeUInt32LE(4, 0);
    sizeBytes.writeUInt32LE(headerBytes.length, 4);
    return Buffer.concat([sizeBytes, headerBytes, ...buffers]);
}

export function archiveFingerprint(archive, ignored = new Set()) {
    const entries = [];
    function visit(files, prefix = '') {
        for (const [name, entry] of Object.entries(files)) {
            const filename = prefix + name;
            if (ignored.has(filename)) continue;
            if (entry.files) visit(entry.files, filename + '/');
            else if (entry.link) entries.push([filename, 'link', entry.link]);
            else {
                const digest = entry.unpacked ? entry.integrity?.hash : sha256(packedFile(archive, filename));
                if (!digest) throw new Error('Unpacked ASAR entry has no integrity hash ' + filename);
                entries.push([filename, entry.size, digest]);
            }
        }
    }
    visit(archive.header.files);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return sha256(JSON.stringify(entries));
}
