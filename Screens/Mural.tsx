import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState } from '../components/States';
import { colors, radius } from '../theme';

export default function Mural() {
  const { perfil } = useAuth();
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [banido, setBanido] = useState(false);

  useEffect(() => {
    if (!perfil?.condominioId) return;
    const q = query(collection(db, 'mural'), where('condominioId', '==', perfil.condominioId));
    const unsub = onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a,b)=>(b.criadoEm?.seconds||0)-(a.criadoEm?.seconds||0));
      setItens(dados);
    });
    getDoc(doc(db, 'muralBanidos', perfil.id)).then(s => setBanido(s.exists() && s.data()?.ativo === true)).catch(()=>{});
    return unsub;
  }, [perfil?.condominioId, perfil?.id]);

  const exibidos = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return !b ? itens : itens.filter(i => `${i.autorNome || ''} ${i.texto || ''}`.toLowerCase().includes(b));
  }, [itens, busca]);

  async function publicar() {
    const t = texto.trim();
    if (!perfil?.condominioId || !t) return;
    if (banido) return Alert.alert('Mural', 'Sua conta está impedida de publicar no mural deste condomínio.');
    await addDoc(collection(db, 'mural'), {
      condominioId: perfil.condominioId,
      autorId: perfil.id,
      autorNome: perfil.nome,
      autorTipo: perfil.tipo,
      texto: t,
      criadoEm: serverTimestamp(),
    });
    setTexto('');
  }

  async function denunciar(item: any) {
    if (!perfil) return;
    await addDoc(collection(db, 'muralDenuncias'), {
      condominioId: perfil.condominioId,
      comentarioId: item.id,
      comentarioTexto: item.texto || '',
      autorId: item.autorId,
      denuncianteId: perfil.id,
      denuncianteNome: perfil.nome,
      criadoEm: serverTimestamp(),
      status: 'pendente',
    });
    Alert.alert('Denúncia enviada', 'A portaria poderá revisar este comentário.');
  }

  async function banir(item: any) {
    if (perfil?.tipo !== 'porteiro') return;
    if (item.autorId === perfil.id) return Alert.alert('Mural', 'Você não pode banir a própria conta.');
    await setDoc(doc(db, 'muralBanidos', item.autorId), {
      usuarioId: item.autorId,
      usuarioNome: item.autorNome || '',
      condominioId: perfil.condominioId,
      ativo: true,
      banidoPorId: perfil.id,
      banidoPorNome: perfil.nome,
      criadoEm: serverTimestamp(),
    }, { merge: true });
    Alert.alert('Usuário banido', 'Esse usuário não poderá publicar novos comentários no mural.');
  }

  if (!perfil?.condominioId) return <View style={styles.container}><EmptyState icon="people-outline" title="Sem condomínio" text="Vincule sua conta a um condomínio para acessar o mural." /></View>;

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>COMUNIDADE</Text>
    <Text style={styles.title}>Mural do condomínio</Text>
    <Text style={styles.subtitle}>{perfil.condominioNome || 'Condomínio'}</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={18} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Pesquisar no mural" value={busca} onChangeText={setBusca}/></View>
    <View style={styles.compose}>
      <TextInput style={styles.input} placeholder={banido ? 'Publicação bloqueada pela portaria' : 'Escreva um aviso ou comentário'} value={texto} onChangeText={setTexto} editable={!banido} multiline />
      <TouchableOpacity style={[styles.send,(!texto.trim()||banido)&&{opacity:.45}]} onPress={publicar} disabled={!texto.trim()||banido}><Ionicons name="send" size={18} color="#fff"/></TouchableOpacity>
    </View>
    <FlatList data={exibidos} keyExtractor={i=>i.id} contentContainerStyle={{paddingBottom:120}} ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="Mural vazio" text="Seja a primeira pessoa a publicar algo para o condomínio."/>} renderItem={({item})=><View style={styles.card}>
      <View style={styles.top}><View><Text style={styles.name}>{item.autorNome || 'Usuário'}</Text><Text style={styles.role}>{item.autorTipo === 'porteiro' ? 'Portaria' : 'Morador'} · {item.criadoEm?.toDate?.().toLocaleString('pt-BR') || ''}</Text></View></View>
      <Text style={styles.body}>{item.texto}</Text>
      <View style={styles.actions}>
        {item.autorId !== perfil.id && <TouchableOpacity onPress={()=>denunciar(item)} style={styles.action}><Ionicons name="flag-outline" size={15} color={colors.warning}/><Text style={styles.actionText}>Denunciar</Text></TouchableOpacity>}
        {perfil.tipo === 'porteiro' && item.autorId !== perfil.id && <TouchableOpacity onPress={()=>banir(item)} style={styles.action}><Ionicons name="ban-outline" size={15} color={colors.danger}/><Text style={[styles.actionText,{color:colors.danger}]}>Banir autor</Text></TouchableOpacity>}
      </View>
    </View>}/>
  </View>;
}

const styles=StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.accent},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:15,color:colors.muted,marginBottom:12},search:{height:48,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:14},searchInput:{flex:1,paddingHorizontal:8},compose:{flexDirection:'row',gap:8,alignItems:'flex-end',marginVertical:12},input:{flex:1,minHeight:50,maxHeight:110,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12},send:{width:48,height:48,borderRadius:24,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:15,marginBottom:9},top:{flexDirection:'row',justifyContent:'space-between'},name:{fontSize:17,fontWeight:'700'},role:{fontSize:12,color:colors.muted,marginTop:1},body:{fontSize:16,lineHeight:22,marginTop:10},actions:{flexDirection:'row',gap:12,marginTop:12},action:{flexDirection:'row',alignItems:'center',gap:5},actionText:{fontSize:13,fontWeight:'700',color:colors.warning}
});
