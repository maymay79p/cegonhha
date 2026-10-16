import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDSzJKJvm1rpnSIslT9bszZTQgK1XQs0Lw',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cegonha-43403.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'cegonha-43403',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cegonha-43403.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '119682503943',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:119682503943:web:677db45b788777807721a2',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: (firebaseAuth as any).getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// Proteção adicional: o Firestore normalmente rejeita qualquer campo `undefined`,
// inclusive quando ele aparece dentro de arrays/objetos aninhados. Mantemos os
// serviços normalizando os dados e também ativamos esta salvaguarda global para
// que um campo opcional esquecido não derrube uma operação inteira.
let db;
try {
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  db = getFirestore(app);
}

export { app, auth, db };
