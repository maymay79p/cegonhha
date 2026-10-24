import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { sincronizarDiretorioUsuario, sincronizarIdentificadoresExistentes } from '../services/identificadoresUsuarios';
import { registrarDispositivoPush } from '../services/pushNotifications';

export type PerfilUsuario = {
  id: string;
  nome: string;
  email: string;
  tipo: 'morador' | 'porteiro';
  condominioId: string;
  condominioNome?: string;
  condominioCodigo?: string;
  bloco?: string;
  apartamento?: string;
  telefone?: string;
  cpf?: string;
  fotoPerfil?: string;
  mostrarCodigoCondominio?: boolean;
};

type AuthContextType = {
  user: User | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  recarregarPerfil: () => Promise<void>;
  aplicarPerfilLocal: (perfil: PerfilUsuario) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, perfil: null, loading: true, recarregarPerfil: async () => {}, aplicarPerfilLocal: async () => {} });
const LEGACY_CACHE_PREFIX = '@cegonha/perfil:';

function chaveCacheLegado(uid: string) {
  return `${LEGACY_CACHE_PREFIX}${uid}`;
}

async function apagarCacheSensivelLegado(uid: string) {
  if (!uid) return;
  await AsyncStorage.removeItem(chaveCacheLegado(uid));
}

function precisaConfirmarEmail(user: User) {
  const usaSenha = user.providerData.some(provider => provider.providerId === 'password');
  return usaSenha && !user.emailVerified;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const perfilRef = useRef<PerfilUsuario | null>(null);

  async function aplicarPerfilLocal(dados: PerfilUsuario) {
    perfilRef.current = dados;
    setPerfil(dados);
    setLoading(false);
    // Versões antigas armazenavam CPF, telefone, e-mail e unidade em AsyncStorage.
    // O perfil completo agora vive somente em memória e no Firestore protegido.
    apagarCacheSensivelLegado(dados.id).catch(() => {});
  }

  async function recarregarPerfil() {
    const atual = auth.currentUser;
    if (!atual || precisaConfirmarEmail(atual)) return;
    const snapshot = await getDoc(doc(db, 'usuarios', atual.uid));
    if (!snapshot.exists()) return;
    const dados = { id: snapshot.id, ...snapshot.data() } as PerfilUsuario;
    await aplicarPerfilLocal(dados);
  }

  async function garantirDestaqueCodigo(dados: PerfilUsuario) {
    if (dados.tipo !== 'porteiro' || !dados.condominioId || dados.mostrarCodigoCondominio !== undefined) return;
    try {
      const condo = await getDoc(doc(db, 'condominios', dados.condominioId));
      if (condo.exists() && condo.data()?.criadoPor === dados.id) {
        await updateDoc(doc(db, 'usuarios', dados.id), { mostrarCodigoCondominio: true });
      }
    } catch {}
  }

  useEffect(() => {
    let unsubscribePerfil: (() => void) | undefined;
    let timerPerfilAusente: ReturnType<typeof setTimeout> | undefined;
    let versao = 0;

    const unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      versao += 1;
      const versaoAtual = versao;
      const perfilAnteriorId = perfilRef.current?.id || '';
      setUser(currentUser);
      if (unsubscribePerfil) unsubscribePerfil();
      if (timerPerfilAusente) clearTimeout(timerPerfilAusente);

      if (!currentUser) {
        if (perfilAnteriorId) apagarCacheSensivelLegado(perfilAnteriorId).catch(() => {});
        perfilRef.current = null;
        setPerfil(null);
        setLoading(false);
        return;
      }

      apagarCacheSensivelLegado(currentUser.uid).catch(() => {});

      if (precisaConfirmarEmail(currentUser)) {
        perfilRef.current = null;
        setPerfil(null);
        setLoading(false);
        return;
      }

      const jaTemPerfilAtual = perfilRef.current?.id === currentUser.uid;
      if (!jaTemPerfilAtual) setLoading(true);

      unsubscribePerfil = onSnapshot(
        doc(db, 'usuarios', currentUser.uid),
        snapshot => {
          if (versaoAtual !== versao) return;
          if (snapshot.exists()) {
            if (timerPerfilAusente) clearTimeout(timerPerfilAusente);
            const dados = { id: snapshot.id, ...snapshot.data() } as PerfilUsuario;
            perfilRef.current = dados;
            setPerfil(dados);
            setLoading(false);
            apagarCacheSensivelLegado(dados.id).catch(() => {});
            garantirDestaqueCodigo(dados);
            return;
          }
          timerPerfilAusente = setTimeout(() => {
            if (versaoAtual !== versao) return;
            perfilRef.current = null;
            setPerfil(null);
            setLoading(false);
            apagarCacheSensivelLegado(currentUser.uid).catch(() => {});
          }, 5000);
        },
        () => { if (perfilRef.current?.id !== currentUser.uid) setLoading(false); }
      );
    });

    return () => {
      versao += 1;
      unsubscribeAuth();
      if (unsubscribePerfil) unsubscribePerfil();
      if (timerPerfilAusente) clearTimeout(timerPerfilAusente);
    };
  }, []);

  useEffect(() => {
    if (!user || !perfil || user.uid !== perfil.id || precisaConfirmarEmail(user)) return;
    sincronizarIdentificadoresExistentes({
      uid:user.uid,
      cpf:perfil.cpf,
      telefone:perfil.telefone,
      email:perfil.email,
    }).catch(() => {});
    sincronizarDiretorioUsuario(perfil).catch(() => {});
  }, [user?.uid, user?.emailVerified, perfil?.id, perfil?.nome, perfil?.tipo, perfil?.condominioId, perfil?.bloco, perfil?.apartamento, perfil?.cpf, perfil?.telefone, perfil?.email]);

  useEffect(() => {
    if (!user || !perfil || user.uid !== perfil.id || precisaConfirmarEmail(user)) return;
    registrarDispositivoPush({
      uid: user.uid,
      tipo: perfil.tipo,
      condominioId: perfil.condominioId || '',
    }).catch(() => {});
  }, [user?.uid, user?.emailVerified, perfil?.id, perfil?.tipo, perfil?.condominioId]);

  return <AuthContext.Provider value={{ user, perfil, loading, recarregarPerfil, aplicarPerfilLocal }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
