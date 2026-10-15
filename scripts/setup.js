'use strict';

const { spawnSync } = require('node:child_process');

function executar(comando, args) {
  const resultado = spawnSync(comando, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (resultado.status !== 0) process.exit(resultado.status || 1);
}

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < 20) {
  console.error('\n[Cegonha] Use Node.js 20 ou 22 para evitar conflitos com o Expo.');
  console.error(`[Cegonha] Versao atual: ${process.version}\n`);
  process.exit(1);
}

console.log('\n=== Cegonha · configuracao simples ===');
console.log(`[1/2] Node ${process.version} OK`);
console.log('[2/2] Instalando/ajustando dependencias...\n');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
executar(npm, ['install', '--no-audit', '--no-fund']);

console.log('\nVerificando TypeScript...\n');
executar(npm, ['run', 'typecheck']);

console.log('\n=== Pronto ===');
console.log('Para abrir rapidamente no Expo Go:');
console.log('  npm start');
console.log('');
console.log('Para OCR (Google ML Kit) + push completos, use uma development build:');
console.log('  npm run build:android    # somente quando precisar gerar/atualizar o APK');
console.log('  npm run dev              # nas proximas vezes');
console.log('');
console.log('Firebase basico (nao exige Cloud Functions/Blaze):');
console.log('  npm run firebase:deploy');
console.log('');
console.log('Backend de push (opcional e exige Firebase Blaze):');
console.log('  npm run firebase:deploy:push');
console.log('');
