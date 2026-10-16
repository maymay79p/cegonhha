export const statusCodes = {
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
};

export const GoogleSignin = {
  configure() {},
  async hasPlayServices() { return true; },
  async signIn() {
    const erro = new Error('O login Google é um recurso nativo e não funciona no Expo Go. Para testá-lo, rode npm run rebuild:android uma vez, instale a APK e depois use npm run dev. O restante do app, inclusive o OCR.Space, funciona com npm start.');
    erro.code = 'EXPO_GO_UNSUPPORTED';
    throw erro;
  },
  async signOut() { return null; },
};

export function isSuccessResponse(response) {
  return response?.type === 'success';
}
