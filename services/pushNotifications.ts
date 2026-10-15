import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const INSTALLATION_KEY = '@cegonha/push-installation-id:v1';
const CHANNEL_ID = 'cegonha-geral';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function obterInstallationId() {
  let installationId = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(INSTALLATION_KEY, installationId);
  }
  return installationId;
}

async function obterDocumentoId() {
  const installationId = await obterInstallationId();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, installationId);
}

export type ResultadoRegistroPush =
  | { status: 'registrado'; token: string }
  | { status: 'sem_permissao' | 'web' | 'sem_project_id' | 'falhou'; erro?: string };

export async function registrarDispositivoPush({
  uid,
  tipo,
  condominioId,
}: {
  uid: string;
  tipo: 'morador' | 'porteiro';
  condominioId: string;
}): Promise<ResultadoRegistroPush> {
  if (Platform.OS === 'web') return { status: 'web' };

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Avisos do Cegonha',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let status = atual.status;
    if (status !== 'granted') {
      const solicitada = await Notifications.requestPermissionsAsync();
      status = solicitada.status;
    }
    if (status !== 'granted') return { status: 'sem_permissao' };

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { status: 'sem_project_id' };

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const documentoId = await obterDocumentoId();

    await setDoc(doc(db, 'pushDispositivos', documentoId), {
      uid,
      tipo,
      condominioId: condominioId || '',
      token,
      plataforma: Platform.OS,
      ativo: true,
      atualizadoEm: serverTimestamp(),
    });

    return { status: 'registrado', token };
  } catch (e: any) {
    return { status: 'falhou', erro: e?.message || String(e) };
  }
}

export async function desregistrarDispositivoPush() {
  if (Platform.OS === 'web') return;
  try {
    const installationId = await AsyncStorage.getItem(INSTALLATION_KEY);
    if (!installationId) return;
    const documentoId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, installationId);
    await deleteDoc(doc(db, 'pushDispositivos', documentoId));
  } catch {
    // O logout não deve ser bloqueado se a limpeza do token falhar.
  }
}

export const PUSH_CHANNEL_ID = CHANNEL_ID;
