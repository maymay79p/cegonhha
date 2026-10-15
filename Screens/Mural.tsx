import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState } from '../components/States';
import { contemLinguagemImpropria } from '../utils/moderacao';
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

const MOTIVOS = ['Spam ou propaganda', 'Ofensa ou assédio', 'Conteúdo impróprio', 'Outro motivo'];

export default function Mural({ navigation }: any) {
  const { perfil, user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [banido, setBanido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [denunciaItem, setDenunciaItem] = useState<any>(null);
  const [motivoDenuncia, setMotivoDenuncia] = useState('');
  const [detalhesDenuncia, setDetalhesDenuncia] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

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
    if (contemLinguagemImpropria(t)) return Alert.alert('Conteúdo não permitido', 'A mensagem contém linguagem ofensiva ou imprópria. Revise o texto antes de publicar.');

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

  function abrirDenuncia(item: any) {
    if (!perfil || !user || item.autorId === user.uid) return;
    setDenunciaItem(item);
    setMotivoDenuncia('');
    setDetalhesDenuncia('');
  }

  async function enviarDenuncia() {
    if (!perfil || !user || !denunciaItem || !motivoDenuncia || enviandoDenuncia) return;
    if (detalhesDenuncia.trim() && contemLinguagemImpropria(detalhesDenuncia)) {
      return Alert.alert('Conteúdo não permitido', 'Os detalhes da denúncia contêm linguagem ofensiva ou imprópria. Revise o texto para continuar.');
    }
    try {
      setEnviandoDenuncia(true);
      await addDoc(collection(db, 'muralDenuncias'), {
        condominioId: perfil.condominioId,
        comentarioId: denunciaItem.id,
        comentarioTexto: denunciaItem.texto || '',
        autorId: denunciaItem.autorId,
        autorNome: denunciaItem.autorNome || '',
        denuncianteId: user.uid,
        denuncianteNome: perfil.nome || user.displayName || '',
        motivo: motivoDenuncia,
        detalhes: detalhesDenuncia.trim(),
        criadoEm: serverTimestamp(),
        status: 'pendente',
      });
      setDenunciaItem(null);
      setMotivoDenuncia('');
      setDetalhesDenuncia('');
      Alert.alert('Denúncia enviada', 'A denúncia foi registrada e já pode ser acompanhada na Central de denúncias.');
    } catch (e:any) {
      Alert.alert('Mural', mensagemErro(e, 'Não foi possível enviar a denúncia.'));
    } finally {
      setEnviandoDenuncia(false);
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
    <View style={styles.headingRow}>
      <View style={{flex:1}}>
        <Text style={styles.eyebrow}>COMUNIDADE</Text>
        <Text style={styles.title}>Mural do condomínio</Text>
        <Text style={styles.subtitle}>{perfil.condominioNome || 'Condomínio'}</Text>
      </View>
      <TouchableOpacity style={styles.reportCenter} onPress={()=>navigation.navigate('Denuncias')} accessibilityLabel="Abrir central de denúncias">
        <Ionicons name="flag-outline" size={20} color={colors.warning}/>
        <Text style={styles.reportCenterText}>Denúncias</Text>
      </TouchableOpacity>
    </View>

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
    <View style={styles.moderationHint}><Ionicons name="shield-checkmark-outline" size={15} color={colors.muted}/><Text style={styles.moderationText}>Mensagens com palavrões, ofensas ou linguagem imprópria são bloqueadas antes da publicação.</Text></View>

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
            {!ehAutor && <TouchableOpacity onPress={()=>abrirDenuncia(item)} style={styles.action}><Ionicons name="flag-outline" size={15} color={colors.warning}/><Text style={styles.actionText}>Denunciar</Text></TouchableOpacity>}
            {perfil.tipo === 'porteiro' && !ehAutor && <TouchableOpacity onPress={()=>banir(item)} style={styles.action}><Ionicons name="ban-outline" size={15} color={colors.danger}/><Text style={[styles.actionText,{color:colors.danger}]}>Banir autor</Text></TouchableOpacity>}
          </View>
        </View>;
      }}
    />

    <Modal visible={!!denunciaItem} transparent animationType="fade" onRequestClose={()=>setDenunciaItem(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalTop}>
            <View style={{flex:1}}><Text style={styles.modalTitle}>Denunciar publicação</Text><Text style={styles.modalHelp}>Escolha o motivo da denúncia. A portaria poderá revisar a publicação.</Text></View>
            <TouchableOpacity onPress={()=>setDenunciaItem(null)}><Ionicons name="close" size={23} color={colors.muted}/></TouchableOpacity>
          </View>
          <View style={styles.reasonList}>
            {MOTIVOS.map(motivo=><TouchableOpacity key={motivo} style={[styles.reason,motivoDenuncia===motivo&&styles.reasonActive]} onPress={()=>setMotivoDenuncia(motivo)}><Ionicons name={motivoDenuncia===motivo?'radio-button-on':'radio-button-off'} size={18} color={motivoDenuncia===motivo?colors.accent:colors.muted}/><Text style={styles.reasonText}>{motivo}</Text></TouchableOpacity>)}
          </View>
          <TextInput style={styles.detailsInput} placeholder="Detalhes opcionais" value={detalhesDenuncia} onChangeText={setDetalhesDenuncia} multiline maxLength={300}/>
          <TouchableOpacity style={[styles.reportButton,(!motivoDenuncia||enviandoDenuncia)&&{opacity:.45}]} onPress={enviarDenuncia} disabled={!motivoDenuncia||enviandoDenuncia}>
            <Ionicons name="flag" size={17} color="#fff"/><Text style={styles.reportButtonText}>{enviandoDenuncia?'Enviando...':'Enviar denúncia'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},headingRow:{flexDirection:'row',alignItems:'flex-start',gap:10},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.accent},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:15,color:colors.muted,marginBottom:12},reportCenter:{alignItems:'center',justifyContent:'center',gap:3,minWidth:74,minHeight:54,paddingHorizontal:9,borderRadius:radius.medium,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},reportCenterText:{fontSize:11,fontWeight:'700',color:colors.warning},search:{height:48,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:14},searchInput:{flex:1,paddingHorizontal:8},compose:{flexDirection:'row',gap:8,alignItems:'flex-end',marginTop:12,marginBottom:6},input:{flex:1,minHeight:50,maxHeight:110,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12},send:{width:48,height:48,borderRadius:24,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},moderationHint:{flexDirection:'row',alignItems:'flex-start',gap:6,marginBottom:10,paddingHorizontal:2},moderationText:{flex:1,fontSize:12,lineHeight:17,color:colors.muted},banned:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:12,marginBottom:10},bannedText:{flex:1,fontSize:14,color:colors.danger},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:15,marginBottom:9},top:{flexDirection:'row',justifyContent:'space-between',gap:10},name:{fontSize:17,fontWeight:'700'},role:{fontSize:12,color:colors.muted,marginTop:2},body:{fontSize:16,lineHeight:22,marginTop:10},actions:{flexDirection:'row',gap:12,marginTop:12},action:{flexDirection:'row',alignItems:'center',gap:5},actionText:{fontSize:13,fontWeight:'700',color:colors.warning},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',alignItems:'center',justifyContent:'center',padding:20},modalCard:{width:'100%',maxWidth:520,backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border},modalTop:{flexDirection:'row',gap:10},modalTitle:{fontSize:23,fontWeight:'700'},modalHelp:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:3},reasonList:{marginTop:13,gap:7},reason:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,paddingHorizontal:12,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background},reasonActive:{borderColor:colors.accent,backgroundColor:colors.accentSoft},reasonText:{fontSize:15,fontWeight:'700'},detailsInput:{minHeight:76,maxHeight:110,backgroundColor:colors.background,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:11,marginTop:11,textAlignVertical:'top'},reportButton:{height:48,borderRadius:radius.pill,backgroundColor:colors.warning,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:12},reportButtonText:{color:'#fff',fontSize:15,fontWeight:'700'}
});}