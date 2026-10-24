'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MASK_BASE64 = [
'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'
].join('');

const SOURCE_SIZE = 512;
const BYTES_PER_ROW = SOURCE_SIZE / 8;
const PINK = [218, 74, 129, 255];
const CREAM = [248, 245, 240, 255];
const mask = zlib.inflateSync(Buffer.from(MASK_BASE64, 'base64'));

if (mask.length !== SOURCE_SIZE * BYTES_PER_ROW) throw new Error(`Mascara da marca invalida: ${mask.length} bytes.`);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function maskAt(x, y) {
  if (x < 0 || y < 0 || x >= SOURCE_SIZE || y >= SOURCE_SIZE) return false;
  const byte = mask[(y * BYTES_PER_ROW) + (x >> 3)];
  return (byte & (1 << (7 - (x & 7)))) !== 0;
}

function createPng({ size = 512, logoScale = 1, background = null }) {
  const rowLength = 1 + (size * 4);
  const raw = Buffer.alloc(rowLength * size);
  const logoSize = Math.max(1, Math.round(size * logoScale));
  const offset = Math.floor((size - logoSize) / 2);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const px = rowStart + 1 + (x * 4);
      const inside = x >= offset && y >= offset && x < offset + logoSize && y < offset + logoSize;
      let isLogo = false;
      if (inside) {
        const sx = Math.min(SOURCE_SIZE - 1, Math.floor(((x - offset) * SOURCE_SIZE) / logoSize));
        const sy = Math.min(SOURCE_SIZE - 1, Math.floor(((y - offset) * SOURCE_SIZE) / logoSize));
        isLogo = maskAt(sx, sy);
      }
      const rgba = isLogo ? PINK : (background || [0, 0, 0, 0]);
      raw[px] = rgba[0]; raw[px + 1] = rgba[1]; raw[px + 2] = rgba[2]; raw[px + 3] = rgba[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ROOT = path.resolve(__dirname, '..');
const assets = [
  ['assets/icon.png', createPng({ background: CREAM })],
  ['assets/splash-icon.png', createPng({ logoScale: 0.9 })],
  ['assets/favicon.png', createPng({ size: 256, background: CREAM })],
  ['assets/adaptive-icon.png', createPng({ logoScale: 0.82 })],
  ['assets/branding/cegonha-mark.png', createPng({ logoScale: 0.95 })],
];

for (const [relativePath, bytes] of assets) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  if (!current || !current.equals(bytes)) fs.writeFileSync(filePath, bytes);
}

console.log('Identidade visual do Cegonha preparada com PNGs validados e CRC correto.');
