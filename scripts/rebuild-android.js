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

console.log('\n=== Cegonha · rebuild Android completo ===');
console.log('[1/3] Instalando dependências atuais...');
executar(npm, ['install', '--no-audit', '--no-fund']);

console.log('\n[2/3] Validando TypeScript...');
executar(npm, ['run', 'typecheck']);

console.log('\n[3/3] Gerando development build limpa no EAS...');
console.log('Isso força a APK a incluir OCR, Google Sign-In e Expo Notifications.\n');
executar(npx, ['eas-cli@latest', 'build', '--profile', 'development', '-p', 'android', '--clear-cache']);

console.log('\nBuild enviada. Quando o EAS terminar, instale a APK no celular.');
console.log('Depois, nas próximas vezes, use apenas: npm start\n');
