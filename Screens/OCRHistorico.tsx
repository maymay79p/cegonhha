import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { colors, radius } from '../theme';

export default function OCRHistorico({ navigation }: any) {
  const { perfil } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (perfil?.tipo !== 'porteiro' || !perfil.condominioId) return;
    const q = query(collection(db, 'ocrTestes'), where('condominioId', '==', perfil.condominioId));
    const unsub = onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
      setItens(dados);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [perfil?.tipo, perfil?.condominioId]);

  const exibidos = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return itens;
    return itens.filter(item => `${item.nomeDetectado || ''} ${item.cpfDetectado || ''} ${item.blocoDetectado || ''} ${item.apartamentoDetectado || ''} ${item.moradorConfirmadoNome || ''}`.toLowerCase().includes(b));
  }, [itens, busca]);

  if (perfil?.tipo !== 'porteiro') return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>PORTARIA</Text><Text style={styles.title}>Histórico do OCR</Text></View>
      </View>
      <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput style={styles.searchInput} placeholder="Nome, CPF, bloco ou apartamento" value={busca} onChangeText={setBusca} /></View>
      {loading ? <LoadingCards /> : <FlatList
        data={exibidos}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState icon="scan-outline" title="Nenhuma leitura registrada" text="As leituras confirmadas pelo porteiro aparecerão aqui." />}
        renderItem={({ item }) => <View style={styles.card}>
          <View style={styles.top}><Text style={styles.name}>{item.nomeDetectado || item.moradorConfirmadoNome || 'Nome não identificado'}</Text><Text style={styles.score}>{Math.round((item.topScore || 0) * 100)}%</Text></View>
          <Text style={styles.meta}>CPF: {item.cpfDetectado || '—'}</Text>
          <Text style={styles.meta}>Bloco {item.blocoDetectado || '—'} · Ap. {item.apartamentoDetectado || '—'}</Text>
          <Text style={styles.meta}>Confirmado para: {item.moradorConfirmadoNome || item.moradorConfirmadoId || '—'}</Text>
          <Text style={styles.date}>{item.criadoEm?.toDate?.().toLocaleString('pt-BR') || ''}</Text>
        </View>}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:20,backgroundColor:colors.background},header:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:14},back:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:31,fontWeight:'700'},search:{height:50,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15},searchInput:{flex:1,paddingHorizontal:9},card:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:15,marginBottom:9},top:{flexDirection:'row',justifyContent:'space-between',gap:8},name:{fontSize:19,fontWeight:'700',flex:1},score:{fontSize:18,fontWeight:'700',color:colors.success},meta:{fontSize:14,color:colors.muted,marginTop:3},date:{fontSize:12,color:colors.muted,marginTop:8},
});
