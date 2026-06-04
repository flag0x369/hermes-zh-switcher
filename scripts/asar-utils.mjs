import crypto from 'node:crypto';
import fs from 'node:fs';

export const INJECTION_START = '<!-- hermes-zh-switcher:start -->';
export const INJECTION_END = '<!-- hermes-zh-switcher:end -->';
export const UI_SCRIPT_PATH = 'dist/hermes-zh-ui.js';
export const INDEX_PATH = 'dist/index.html';

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function readAsar(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const pickleSize = head.readUInt32LE(4);
    const jsonLen = head.readUInt32LE(12);
    const headerBuf = Buffer.alloc(jsonLen);
    fs.readSync(fd, headerBuf, 0, jsonLen, 16);
    const header = JSON.parse(headerBuf.toString('utf8'));
    const dataStart = 8 + pickleSize;
    const files = new Map();

    function walk(node, prefix = '') {
      if (!node.files) return;
      for (const [name, child] of Object.entries(node.files)) {
        const filePathInAsar = prefix ? `${prefix}/${name}` : name;
        if (child.files) {
          walk(child, filePathInAsar);
          continue;
        }
        const size = Number(child.size || 0);
        const buf = Buffer.alloc(size);
        fs.readSync(fd, buf, 0, size, dataStart + Number(child.offset || 0));
        files.set(filePathInAsar, buf);
      }
    }

    walk(header);
    return { header, files };
  } finally {
    fs.closeSync(fd);
  }
}

function integrityFor(buf) {
  const blockSize = 4 * 1024 * 1024;
  const blocks = [];
  for (let i = 0; i < buf.length; i += blockSize) {
    blocks.push(crypto.createHash('sha256').update(buf.subarray(i, i + blockSize)).digest('hex'));
  }
  if (blocks.length === 0) {
    blocks.push(crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
  }
  return {
    algorithm: 'SHA256',
    hash: sha256(buf),
    blockSize,
    blocks
  };
}

export function packAsar(archive, outPath) {
  const chunks = [];
  let offset = 0;

  function rebuild(node, prefix = '') {
    const next = {};
    for (const [name, child] of Object.entries(node.files || {})) {
      const filePathInAsar = prefix ? `${prefix}/${name}` : name;
      if (child.files) {
        const rebuilt = rebuild(child, filePathInAsar);
        if (Object.keys(rebuilt).length > 0) next[name] = { ...child, files: rebuilt };
        continue;
      }
      if (!archive.files.has(filePathInAsar)) continue;
      const buf = archive.files.get(filePathInAsar);
      const fileNode = { ...child, size: buf.length, offset: String(offset), integrity: integrityFor(buf) };
      chunks.push(buf);
      offset += buf.length;
      next[name] = fileNode;
    }
    return next;
  }

  function ensureHeaderPath(filePathInAsar) {
    const parts = filePathInAsar.split('/');
    let node = archive.header;
    for (const part of parts.slice(0, -1)) {
      node.files ||= {};
      node.files[part] ||= { files: {} };
      node = node.files[part];
    }
    node.files ||= {};
    node.files[parts.at(-1)] ||= {};
  }

  for (const filePathInAsar of archive.files.keys()) ensureHeaderPath(filePathInAsar);
  archive.header.files = rebuild(archive.header);

  const headerBuf = Buffer.from(JSON.stringify(archive.header), 'utf8');
  const padding = (4 - (headerBuf.length % 4)) % 4;
  const payloadSize = 4 + headerBuf.length + padding;
  const pickleSize = 4 + payloadSize;
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(pickleSize, 4);
  prefix.writeUInt32LE(payloadSize, 8);
  prefix.writeUInt32LE(headerBuf.length, 12);
  fs.writeFileSync(outPath, Buffer.concat([prefix, headerBuf, Buffer.alloc(padding), ...chunks]));
}

export function injectIndex(indexHtml) {
  const cleaned = removeIndexInjection(indexHtml);
  const tag = [
    INJECTION_START,
    '    <script src="./hermes-zh-ui.js"></script>',
    `    ${INJECTION_END}`
  ].join('\n');
  const moduleScriptRe = /<script\b(?=[^>]*\btype=["']module["'])[^>]*><\/script>/i;
  if (moduleScriptRe.test(cleaned)) {
    return cleaned.replace(moduleScriptRe, `${tag}\n    $&`);
  }
  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', `${tag}\n  </head>`);
  }
  return `${tag}\n${cleaned}`;
}

export function removeIndexInjection(indexHtml) {
  const escapedStart = INJECTION_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = INJECTION_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\s*${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, 'g');
  return indexHtml
    .replace(re, '\n')
    .replace(/\s*<script\s+src=["']\.\/hermes-zh-ui\.js["']><\/script>\s*/g, '\n');
}

export function hasInjection(archive) {
  const index = archive.files.get(INDEX_PATH)?.toString('utf8') || '';
  return index.includes(INJECTION_START) && archive.files.has(UI_SCRIPT_PATH);
}
