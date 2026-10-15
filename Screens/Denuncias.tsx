import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

function idBanimento(condominioId: string, usuarioId: string) {
  return `${condominioId}_${usuarioId}`;
}

function dataDenuncia(item: any) {
  const data = item?.criadoEm?.toDate?.();
  if (!(data instanceof Date)) return 'Data indisponível';
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function rotuloStatus(status = 'pendente') {
  const mapa: Record<string, string> = {
    pendente: 'Pendente',
    ignorada: 'Ignorada',
    publicacao_excluida: 'Publicação excluída',
    autor_banido: 'Autor banido',
    autor_desbanido: 'Autor desbanido',
  };
  return mapa[status] || status;
}

function mensagemErro(e: any, padrao: string) {
  const codigo = String(e?.code || '');
  if (codigo.includes('permission-denied')) return 'O Firestore bloqueou esta ação. Publique as regras mais recentes do Cegonha e tente novamente.';
  return e?.message || padrao;
}

export default function Denuncias({ navigation }: any) {
  const { perfil, user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [itens, setItens] = useState<any[]>([]);
  const [banidos, setBanidos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'pendente' | 'resolvidas'>('todas');
  const [processandoId, setProcessandoId] = useState('');

  const ehPortaria = perfil?.tipo === 'porteiro';

  useEffect(() => {
    if (!perfil?.condominioId || !user) {
      setItens([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = ehPortaria
      ? query(collection(db, 'muralDenuncias'), where('condominioId', '==', perfil.condominioId))
      : query(collection(db, 'muralDenuncias'), where('denuncianteId', '==', user.uid));

    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      lista.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
      setItens(lista);
      setLoading(false);
    }, e => {
      setLoading(false);
      Alert.alert('Denúncias', mensagemErro(e, 'Não foi possível carregar as denúncias.'));
    });

    return unsub;
  }, [perfil?.condominioId, ehPortaria, user?.uid]);

  useEffect(() => {
    if (!ehPortaria || !perfil?.condominioId) {
      setBanidos({});
      return;
    }
    const q = query(collection(db, 'muralBanidos'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const mapa: Record<string, boolean> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data?.usuarioId) mapa[data.usuarioId] = data.ativo === true;
      });
      setBanidos(mapa);
    }, () => setBanidos({}));
  }, [ehPortaria, perfil?.condominioId]);

  const exibidos = useMemo(() => itens.filter(item => {
    if (filtro === 'pendente') return (item.status || 'pendente') === 'pendente';
    if (filtro === 'resolvidas') return (item.status || 'pendente') !== 'pendente';
    return true;
  }), [itens, filtro]);

  async function resolver(item: any, status: string) {
    if (!ehPortaria || !user) return;
    await updateDoc(doc(db, 'muralDenuncias', item.id), {
      status,
      resolvidaEm: serverTimestamp(),
      resolvidoPorId: user.uid,
      resolvidoPorNome: perfil?.nome || user.displayName || 'Portaria',
    });
  }

  async function ignorar(item: any) {
    try {
      setProcessandoId(item.id);
      await resolver(item, 'ignorada');
    } catch (e: any) {
      Alert.alert('Denúncias', mensagemErro(e, 'Não foi possível ignorar a denúncia.'));
    } finally {
      setProcessandoId('');
    }
  }

  function excluirPublicacao(item: any) {
    Alert.alert('Excluir publicação', 'A publicação denunciada será removida do mural. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            setProcessandoId(item.id);
            await deleteDoc(doc(db, 'mural', item.comentarioId));
            await resolver(item, 'publicacao_excluida');
          } catch (e: any) {
            Alert.alert('Denúncias', mensagemErro(e, 'Não foi possível excluir a publicação.'));
          } finally {
            setProcessandoId('');
          }
        },
      },
    ]);
  }

  async function alterarBanimento(item: any, ativo: boolean) {
    if (!ehPortaria || !perfil?.condominioId || !user) return;
    try {
      setProcessandoId(item.id);
      await setDoc(doc(db, 'muralBanidos', idBanimento(perfil.condominioId, item.autorId)), {
        usuarioId: item.autorId,
        usuarioNome: item.autorNome || '',
        condominioId: perfil.condominioId,
        ativo,
        banidoPorId: ativo ? user.uid : '',
        banidoPorNome: ativo ? (perfil.nome || '') : '',
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      await resolver(item, ativo ? 'autor_banido' : 'autor_desbanido');
    } catch (e: any) {
      Alert.alert('Denúncias', mensagemErro(e, ativo ? 'Não foi possível banir o autor.' : 'Não foi possível desbanir o autor.'));
    } finally {
      setProcessandoId('');
    }
  }

  if (!perfil?.condominioId) {
    return <View style={styles.container}><EmptyState icon="flag-outline" title="Sem condomínio" text="Vincule sua conta a um condomínio para acessar as denúncias." /></View>;
  }

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={21} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>COMUNIDADE</Text>
        <Text style={styles.title}>{ehPortaria ? 'Central de denúncias' : 'Minhas denúncias'}</Text>
      </View>
    </View>
    <Text style={styles.subtitle}>{ehPortaria ? 'Revise publicações sinalizadas pelos moradores e pela portaria.' : 'Acompanhe o andamento das publicações que você denunciou.'}</Text>

    <View style={styles.filters}>
      {(['todas', 'pendente', 'resolvidas'] as const).map(opcao => (
        <TouchableOpacity key={opcao} style={[styles.filter, filtro === opcao && styles.filterActive]} onPress={() => setFiltro(opcao)}>
          <Text style={[styles.filterText, filtro === opcao && styles.filterTextActive]}>{opcao === 'todas' ? 'Todas' : opcao === 'pendente' ? 'Pendentes' : 'Resolvidas'}</Text>
        </TouchableOpacity>
      ))}
    </View>

    {loading ? <LoadingCards count={3} /> : <FlatList
      data={exibidos}
      keyExtractor={item => item.id}
      contentContainerStyle={{ paddingBottom: 120 }}
      ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="Nada para revisar" text={ehPortaria ? 'Nenhuma denúncia corresponde a este filtro.' : 'Você ainda não enviou denúncias neste condomínio.'} />}
      renderItem={({ item }) => {
        const status = item.status || 'pendente';
        const ocupado = processandoId === item.id;
        const autorBanido = !!banidos[item.autorId];
        return <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.author}>Publicação de {item.autorNome || 'Usuário'}</Text>
              <Text style={styles.meta}>{dataDenuncia(item)}</Text>
            </View>
            <View style={[styles.status, status === 'pendente' ? styles.statusPending : styles.statusDone]}>
              <Text style={[styles.statusText, status === 'pendente' ? { color: colors.warning } : { color: colors.success }]}>{rotuloStatus(status)}</Text>
            </View>
          </View>

          <Text style={styles.label}>Motivo</Text>
          <Text style={styles.value}>{item.motivo || 'Conteúdo inadequado ou contrário às regras da comunidade.'}</Text>
          {!!item.detalhes && <Text style={styles.details}>{item.detalhes}</Text>}

          <Text style={styles.label}>Publicação denunciada</Text>
          <Text style={styles.quote}>{item.comentarioTexto || 'A publicação não possui texto disponível.'}</Text>

          <Text style={styles.reporter}>{ehPortaria ? `Denunciado por ${item.denuncianteNome || 'Usuário'}` : `Autor denunciado: ${item.autorNome || 'Usuário'}`}</Text>

          {ehPortaria && <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => ignorar(item)} disabled={ocupado}>
              <Ionicons name="checkmark-outline" size={16} color={colors.muted} /><Text style={styles.actionText}>Ignorar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => excluirPublicacao(item)} disabled={ocupado}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} /><Text style={[styles.actionText, { color: colors.danger }]}>Excluir publicação</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => alterarBanimento(item, !autorBanido)} disabled={ocupado}>
              <Ionicons name={autorBanido ? 'person-add-outline' : 'ban-outline'} size={16} color={autorBanido ? colors.success : colors.danger} />
              <Text style={[styles.actionText, { color: autorBanido ? colors.success : colors.danger }]}>{autorBanido ? 'Desbanir autor' : 'Banir autor'}</Text>
            </TouchableOpacity>
          </View>}
          {ocupado && <Text style={styles.processing}>Processando...</Text>}
        </View>;
      }}
    />}
  </View>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: 20, paddingBottom: 100, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 4 },
    back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.7, color: colors.accent },
    title: { fontSize: 31, fontWeight: '700', marginTop: 1 },
    subtitle: { fontSize: 15, lineHeight: 20, color: colors.muted, marginTop: 7, marginBottom: 13 },
    filters: { flexDirection: 'row', gap: 7, marginBottom: 13 },
    filter: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filterActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterText: { fontSize: 13, fontWeight: '700', color: colors.text },
    filterTextActive: { color: '#fff' },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, padding: 15, marginBottom: 10 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    author: { fontSize: 17, fontWeight: '700' },
    meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    status: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
    statusPending: { backgroundColor: colors.surfaceSoft },
    statusDone: { backgroundColor: colors.surfaceSoft },
    statusText: { fontSize: 11, fontWeight: '700' },
    label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 13, textTransform: 'uppercase', letterSpacing: .5 },
    value: { fontSize: 15, fontWeight: '700', marginTop: 3 },
    details: { fontSize: 14, color: colors.muted, lineHeight: 19, marginTop: 4 },
    quote: { fontSize: 15, lineHeight: 21, marginTop: 5, padding: 11, borderRadius: radius.small, backgroundColor: colors.surfaceSoft },
    reporter: { fontSize: 12, color: colors.muted, marginTop: 10 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    actionText: { fontSize: 12, fontWeight: '700', color: colors.text },
    processing: { fontSize: 12, color: colors.muted, marginTop: 8 },
  });
}
