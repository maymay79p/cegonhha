import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { correspondeBusca, montarTextoBuscaPessoa } from '../utils/busca';
import { radius, ThemeColors } from '../theme';

export default function SolicitacoesCondominio({ navigation }: any) {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState('');

  useEffect(() => {
    if (!perfil?.condominioId) { setItens([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'solicitacoesCondominio'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a,b) => (b.criadaEm?.seconds || 0) - (a.criadaEm?.seconds || 0));
      setItens(dados);
      setLoading(false);
    }, e => {
      setLoading(false);
      const codigo = String((e as any)?.code || '');
      Alert.alert('Solicitações', codigo.includes('permission-denied') ? 'O Firestore bloqueou a leitura. Publique as regras mais recentes do Cegonha.' : 'Não foi possível carregar as solicitações.');
    });
  }, [perfil?.condominioId]);

  async function decidir(item: any, status: 'aprovada' | 'rejeitada') {
    if (!perfil?.id || !perfil?.condominioId || processandoId) return;
    try {
      setProcessandoId(item.id);
      const solicitacaoRef = doc(db, 'solicitacoesCondominio', item.id);
      const notificacaoRef = doc(collection(db, 'notificacoes'));
      const auditoriaRef = doc(collection(db, 'auditoria'));
      const batch = writeBatch(db);
      batch.update(solicitacaoRef, {
        status,
        decididoPorId: perfil.id,
        decididoPorNome: perfil.nome,
        decididoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      batch.set(notificacaoRef, {
        destinatarioTipo: 'morador',
        moradorId: item.moradorId,
        condominioId: item.condominioId,
        referenciaId: item.id,
        mensagem: status === 'aprovada'
          ? 'Sua solicitação para entrar no condomínio foi aprovada. Abra o Perfil para concluir o vínculo.'
          : 'Sua solicitação de vínculo com o condomínio foi recusada pela portaria.',
        tipo: 'vinculo',
        lida: false,
        criadaEm: serverTimestamp(),
      });
      batch.set(auditoriaRef, {
        condominioId: perfil.condominioId,
        moradorId: item.moradorId,
        alvoNome: item.moradorNome || 'Morador',
        atorId: perfil.id,
        atorNome: perfil.nome || 'Portaria',
        acao: status === 'aprovada' ? 'vinculo_aprovado' : 'vinculo_rejeitado',
        detalhe: status === 'aprovada' ? 'Solicitação de entrada aprovada' : 'Solicitação de entrada recusada',
        criadoEm: serverTimestamp(),
      });
      await batch.commit();
      // A lista é em tempo real; o item some assim que deixa de estar pendente.
    } catch (e:any) {
      const codigo = String(e?.code || '');
      Alert.alert('Solicitação', codigo.includes('permission-denied') ? 'O Firestore bloqueou a operação. Publique as regras mais recentes do Cegonha.' : e?.message || 'Não foi possível atualizar a solicitação.');
    } finally {
      setProcessandoId('');
    }
  }

  if (perfil?.tipo !== 'porteiro') return null;
  const pendentes = itens.filter(i => i.status === 'pendente');
  const exibidas = pendentes.filter(item => correspondeBusca(montarTextoBuscaPessoa({
    ...item,
    nome: item.moradorNome,
    tipo: 'morador',
  }), busca));

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity><View style={{flex:1}}><Text style={styles.eyebrow}>CONDOMÍNIO</Text><Text style={styles.title}>Solicitações de entrada</Text><Text style={styles.subtitle}>Aprove somente moradores que pertencem ao condomínio.</Text></View></View>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Nome, bloco, apartamento ou e-mail" value={busca} onChangeText={setBusca}/>{!!busca&&<TouchableOpacity onPress={()=>setBusca('')} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>
    {loading ? <LoadingCards /> : <FlatList contentContainerStyle={styles.list} data={exibidas} keyExtractor={i => i.id} ListEmptyComponent={<EmptyState icon="people-outline" title={pendentes.length ? 'Nenhuma solicitação encontrada' : 'Tudo em dia'} text={pendentes.length ? 'Tente buscar por nome, bloco, apartamento ou e-mail.' : 'Não há moradores aguardando aprovação.'} />} renderItem={({item}) => {
      const ocupado = processandoId === item.id;
      return <View style={styles.card}>
        <Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>Bloco {item.bloco || '-'} · Ap. {item.apartamento || '-'}</Text><Text style={styles.meta}>{item.email || ''}</Text>
        <View style={styles.actions}><TouchableOpacity style={[styles.reject, ocupado && styles.disabled]} onPress={() => decidir(item, 'rejeitada')} disabled={!!processandoId}><Text style={styles.rejectText}>{ocupado ? 'Salvando...' : 'Recusar'}</Text></TouchableOpacity><TouchableOpacity style={[styles.approve, ocupado && styles.disabled]} onPress={() => decidir(item, 'aprovada')} disabled={!!processandoId}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.approveText}>{ocupado ? 'Salvando...' : 'Aprovar'}</Text></TouchableOpacity></View>
      </View>;
    }} />}
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},header:{paddingHorizontal:20,paddingTop:8,flexDirection:'row',alignItems:'flex-start',gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:30,fontWeight:'700',color:colors.text},subtitle:{fontSize:13,color:colors.muted,marginTop:2},search:{minHeight:50,marginHorizontal:20,marginTop:14,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:7},searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent'},list:{padding:20,paddingBottom:40,flexGrow:1},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:17,marginBottom:11},name:{fontSize:21,fontWeight:'700'},meta:{fontSize:15,color:colors.muted,marginTop:2},actions:{flexDirection:'row',gap:9,marginTop:15},reject:{flex:1,minHeight:44,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},rejectText:{fontWeight:'700',color:colors.text},approve:{flex:1,minHeight:44,borderRadius:radius.pill,backgroundColor:colors.porter,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},approveText:{fontWeight:'700',color:'#fff'},disabled:{opacity:.55}
});}
