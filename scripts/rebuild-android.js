'use strict';

const { spawnSync } = require('node:child_process');

function executar(comando, args, env = process.env) {
  const resultado = spawnSync(comando, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (resultado.status !== 0) process.exit(resultado.status || 1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('\n=== Cegonha · rebuild Android opcional ===');
console.log('[1/3] Instalando dependências atuais...');
executar(npm, ['install', '--no-audit', '--no-fund']);

console.log('\n[2/3] Validando TypeScript...');
executar(npm, ['run', 'typecheck']);

console.log('\n[3/3] Gerando development build limpa no EAS...');
console.log('Use esta APK apenas quando precisar testar Google Sign-In nativo ou push remoto.');
console.log('O OCR.Space funciona no Expo Go e NÃO precisa desta build.\n');
executar(npx, ['eas-cli@latest', 'build', '--profile', 'development', '-p', 'android', '--clear-cache']);

console.log('\nBuild enviada. Quando o EAS terminar, instale a APK no celular.');
console.log('Para abrir essa APK de desenvolvimento use: npm run dev');
console.log('Para o desenvolvimento normal e OCR use: npm start\n');
