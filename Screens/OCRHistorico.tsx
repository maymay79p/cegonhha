import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { correspondeBusca, normalizarBusca } from '../utils/busca';
import { radius, ThemeColors } from '../theme';

export default function OCRHistorico({ navigation }: any) {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (perfil?.tipo !== 'porteiro' || !perfil.condominioId) { setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'ocrLeituras'), where('condominioId', '==', perfil.condominioId));
    const unsub = onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
      setItens(dados);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [perfil?.tipo, perfil?.condominioId]);

  const exibidos = useMemo(() => {
    return itens.filter(item => correspondeBusca(normalizarBusca([
      item.nomeDetectado,
      item.moradorConfirmadoNome,
      item.porteiroNome,
      item.blocoDetectado,
      item.blocoDetectado ? `bloco ${item.blocoDetectado} bl ${item.blocoDetectado}` : '',
      item.apartamentoDetectado,
      item.apartamentoDetectado ? `apartamento ${item.apartamentoDetectado} apto ${item.apartamentoDetectado} ap ${item.apartamentoDetectado}` : '',
    ].join(' ')), busca));
  }, [itens, busca]);

  if (perfil?.tipo !== 'porteiro') return null;

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={21} color={colors.text} /></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.eyebrow}>PORTARIA</Text><Text style={styles.title}>Histórico do OCR</Text></View></View>
    <Text style={styles.privacy}>Somente metadados mínimos de leituras usadas para confirmar uma encomenda aparecem aqui. Fotos, texto bruto e o número do CPF reconhecido não são armazenados.</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput style={styles.searchInput} placeholder="Nome, bloco ou apartamento" value={busca} onChangeText={setBusca} />{!!busca&&<TouchableOpacity onPress={()=>setBusca('')} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>
    {loading ? <LoadingCards /> : <FlatList
      data={exibidos}
      keyExtractor={item => item.id}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
      ListEmptyComponent={<EmptyState icon="scan-outline" title="Nenhuma leitura encontrada" text="Tente buscar por nome, bloco ou apartamento. Leituras confirmadas aparecerão aqui." />}
      renderItem={({ item }) => <View style={styles.card}>
        <View style={styles.top}><Text style={styles.name}>{item.nomeDetectado || 'Nome não identificado'}</Text><Text style={styles.score}>{Math.round((item.topScore || 0) * 100)}%</Text></View>
        <Text style={styles.meta}>CPF reconhecido: {item.reconheceuCpf ? 'sim' : 'não'}</Text>
        <Text style={styles.meta}>Bloco {item.blocoDetectado || '—'} · Ap. {item.apartamentoDetectado || '—'}</Text>
        <View style={[styles.status,styles.statusOk]}><Ionicons name="checkmark-circle-outline" size={15} color={colors.success}/><Text style={[styles.statusText,{color:colors.success}]}>{`Confirmada para ${item.moradorConfirmadoNome || 'morador'}`}</Text></View>
        <Text style={styles.date}>{item.criadoEm?.toDate?.().toLocaleString('pt-BR') || ''}{item.porteiroNome ? ` · ${item.porteiroNome}` : ''}</Text>
      </View>}
    />}
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,backgroundColor:colors.background},header:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:8},back:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:31,fontWeight:'700'},privacy:{fontSize:13,lineHeight:18,color:colors.muted,marginBottom:12},search:{minHeight:50,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15},searchInput:{flex:1,paddingHorizontal:9},card:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:15,marginBottom:9},top:{flexDirection:'row',justifyContent:'space-between',gap:8},name:{fontSize:19,fontWeight:'700',flex:1},score:{fontSize:18,fontWeight:'700',color:colors.success},meta:{fontSize:14,color:colors.muted,marginTop:3},status:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:6,borderRadius:radius.pill,marginTop:9},statusOk:{backgroundColor:colors.surfaceSoft},statusText:{fontSize:12,fontWeight:'700'},date:{fontSize:12,color:colors.muted,marginTop:8}
});}
