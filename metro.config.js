const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O OCR agora usa OCR.Space por HTTP e funciona no Expo Go, sem módulo nativo.
// Somente recursos realmente nativos continuam substituídos por stubs no modo
// Expo Go: push remoto e Google Sign-In nativo.
const modoExpoGo = process.env.CEGONHA_EXPO_GO === '1';

const aliasesExpoGo = {
  'expo-notifications': path.resolve(__dirname, 'stubs/expo-notifications.js'),
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
