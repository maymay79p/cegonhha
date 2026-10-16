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
console.log(`[1/2] Node ${process.version} OK`);
console.log('[2/2] Instalando/ajustando dependências...\n');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
executar(npm, ['install', '--no-audit', '--no-fund']);

console.log('\nVerificando TypeScript...\n');
executar(npm, ['run', 'typecheck']);

console.log('\n=== Pronto ===');
console.log('Modo recomendado (APK de desenvolvimento já instalada):');
console.log('  npm start');
console.log('');
console.log('Se OCR/Google disserem que o módulo nativo não existe, gere UMA nova APK limpa:');
console.log('  npm run rebuild:android');
console.log('');
console.log('Expo Go, apenas para telas sem OCR/Google/push:');
console.log('  npm run go');
console.log('');
console.log('Firebase básico (regras, sem Functions/Blaze):');
console.log('  npm run firebase:deploy');
console.log('');
