import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { AppText as Text } from './AppText';
import { useTheme } from '../context/ThemeContext';
import { radius, ThemeColors } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_ROLE_STORAGE_KEY = '@cegonha/google-role';

type Props = {
  tipo: 'morador' | 'porteiro';
  disabled?: boolean;
  onSignedIn: (uid: string) => Promise<void>;
};

function clientIdDaPlataforma() {
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || '';
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || '';
}

export function GoogleSignInButton(props: Props) {
  const configurado = !!clientIdDaPlataforma();
  if (!configurado) return <GoogleNotConfiguredButton {...props} />;
  return <ConfiguredGoogleSignInButton {...props} />;
}

function GoogleNotConfiguredButton({ disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      disabled={disabled}
      onPress={() => Alert.alert(
        'Login com Google',
        'A integração já está preparada no aplicativo, mas falta configurar o Client ID do Google para este ambiente. Consulte a seção “Login com Google” do README.'
      )}
    >
      <Ionicons name="logo-google" size={20} color={colors.text} />
      <Text style={styles.text}>Continuar com Google</Text>
    </TouchableOpacity>
  );
}

function ConfiguredGoogleSignInButton({ tipo, disabled, onSignedIn }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [processando, setProcessando] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    if (!response || response.type !== 'success') return;

    let ativo = true;
    (async () => {
      try {
        setProcessando(true);
        const idToken = response.authentication?.idToken || response.params?.id_token || null;
        const accessToken = response.authentication?.accessToken || response.params?.access_token || null;
        if (!idToken && !accessToken) throw new Error('O Google não retornou um token de autenticação válido.');

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const resultado = await signInWithCredential(auth, credential);
        if (ativo) await onSignedIn(resultado.user.uid);
      } catch (e: any) {
        if (ativo) {
          const codigo = String(e?.code || '');
          const mensagem = codigo.includes('operation-not-allowed')
            ? 'O provedor Google ainda não está habilitado no Firebase Authentication.'
            : e?.message || 'Não foi possível entrar com o Google.';
          Alert.alert('Login com Google', mensagem);
        }
      } finally {
        if (ativo) setProcessando(false);
      }
    })();

    return () => { ativo = false; };
  }, [response, onSignedIn]);

  async function entrar() {
    try {
      setProcessando(true);
      await AsyncStorage.setItem(GOOGLE_ROLE_STORAGE_KEY, tipo);
      await promptAsync();
    } catch (e: any) {
      Alert.alert('Login com Google', e?.message || 'Não foi possível abrir o login do Google.');
      setProcessando(false);
    }
  }

  const ocupado = disabled || processando || !request;

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
