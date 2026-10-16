const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O Cegonha usa development build como runtime principal. Nela, os módulos
// nativos reais (OCR, Google Sign-In e push) devem ser resolvidos normalmente.
// Somente o comando `npm run go` define CEGONHA_EXPO_GO=1 e troca esses módulos
// por stubs seguros, permitindo abrir as telas que não dependem de código nativo.
const modoExpoGo = process.env.CEGONHA_EXPO_GO === '1';

const aliasesExpoGo = {
  'expo-notifications': path.resolve(__dirname, 'stubs/expo-notifications.js'),
  'expo-ocr-kit': path.resolve(__dirname, 'stubs/expo-ocr-kit.js'),
  '@react-native-google-signin/google-signin': path.resolve(__dirname, 'stubs/google-signin.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (modoExpoGo && aliasesExpoGo[moduleName]) {
    return {
      filePath: aliasesExpoGo[moduleName],
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
