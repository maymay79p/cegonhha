'use strict';

const { spawn } = require('node:child_process');

const modo = process.argv[2] === 'go' ? 'go' : 'dev';
const extras = process.argv.slice(3);
const env = { ...process.env };

if (modo === 'go') env.CEGONHA_EXPO_GO = '1';
else delete env.CEGONHA_EXPO_GO;

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['expo', 'start', modo === 'go' ? '--go' : '--dev-client', '--clear', '--port', '19002', ...extras];

console.log(`\n[Cegonha] Iniciando em modo ${modo === 'go' ? 'Expo Go (limitado)' : 'development build (completo)'}...`);
if (modo === 'go') {
  console.log('[Cegonha] OCR, login Google nativo e push remoto ficam desativados no Expo Go.');
} else {
  console.log('[Cegonha] Este é o modo recomendado. A APK de desenvolvimento precisa estar instalada no celular.');
}
console.log('');

const child = spawn(npx, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', code => process.exit(code ?? 0));
child.on('error', error => {
  console.error('[Cegonha] Não foi possível iniciar o Expo:', error.message);
  process.exit(1);
});
