'use strict';

const { spawn } = require('node:child_process');

const modo = process.argv[2] === 'dev' ? 'dev' : 'go';
const extras = process.argv.slice(3);
const env = { ...process.env };

if (modo === 'dev') env.CEGONHA_NATIVE_RUNTIME = '1';
else delete env.CEGONHA_NATIVE_RUNTIME;

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['expo', 'start', modo === 'dev' ? '--dev-client' : '--go', '--clear', '--port', '19002', ...extras];

console.log(`\n[Cegonha] Iniciando em modo ${modo === 'dev' ? 'development build' : 'Expo Go'}...`);
if (modo === 'go') {
  console.log('[Cegonha] Push remoto e ML Kit ficam desativados neste modo para evitar erros de módulos nativos.');
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
