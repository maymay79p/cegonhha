import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const listeners = new Set<() => void>();

function chaveMural(uid: string, condominioId: string) {
  return `@cegonha/mural-visto:${uid}:${condominioId}`;
}

function dataEmMs(item: any) {
  if (typeof item?.criadoEm?.toMillis === 'function') return item.criadoEm.toMillis();
  if (typeof item?.criadoEm?.seconds === 'number') return item.criadoEm.seconds * 1000;
  if (typeof item?.criadoEmCliente === 'number') return item.criadoEmCliente;
  return 0;
}

export async function marcarMuralComoVisto(uid: string, condominioId: string) {
  if (!uid || !condominioId) return;
  await AsyncStorage.setItem(chaveMural(uid, condominioId), String(Date.now()));
  listeners.forEach(listener => listener());
}

function assinarAlteracaoLeituraMural(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTabBadges() {
  const { user, perfil } = useAuth();
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [publicacoes, setPublicacoes] = useState<any[]>([]);
  const [ultimaLeituraMural, setUltimaLeituraMural] = useState<number>(Date.now());

  useEffect(() => {
    const uid = user?.uid || '';
    const condominioId = perfil?.condominioId || '';
    if (!uid || !condominioId) {
      setUltimaLeituraMural(Date.now());
      return;
    }

    let ativo = true;
    const carregar = async () => {
      const chave = chaveMural(uid, condominioId);
      const salvo = await AsyncStorage.getItem(chave);
      if (!ativo) return;
      if (salvo) {
        const valor = Number(salvo);
        setUltimaLeituraMural(Number.isFinite(valor) ? valor : Date.now());
      } else {
        const agora = Date.now();
        await AsyncStorage.setItem(chave, String(agora));
        if (ativo) setUltimaLeituraMural(agora);
      }
    };

    void carregar();
    const desassinar = assinarAlteracaoLeituraMural(() => { void carregar(); });
    return () => { ativo = false; desassinar(); };
  }, [user?.uid, perfil?.condominioId]);

  useEffect(() => {
    if (!user || !perfil) {
      setNotificacoes([]);
      return;
    }
    if (perfil.tipo === 'porteiro' && !perfil.condominioId) {
      setNotificacoes([]);
      return;
    }

    const q = perfil.tipo === 'porteiro'
      ? query(collection(db, 'notificacoes'), where('condominioId', '==', perfil.condominioId), where('destinatarioTipo', '==', 'porteiro'))
      : query(collection(db, 'notificacoes'), where('moradorId', '==', user.uid));

    return onSnapshot(q, snap => {
      setNotificacoes(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, () => setNotificacoes([]));
  }, [user?.uid, perfil?.tipo, perfil?.condominioId]);

  useEffect(() => {
    if (!perfil?.condominioId) {
      setPublicacoes([]);
      return;
    }
    const q = query(collection(db, 'mural'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      setPublicacoes(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, () => setPublicacoes([]));
  }, [perfil?.condominioId]);

  const avisosNaoLidos = useMemo(() => {
    if (!user || !perfil) return 0;
    if (perfil.tipo === 'porteiro') {
      return notificacoes.filter(item => !(Array.isArray(item.lidaPor) && item.lidaPor.includes(user.uid))).length;
    }
    return notificacoes.filter(item => item.lida !== true).length;
  }, [notificacoes, perfil?.tipo, user?.uid]);

  const muralNovos = useMemo(() => {
    if (!user || !perfil?.condominioId) return 0;
    return publicacoes.filter(item => item.autorId !== user.uid && dataEmMs(item) > ultimaLeituraMural).length;
  }, [publicacoes, ultimaLeituraMural, user?.uid, perfil?.condominioId]);

  return {
    avisosNaoLidos,
    muralNovos,
  };
}
