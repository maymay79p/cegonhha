'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const targets = [
  'assets/icon.png',
  'assets/splash-icon.png',
  'assets/favicon.png',
  'assets/adaptive-icon.png',
  'assets/branding/cegonha-mark.png',
];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const relativePath of targets) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Asset da marca ausente: ${relativePath}`);
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Asset da marca não é um PNG válido: ${relativePath}`);
  }
}

console.log('Identidade visual do Cegonha validada.');
