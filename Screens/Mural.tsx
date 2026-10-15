import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState } from '../components/States';
import { radius, ThemeColors } from '../theme';

function idBanimento(condominioId:string, usuarioId:string){ return `${condominioId}_${usuarioId}`; }

function dataPublicacao(item:any) {
  const timestamp = item?.criadoEm?.toDate?.();
  const data = timestamp instanceof Date ? timestamp : item?.criadoEmCliente ? new Date(item.criadoEmCliente) : null;
  if (!data || Number.isNaN(data.getTime())) return 'Agora';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mensagemErro(e:any, padrao:string) {
  const codigo = String(e?.code || '');
  if (codigo.includes('permission-denied')) return 'O Firebase bloqueou esta ação. Atualize as regras do Firestore do Cegonha e tente novamente.';
  return e?.message || padrao;
}

export default function Mural() {
  const { perfil, user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [banido, setBanido] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!perfil?.condominioId) return;
    const q = query(collection(db, 'mural'), where('condominioId', '==', perfil.condominioId));
    const unsubMural = onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a,b)=>{
        const bData = b.criadoEm?.seconds ? b.criadoEm.seconds * 1000 : b.criadoEmCliente || 0;
        const aData = a.criadoEm?.seconds ? a.criadoEm.seconds * 1000 : a.criadoEmCliente || 0;
        return bData - aData;
      });
      setItens(dados);
    }, e => Alert.alert('Mural', mensagemErro(e, 'Não foi possível carregar as publicações.')));

    const unsubBan = onSnapshot(doc(db,'muralBanidos',idBanimento(perfil.condominioId,perfil.id)), snap => {
      setBanido(snap.exists() && snap.data()?.ativo === true);
    },()=>setBanido(false));

    return()=>{unsubMural();unsubBan();};
  }, [perfil?.condominioId, perfil?.id]);

  const exibidos = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return !b ? itens : itens.filter(i => `${i.autorNome || ''} ${i.texto || ''}`.toLowerCase().includes(b));
  }, [itens, busca]);

  async function publicar() {
    const t = texto.trim();
    if (!perfil?.condominioId || !perfil || !user || !t || enviando) return;
    if (banido) return Alert.alert('Mural', 'Sua conta está impedida de publicar no mural deste condomínio.');
    if (t.length > 1000) return Alert.alert('Mural','A publicação deve ter no máximo 1000 caracteres.');

    setEnviando(true);
    try {
      const autorNome = perfil.nome?.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'Usuário';
      await addDoc(collection(db, 'mural'), {
        condominioId: perfil.condominioId,
        autorId: user.uid,
        autorNome,
        autorTipo: perfil.tipo,
        texto: t,
        criadoEm: serverTimestamp(),
        criadoEmCliente: Date.now(),
      });
      setTexto('');
    } catch (e:any) {
      Alert.alert('Não foi possível publicar', mensagemErro(e, 'Tente novamente em alguns instantes.'));
    } finally {
      setEnviando(false);
    }
  }

  async function denunciar(item: any) {
    if (!perfil || !user || item.autorId === user.uid) return;
    try {
      await addDoc(collection(db, 'muralDenuncias'), {
        condominioId: perfil.condominioId,
        comentarioId: item.id,
        comentarioTexto: item.texto || '',
        autorId: item.autorId,
        autorNome: item.autorNome || '',
        denuncianteId: user.uid,
        denuncianteNome: perfil.nome || user.displayName || '',
        criadoEm: serverTimestamp(),
        status: 'pendente',
      });
      Alert.alert('Denúncia enviada', 'A portaria poderá revisar esta publicação.');
    } catch (e:any) {
      Alert.alert('Mural', mensagemErro(e, 'Não foi possível enviar a denúncia.'));
    }
  }

  async function banir(item: any) {
    if (perfil?.tipo !== 'porteiro' || !perfil.condominioId || !user) return;
    if (item.autorId === user.uid) return Alert.alert('Mural', 'Você não pode banir a própria conta.');
    try {
      await setDoc(doc(db, 'muralBanidos', idBanimento(perfil.condominioId,item.autorId)), {
        usuarioId: item.autorId,
        usuarioNome: item.autorNome || '',
        condominioId: perfil.condominioId,
        ativo: true,
        banidoPorId: user.uid,
        banidoPorNome: perfil.nome || '',
        criadoEm: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Usuário banido', 'Esse usuário não poderá publicar novas mensagens neste mural.');
    } catch (e:any) {
      Alert.alert('Mural', mensagemErro(e, 'Não foi possível banir o usuário.'));
    }
  }

  function excluir(item:any){
    if (!user) return;
    const ehAutor = item.autorId === user.uid;
    const podeExcluir = ehAutor || perfil?.tipo === 'porteiro';
    if (!podeExcluir) return;

    Alert.alert(
      'Excluir publicação',
      ehAutor ? 'Deseja excluir sua publicação do mural?' : 'Deseja remover esta publicação do mural?',
      [
        {text:'Cancelar',style:'cancel'},
        {text:'Excluir',style:'destructive',onPress:()=>deleteDoc(doc(db,'mural',item.id)).catch(e=>Alert.alert('Mural',mensagemErro(e,'Não foi possível excluir.')))},
      ]
    );
  }

  if (!perfil?.condominioId) return <View style={styles.container}><EmptyState icon="people-outline" title="Sem condomínio" text="Vincule sua conta a um condomínio para acessar o mural." /></View>;

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>COMUNIDADE</Text>
    <Text style={styles.title}>Mural do condomínio</Text>
    <Text style={styles.subtitle}>{perfil.condominioNome || 'Condomínio'}</Text>

    <View style={styles.search}><Ionicons name="search-outline" size={18} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Pesquisar no mural" value={busca} onChangeText={setBusca}/></View>

    <View style={styles.compose}>
      <TextInput
        style={styles.input}
        placeholder={banido ? 'Publicação bloqueada pela portaria' : 'Escreva uma mensagem para o condomínio'}
        value={texto}
        onChangeText={setTexto}
        editable={!banido && !enviando}
        multiline
        maxLength={1000}
      />
      <TouchableOpacity style={[styles.send,(!texto.trim()||banido||enviando)&&{opacity:.45}]} onPress={publicar} disabled={!texto.trim()||banido||enviando}>
        <Ionicons name={enviando ? 'hourglass-outline' : 'send'} size={18} color="#fff"/>
      </TouchableOpacity>
    </View>

    {banido&&<View style={styles.banned}><Ionicons name="ban-outline" size={18} color={colors.danger}/><Text style={styles.bannedText}>Sua conta pode ler o mural, mas não pode publicar novas mensagens.</Text></View>}

    <FlatList
      data={exibidos}
      keyExtractor={i=>i.id}
      contentContainerStyle={{paddingBottom:120}}
      ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="Mural vazio" text="Seja a primeira pessoa a publicar algo para o condomínio."/>}
      renderItem={({item})=>{
        const ehAutor = !!user && item.autorId === user.uid;
        const podeExcluir = ehAutor || perfil.tipo === 'porteiro';
        return <View style={styles.card}>
          <View style={styles.top}>
            <View style={{flex:1}}>
              <Text style={styles.name}>{item.autorNome || 'Usuário'}</Text>
              <Text style={styles.role}>{item.autorTipo === 'porteiro' ? 'Portaria' : 'Morador'} · {dataPublicacao(item)}</Text>
            </View>
            {podeExcluir&&<TouchableOpacity onPress={()=>excluir(item)} accessibilityLabel="Excluir publicação"><Ionicons name="trash-outline" size={19} color={colors.danger}/></TouchableOpacity>}
          </View>
          <Text style={styles.body}>{item.texto}</Text>
          <View style={styles.actions}>
            {!ehAutor && <TouchableOpacity onPress={()=>denunciar(item)} style={styles.action}><Ionicons name="flag-outline" size={15} color={colors.warning}/><Text style={styles.actionText}>Denunciar</Text></TouchableOpacity>}
            {perfil.tipo === 'porteiro' && !ehAutor && <TouchableOpacity onPress={()=>banir(item)} style={styles.action}><Ionicons name="ban-outline" size={15} color={colors.danger}/><Text style={[styles.actionText,{color:colors.danger}]}>Banir autor</Text></TouchableOpacity>}
          </View>
        </View>;
      }}
    />
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.accent},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:15,color:colors.muted,marginBottom:12},search:{height:48,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:14},searchInput:{flex:1,paddingHorizontal:8},compose:{flexDirection:'row',gap:8,alignItems:'flex-end',marginVertical:12},input:{flex:1,minHeight:50,maxHeight:110,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12},send:{width:48,height:48,borderRadius:24,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},banned:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:12,marginBottom:10},bannedText:{flex:1,fontSize:14,color:colors.danger},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:15,marginBottom:9},top:{flexDirection:'row',justifyContent:'space-between',gap:10},name:{fontSize:17,fontWeight:'700'},role:{fontSize:12,color:colors.muted,marginTop:2},body:{fontSize:16,lineHeight:22,marginTop:10},actions:{flexDirection:'row',gap:12,marginTop:12},action:{flexDirection:'row',alignItems:'center',gap:5},actionText:{fontSize:13,fontWeight:'700',color:colors.warning}
});}
