import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { AppText as Text } from './AppText';
import { useTheme } from '../context/ThemeContext';
import { radius, ThemeColors } from '../theme';

export const GOOGLE_ROLE_STORAGE_KEY = '@cegonha/google-role';

const DEFAULT_GOOGLE_WEB_CLIENT_ID = '119682503943-7v6ggeoh1v3dmguafiu1jo08kk3gsuk3.apps.googleusercontent.com';
const EM_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let googleConfigurado = false;

type Props = {
  tipo: 'morador' | 'porteiro';
  disabled?: boolean;
  onSignedIn: (uid: string) => Promise<void>;
};

function webClientId() {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID;
}

function garantirConfiguracaoGoogle() {
  if (googleConfigurado || EM_EXPO_GO) return;
  GoogleSignin.configure({
    webClientId: webClientId(),
    offlineAccess: false,
  });
  googleConfigurado = true;
}

function mensagemErroGoogle(e: any) {
  const codigo = String(e?.code || '');
  const mensagem = String(e?.message || '');

  if (codigo === 'EXPO_GO_UNSUPPORTED') {
    return 'O login Google usa o módulo nativo do Android. Gere a development build com “npm run rebuild:android”, instale a APK e depois rode “npm start”.';
  }
  if (codigo === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'O Google Play Services não está disponível ou precisa ser atualizado neste aparelho.';
  }
  if (codigo === statusCodes.IN_PROGRESS) {
    return 'Já existe uma tentativa de login Google em andamento.';
  }
  if (/DEVELOPER_ERROR|\b10\b|configuration/i.test(`${codigo} ${mensagem}`)) {
    return 'O Google recusou a configuração Android desta APK. O package do Cegonha já está definido como com.maymay79p.cegonha. Gere uma APK limpa com “npm run rebuild:android”. Se o erro persistir, a impressão digital SHA-1 da chave usada pelo EAS precisa estar cadastrada no cliente Android do Google/Firebase.';
  }
  if (/network/i.test(mensagem)) {
    return 'Não foi possível concluir o login Google por causa da conexão. Verifique a internet e tente novamente.';
  }
  return mensagem || 'Não foi possível entrar com o Google.';
}

export function GoogleSignInButton({ tipo, disabled, onSignedIn }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [processando, setProcessando] = useState(false);

  async function entrar() {
    if (EM_EXPO_GO) {
      Alert.alert(
        'Login com Google',
        'O Google Sign-In não funciona dentro do Expo Go. Use a development build do Cegonha: rode “npm run rebuild:android” uma vez e, depois de instalar a APK, use “npm start”.'
      );
      return;
    }

    try {
      setProcessando(true);
      garantirConfiguracaoGoogle();
      await AsyncStorage.setItem(GOOGLE_ROLE_STORAGE_KEY, tipo);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const resposta = await GoogleSignin.signIn();
      if (!isSuccessResponse(resposta)) return;

      const idToken = resposta.data.idToken;
      if (!idToken) throw new Error('O Google não retornou o token de identidade necessário para entrar no Firebase.');

      const credential = GoogleAuthProvider.credential(idToken);
      const resultado = await signInWithCredential(auth, credential);
      await onSignedIn(resultado.user.uid);
    } catch (e: any) {
      const codigo = String(e?.code || '');
      if (codigo === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert('Login com Google', mensagemErroGoogle(e));
    } finally {
      setProcessando(false);
    }
  }

  const ocupado = disabled || processando;

  return (
    <TouchableOpacity style={[styles.button, ocupado && styles.disabled]} onPress={entrar} disabled={ocupado}>
      <Ionicons name="logo-google" size={20} color={colors.text} />
      <Text style={styles.text}>{processando ? 'Conectando...' : 'Continuar com Google'}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      minHeight: 50,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      marginTop: 12,
    },
    text: { color: colors.text, fontSize: 16, fontWeight: '700' },
    disabled: { opacity: 0.5 },
  });
}
