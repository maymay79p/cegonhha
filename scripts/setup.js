'use strict';

const { spawnSync } = require('node:child_process');

function executar(comando, args) {
  const resultado = spawnSync(comando, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (resultado.status !== 0) process.exit(resultado.status || 1);
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (!Number.isFinite(major) || major < 22 || (major === 22 && minor < 13)) {
  console.error('\n[Cegonha] O Expo SDK 57 precisa de Node.js 22.13 ou mais recente.');
  console.error(`[Cegonha] Versão atual: ${process.version}\n`);
  process.exit(1);
}

console.log('\n=== Cegonha · configuração simples ===');
console.log(`[1/4] Node ${process.version} OK`);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[2/4] Instalando dependências exatamente como validadas no lockfile...\n');
executar(npm, ['ci', '--no-audit', '--no-fund']);

console.log('\n[3/4] Conferindo compatibilidade das versões com o Expo...\n');
executar(npx, ['expo', 'install', '--check']);

console.log('\n[4/4] Verificando TypeScript...\n');
executar(npm, ['run', 'typecheck']);

console.log('\n=== Pronto ===');
console.log('Modo recomendado para desenvolver e testar, inclusive OCR.Space:');
console.log('  npm start');
console.log('');
console.log('O npm start usa Expo Go. Não precisa gerar APK para testar o OCR.');
console.log('');
console.log('Somente Google Sign-In nativo e push remoto precisam da development build:');
console.log('  npm run rebuild:android');
console.log('  npm run dev');
console.log('');
console.log('Firebase básico (regras, sem Functions/Blaze):');
console.log('  npm run firebase:deploy');
console.log('');
