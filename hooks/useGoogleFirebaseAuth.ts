import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, UserCredential, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase';

WebBrowser.maybeCompleteAuthSession();

type Opcoes = {
  onSuccess: (credencial: UserCredential) => Promise<void> | void;
  onError?: (erro: any) => void;
};

export function useGoogleFirebaseAuth({ onSuccess, onError }: Opcoes) {
  const webClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
  const androidClientId = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

  const clientAtual =
    Platform.OS === 'android'
      ? (androidClientId || webClientId)
      : Platform.OS === 'ios'
        ? (iosClientId || webClientId)
        : webClientId;

  const configurado = Boolean(clientAtual);
  const [loading, setLoading] = useState(false);
  const processado = useRef<string | null>(null);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);

  successRef.current = onSuccess;
  errorRef.current = onError;

  const googleRequestConfig = configurado
    ? {
        clientId: webClientId || clientAtual || undefined,
        webClientId: webClientId || undefined,
        androidClientId: androidClientId || webClientId || undefined,
        iosClientId: iosClientId || webClientId || undefined,
        scopes: ['openid', 'profile', 'email'],
        selectAccount: true,
      }
    : undefined;

  const [request, response, promptAsync] = googleRequestConfig
    ? Google.useIdTokenAuthRequest(googleRequestConfig)
    : [null, null, null] as const;

  useEffect(() => {
    if (!response) return;

    if (response.type === 'error') {
      errorRef.current?.(new Error((response as any).error?.message || (response as any).error?.description || 'O Google não conseguiu concluir o login.'));
      return;
    }

    if (response.type !== 'success') return;

    const resposta = response as any;
    const params = resposta?.params || {};
    const autenticacao = resposta?.authentication || {};

    const identificador =
      String(params.state || '') + ':' +
      String(params.id_token || '') + ':' +
      String(params.access_token || '');

    if (processado.current === identificador) return;
    processado.current = identificador;

    async function finalizar() {
      try {
        setLoading(true);
        const idToken = params.id_token || autenticacao.idToken || null;
        const accessToken = params.access_token || autenticacao.accessToken || null;

        if (!idToken) {
          throw new Error('O Google não retornou o token necessário para entrar no Firebase.');
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
        const credencial = await signInWithCredential(auth, credential);
        await successRef.current(credencial);
      } catch (erro) {
        errorRef.current?.(erro);
      } finally {
        setLoading(false);
      }
    }

    finalizar();
  }, [response]);

  async function entrarComGoogle() {
    if (!configurado) {
      const variavel =
        Platform.OS === 'android'
          ? 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
          : Platform.OS === 'ios'
            ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
            : 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

      throw new Error(
        'O login Google está integrado, mas falta configurar ' + variavel +
        ' no .env. O WEB_CLIENT_ID também pode ser usado como fallback.'
      );
    }

    if (!request) {
      throw new Error('O login Google ainda está inicializando. Aguarde alguns segundos e tente novamente.');
    }

    setLoading(true);
    try {
      await promptAsync();
    } finally {
      setLoading(false);
    }
  }

  return {
    entrarComGoogle,
    loading,
    configurado,
    pronto: Boolean(request),
    plataforma: Platform.OS,
  };
}
