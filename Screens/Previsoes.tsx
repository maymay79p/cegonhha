import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { EmptyState } from '../components/States';
import { radius, shadow, ThemeColors } from '../theme';

export default function Previsoes() {
  const { user, perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [lista, setLista] = useState<any[]>([]);
  const [descricao, setDescricao] = useState('');
  const [rastreio, setRastreio] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [previsao, setPrevisao] = useState('');
  const [atrasada, setAtrasada] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setLista([]); return; }
    const q = query(collection(db, 'previsoes'), where('moradorId', '==', user.uid));
    return onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a, b) => (b.criadaEm?.seconds || 0) - (a.criadaEm?.seconds || 0));
      setLista(dados);
    }, () => setLista([]));
  }, [user?.uid]);

  function limparFormulario() {
    setDescricao(''); setRastreio(''); setTransportadora(''); setPrevisao(''); setAtrasada(false); setEditandoId(null);
  }

  function editar(item: any) {
    setEditandoId(item.id); setDescricao(item.descricao || ''); setRastreio(item.codigoRastreio || ''); setTransportadora(item.transportadora || ''); setPrevisao(item.previsao || ''); setAtrasada(!!item.atrasada);
  }

  async function salvar() {
    if (!user || !perfil) return;
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe uma descrição da encomenda.');
    try {
      setLoading(true);
      const estavaEditando = !!editandoId;
      const dados = { descricao: descricao.trim(), codigoRastreio: rastreio.trim(), transportadora: transportadora.trim(), previsao: previsao.trim(), atrasada, atualizadoEm: serverTimestamp() };
      if (editandoId) await updateDoc(doc(db, 'previsoes', editandoId), dados);
      else await addDoc(collection(db, 'previsoes'), { moradorId: user.uid, condominioId: perfil.condominioId || '', ...dados, criadaEm: serverTimestamp() });
      limparFormulario();
      Alert.alert('Pronto', estavaEditando ? 'Entrega prevista atualizada.' : 'Entrega prevista registrada.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar.');
    } finally { setLoading(false); }
  }

  function excluir(item: any) {
    Alert.alert('Excluir entrega prevista','Deseja remover esta entrega da sua lista?',[{ text:'Cancelar', style:'cancel' },{ text:'Excluir', style:'destructive', onPress:async()=>{
      try { await deleteDoc(doc(db,'previsoes',item.id)); if(editandoId===item.id) limparFormulario(); }
      catch(e:any){ Alert.alert('Erro',e?.message||'Não foi possível excluir.'); }
    }}]);
  }

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>ESPERADAS</Text><Text style={styles.title}>O que está a caminho</Text><Text style={styles.help}>Cadastre, edite ou remova entregas que você espera receber. A lista atualiza automaticamente.</Text>
    <View style={styles.formCard}>
      {editandoId && <View style={styles.editBanner}><Ionicons name="create-outline" size={18} color={colors.accent}/><Text style={styles.editText}>Editando uma entrega prevista</Text></View>}
      <TextInput style={styles.input} placeholder="Descrição da encomenda" value={descricao} onChangeText={setDescricao} returnKeyType="next" />
      <TextInput style={styles.input} placeholder="Código de rastreio" value={rastreio} onChangeText={setRastreio} returnKeyType="next" />
      <TextInput style={styles.input} placeholder="Transportadora" value={transportadora} onChangeText={setTransportadora} returnKeyType="next" />
      <TextInput style={styles.input} placeholder="Previsão de chegada" value={previsao} onChangeText={setPrevisao} returnKeyType="done" onSubmitEditing={salvar} />
      <TouchableOpacity style={styles.checkRow} onPress={()=>setAtrasada(v=>!v)}><Ionicons name={atrasada?'checkbox':'square-outline'} size={22} color={atrasada?colors.accent:colors.muted}/><Text style={styles.checkText}>Marcar como atrasada</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.button,loading&&styles.disabled]} onPress={salvar} disabled={loading}><Text style={styles.buttonText}>{loading?'Salvando...':editandoId?'Salvar alterações':'Adicionar entrega'}</Text><Ionicons name={editandoId?'checkmark':'arrow-forward'} size={18} color="#fff"/></TouchableOpacity>
      {editandoId&&<TouchableOpacity style={styles.cancelEdit} onPress={limparFormulario}><Text style={styles.cancelEditText}>Cancelar edição</Text></TouchableOpacity>}
    </View>

    <View style={styles.sectionRow}><Text style={styles.section}>Registradas</Text><Text style={styles.count}>{lista.length}</Text></View>
    {!lista.length ? <EmptyState icon="time-outline" title="Nenhuma entrega prevista" text="Quando você cadastrar uma encomenda a caminho, ela aparecerá aqui."/> : lista.map(item=><View key={item.id} style={styles.card}>
      <View style={styles.cardIcon}><Ionicons name="time-outline" size={19} color={colors.accent}/></View>
      <View style={styles.cardCopy}><Text style={styles.name}>{item.descricao}</Text>{!!item.transportadora&&<Text style={styles.meta}>{item.transportadora}</Text>}{!!item.codigoRastreio&&<Text style={styles.meta}>Rastreio: {item.codigoRastreio}</Text>}{!!item.previsao&&<Text style={styles.meta}>Previsão: {item.previsao}</Text>}{item.atrasada&&<Text style={styles.late}>Atrasada</Text>}</View>
      <View style={styles.cardActions}><TouchableOpacity style={styles.iconButton} onPress={()=>editar(item)}><Ionicons name="create-outline" size={19} color={colors.accent}/></TouchableOpacity><TouchableOpacity style={styles.iconButton} onPress={()=>excluir(item)}><Ionicons name="trash-outline" size={19} color={colors.danger}/></TouchableOpacity></View>
    </View>)}
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{paddingHorizontal:20,paddingTop:54,paddingBottom:140,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:2,color:colors.accent},title:{fontSize:34,fontWeight:'700',color:colors.text,marginTop:4},help:{fontSize:16,color:colors.muted,marginTop:4,marginBottom:16,lineHeight:21},formCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border,...shadow},editBanner:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:colors.accentSoft,padding:10,borderRadius:radius.small,marginBottom:10},editText:{fontWeight:'700',color:colors.accent},input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:15,paddingVertical:13,marginBottom:10},checkRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:5,marginBottom:10},checkText:{fontSize:16,fontWeight:'600'},button:{backgroundColor:colors.accent,padding:14,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},cancelEdit:{alignItems:'center',paddingTop:12},cancelEditText:{fontWeight:'700',color:colors.muted},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22,marginBottom:10},section:{fontSize:24,fontWeight:'700'},count:{fontSize:14,color:colors.muted},card:{backgroundColor:colors.surface,padding:14,borderRadius:radius.large,marginBottom:9,borderWidth:1,borderColor:colors.border,flexDirection:'row',gap:11},cardIcon:{width:38,height:38,borderRadius:19,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},cardCopy:{flex:1},name:{fontWeight:'700',fontSize:18},meta:{fontSize:14,color:colors.muted,marginTop:1},late:{color:colors.danger,fontWeight:'700',marginTop:4},cardActions:{justifyContent:'center',gap:8},iconButton:{width:36,height:36,borderRadius:18,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},disabled:{opacity:0.55}
});}
