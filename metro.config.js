const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Por padrão o desenvolvimento local usa Expo Go. Nesse modo, módulos nativos
// que não existem no Expo Go são substituídos por stubs seguros para que o app
// consiga abrir e testar toda a parte JS/Firestore normalmente.
//
// Development/preview/production builds definem CEGONHA_NATIVE_RUNTIME=1 no
// eas.json e usam os módulos nativos reais.
const usarRuntimeNativo = process.env.CEGONHA_NATIVE_RUNTIME === '1';

const aliasesExpoGo = {
  'expo-notifications': path.resolve(__dirname, 'stubs/expo-notifications.js'),
  '@react-native-ml-kit/text-recognition': path.resolve(__dirname, 'stubs/mlkit-text-recognition.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!usarRuntimeNativo && aliasesExpoGo[moduleName]) {
    return {
      filePath: aliasesExpoGo[moduleName],
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
