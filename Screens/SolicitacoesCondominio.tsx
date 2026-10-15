import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, doc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { colors, radius } from '../theme';

export default function SolicitacoesCondominio({ navigation }: any) {
  const { perfil } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!perfil?.condominioId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'solicitacoesCondominio'), where('condominioId', '==', perfil.condominioId)));
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a,b) => (b.criadaEm?.seconds || 0) - (a.criadaEm?.seconds || 0));
      setItens(dados);
    } finally { setLoading(false); }
  }

  useEffect(() => { carregar(); }, [perfil?.condominioId]);

  async function decidir(item: any, status: 'aprovada' | 'rejeitada') {
    try {
      await updateDoc(doc(db, 'solicitacoesCondominio', item.id), { status, decididoPorId: perfil?.id, decididoPorNome: perfil?.nome, decididoEm: serverTimestamp() });
      await addDoc(collection(db, 'notificacoes'), {
        moradorId: item.moradorId,
        condominioId: item.condominioId,
        mensagem: status === 'aprovada' ? 'Sua solicitação para entrar no condomínio foi aprovada. Abra o Perfil para concluir o vínculo.' : 'Sua solicitação de vínculo com o condomínio foi recusada pela portaria.',
        tipo: 'vinculo',
        lida: false,
        criadaEm: serverTimestamp(),
      });
      await carregar();
    } catch (e:any) { Alert.alert('Solicitação', e?.message || 'Não foi possível atualizar a solicitação.'); }
  }

  if (perfil?.tipo !== 'porteiro') return null;
  const pendentes = itens.filter(i => i.status === 'pendente');

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity><View><Text style={styles.eyebrow}>CONDOMÍNIO</Text><Text style={styles.title}>Solicitações de entrada</Text></View></View>
    {loading ? <LoadingCards /> : <FlatList contentContainerStyle={styles.list} data={pendentes} keyExtractor={i => i.id} onRefresh={carregar} refreshing={loading} ListEmptyComponent={<EmptyState icon="people-outline" title="Tudo em dia" text="Não há moradores aguardando aprovação." />} renderItem={({item}) => <View style={styles.card}>
      <Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>Bloco {item.bloco || '-'} · Ap. {item.apartamento || '-'}</Text><Text style={styles.meta}>{item.email || ''}</Text>
      <View style={styles.actions}><TouchableOpacity style={styles.reject} onPress={() => decidir(item, 'rejeitada')}><Text style={styles.rejectText}>Recusar</Text></TouchableOpacity><TouchableOpacity style={styles.approve} onPress={() => decidir(item, 'aprovada')}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.approveText}>Aprovar</Text></TouchableOpacity></View>
    </View>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},header:{paddingHorizontal:20,paddingTop:8,flexDirection:'row',alignItems:'center',gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:30,fontWeight:'700',color:colors.text},list:{padding:20,paddingBottom:40},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:17,marginBottom:11},name:{fontSize:21,fontWeight:'700'},meta:{fontSize:15,color:colors.muted,marginTop:2},actions:{flexDirection:'row',gap:9,marginTop:15},reject:{flex:1,height:44,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},rejectText:{fontWeight:'700',color:colors.text},approve:{flex:1,height:44,borderRadius:radius.pill,backgroundColor:colors.porter,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},approveText:{fontWeight:'700',color:'#fff'},
});
