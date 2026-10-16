import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { marcarMuralComoVisto } from '../hooks/useTabBadges';
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
  const isFocused = useIsFocused();
  const ehPortaria = perfil?.tipo === 'porteiro';
  const destaque = ehPortaria ? colors.porter : colors.accent;
  const styles = useMemo(() => makeStyles(colors, ehPortaria), [colors, ehPortaria]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [banido, setBanido] = useState(false);
  const [banidos, setBanidos] = useState<Record<string, any>>({});
  const [gerenciarBanidos, setGerenciarBanidos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [processandoBanId, setProcessandoBanId] = useState('');
  const [denunciaItem, setDenunciaItem] = useState<any>(null);
  const [motivoDenuncia, setMotivoDenuncia] = useState('');
  const [detalhesDenuncia, setDetalhesDenuncia] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  useEffect(() => {
    if (!perfil?.condominioId) return;
    const q = query(collection(db, 'mural'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      dados.sort((a,b)=>{
        const bData = b.criadoEm?.seconds ? b.criadoEm.seconds * 1000 : b.criadoEmCliente || 0;
        const aData = a.criadoEm?.seconds ? a.criadoEm.seconds * 1000 : a.criadoEmCliente || 0;
        return bData - aData;
      });
      setItens(dados);
    }, e => Alert.alert('Mural', mensagemErro(e, 'Não foi possível carregar as publicações.')));
  }, [perfil?.condominioId]);

  useEffect(() => {
    if (!perfil?.condominioId || !user?.uid) {
      setBanido(false);
      return;
    }
    return onSnapshot(doc(db,'muralBanidos',idBanimento(perfil.condominioId,user.uid)), snap => {
      setBanido(snap.exists() && snap.data()?.ativo === true);
    },()=>setBanido(false));
  }, [perfil?.condominioId, user?.uid]);

  useEffect(() => {
    if (!perfil?.condominioId) {
      setBanidos({});
      return;
    }
    const q = query(collection(db, 'muralBanidos'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const mapa:Record<string,any> = {};
      snap.docs.forEach(d => {
        const dado = d.data();
        if (dado?.usuarioId && dado?.ativo === true) mapa[String(dado.usuarioId)] = { id:d.id, ...dado };
      });
      setBanidos(mapa);
    }, () => setBanidos({}));
  }, [perfil?.condominioId]);

  useEffect(() => {
    if (!isFocused || !user?.uid || !perfil?.condominioId) return;
    void marcarMuralComoVisto(user.uid, perfil.condominioId);
  }, [isFocused, itens, user?.uid, perfil?.condominioId]);

  const exibidos = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return !b ? itens : itens.filter(i => `${i.autorNome || ''} ${i.texto || ''}`.toLowerCase().includes(b));
  }, [itens, busca]);

  const banidosAtivos = useMemo(() => Object.values(banidos).sort((a:any,b:any) => String(a.usuarioNome||'').localeCompare(String(b.usuarioNome||''),'pt-BR')), [banidos]);

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
      const denunciaRef = doc(collection(db, 'muralDenuncias'));
      const notificacaoRef = doc(collection(db, 'notificacoes'));
      const denuncianteNome = perfil.nome || user.displayName || 'Usuário';
      const batch = writeBatch(db);
      batch.set(denunciaRef, {
        condominioId: perfil.condominioId,
        comentarioId: denunciaItem.id,
        comentarioTexto: denunciaItem.texto || '',
        autorId: denunciaItem.autorId,
        autorNome: denunciaItem.autorNome || '',
        autorTipo: denunciaItem.autorTipo || '',
        denuncianteId: user.uid,
        denuncianteNome,
        motivo: motivoDenuncia,
        detalhes: detalhesDenuncia.trim(),
        criadoEm: serverTimestamp(),
        status: 'pendente',
      });
      batch.set(notificacaoRef, {
        destinatarioTipo: 'porteiro',
        condominioId: perfil.condominioId,
        remetenteId: user.uid,
        remetenteNome: denuncianteNome,
        referenciaId: denunciaRef.id,
        tipo: 'denuncia',
        mensagem: `${denuncianteNome} denunciou uma publicação de ${denunciaItem.autorNome || 'um usuário'} · ${motivoDenuncia}.`,
        lidaPor: [],
        criadaEm: serverTimestamp(),
      });
      await batch.commit();
      setDenunciaItem(null);
      setMotivoDenuncia('');
      setDetalhesDenuncia('');
      Alert.alert('Denúncia enviada', 'A denúncia foi registrada, a portaria foi avisada e você pode acompanhar o andamento na Central de denúncias.');
    } catch (e:any) {
      Alert.alert('Mural', mensagemErro(e, 'Não foi possível enviar a denúncia.'));
    } finally {
      setEnviandoDenuncia(false);
    }
  }

  async function alterarBanimento(usuarioId:string, usuarioNome:string, ativo:boolean) {
    if (!ehPortaria || !perfil?.condominioId || !user || !usuarioId) return;
    if (usuarioId === user.uid) return Alert.alert('Mural', 'Você não pode banir a própria conta.');
    try {
      setProcessandoBanId(usuarioId);
      await setDoc(doc(db, 'muralBanidos', idBanimento(perfil.condominioId,usuarioId)), {
        usuarioId,
        usuarioNome: usuarioNome || 'Usuário',
        condominioId: perfil.condominioId,
        ativo,
        banidoPorId: ativo ? user.uid : '',
        banidoPorNome: ativo ? (perfil.nome || 'Portaria') : '',
        atualizadoEm: serverTimestamp(),
        ...(ativo ? { banidoEm: serverTimestamp() } : { desbanidoEm: serverTimestamp(), desbanidoPorId:user.uid, desbanidoPorNome:perfil.nome || 'Portaria' }),
      }, { merge: true });
      Alert.alert(ativo ? 'Usuário banido' : 'Banimento desfeito', ativo ? 'Esse usuário não poderá publicar novas mensagens neste mural.' : 'O usuário voltou a poder publicar no mural do condomínio.');
    } catch (e:any) {
      Alert.alert('Mural', mensagemErro(e, ativo ? 'Não foi possível banir o usuário.' : 'Não foi possível desfazer o banimento.'));
    } finally {
      setProcessandoBanId('');
    }
  }

  function excluir(item:any){
    if (!user) return;
    const ehAutor = item.autorId === user.uid;
    const podeExcluir = ehAutor || ehPortaria;
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
      <View style={styles.headerActions}>
        {ehPortaria && banidosAtivos.length>0 && <TouchableOpacity style={styles.bannedCenter} onPress={()=>setGerenciarBanidos(true)} accessibilityLabel="Gerenciar perfis banidos">
          <Ionicons name="ban-outline" size={19} color={colors.danger}/>
          <Text style={styles.bannedCenterText}>Banidos {banidosAtivos.length}</Text>
        </TouchableOpacity>}
        <TouchableOpacity style={styles.reportCenter} onPress={()=>navigation.navigate('Denuncias')} accessibilityLabel="Abrir central de denúncias">
          <Ionicons name="flag-outline" size={20} color={colors.warning}/>
          <Text style={styles.reportCenterText}>Denúncias</Text>
        </TouchableOpacity>
      </View>
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

    <Text style={styles.communityRule}>Respeite a comunidade: linguagem ofensiva ou imprópria é bloqueada antes da publicação.</Text>
    {banido&&<View style={styles.banned}><Ionicons name="ban-outline" size={18} color={colors.danger}/><Text style={styles.bannedText}>Sua conta pode ler o mural, mas não pode publicar novas mensagens.</Text></View>}

    <FlatList
      data={exibidos}
      keyExtractor={i=>i.id}
      contentContainerStyle={{paddingBottom:120}}
      ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="Mural vazio" text="Seja a primeira pessoa a publicar algo para o condomínio."/>}
      renderItem={({item})=>{
        const ehAutor = !!user && item.autorId === user.uid;
        const podeExcluir = ehAutor || ehPortaria;
        const autorBanido = !!banidos[item.autorId];
        const processando = processandoBanId === item.autorId;
        return <View style={[styles.card,autorBanido&&styles.cardBanned]}>
          <View style={styles.top}>
            <View style={{flex:1}}>
              <View style={styles.nameLine}>
                <Text style={[styles.name,autorBanido&&styles.nameBanned]}>{item.autorNome || 'Usuário'}</Text>
                {autorBanido&&<View style={styles.bannedBadge}><Ionicons name="ban" size={12} color={colors.danger}/><Text style={styles.bannedBadgeText}>Perfil banido</Text></View>}
              </View>
              <Text style={styles.role}>{item.autorTipo === 'porteiro' ? 'Portaria' : 'Morador'} · {dataPublicacao(item)}</Text>
            </View>
            {podeExcluir&&<TouchableOpacity onPress={()=>excluir(item)} accessibilityLabel="Excluir publicação"><Ionicons name="trash-outline" size={19} color={colors.danger}/></TouchableOpacity>}
          </View>
          <Text style={styles.body}>{item.texto}</Text>
          <View style={styles.actions}>
            {!ehAutor && <TouchableOpacity onPress={()=>abrirDenuncia(item)} style={styles.action}><Ionicons name="flag-outline" size={15} color={colors.warning}/><Text style={styles.actionText}>Denunciar</Text></TouchableOpacity>}
            {ehPortaria && !ehAutor && <TouchableOpacity onPress={()=>alterarBanimento(item.autorId,item.autorNome||'Usuário',!autorBanido)} style={styles.action} disabled={processando}>
              <Ionicons name={autorBanido?'person-add-outline':'ban-outline'} size={15} color={autorBanido?colors.success:colors.danger}/>
              <Text style={[styles.actionText,{color:autorBanido?colors.success:colors.danger}]}>{processando?'Processando...':autorBanido?'Desbanir autor':'Banir autor'}</Text>
            </TouchableOpacity>}
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
            {MOTIVOS.map(motivo=><TouchableOpacity key={motivo} style={[styles.reason,motivoDenuncia===motivo&&styles.reasonActive]} onPress={()=>setMotivoDenuncia(motivo)}><Ionicons name={motivoDenuncia===motivo?'radio-button-on':'radio-button-off'} size={18} color={motivoDenuncia===motivo?destaque:colors.muted}/><Text style={styles.reasonText}>{motivo}</Text></TouchableOpacity>)}
          </View>
          <TextInput style={styles.detailsInput} placeholder="Detalhes opcionais" value={detalhesDenuncia} onChangeText={setDetalhesDenuncia} multiline maxLength={300}/>
          <TouchableOpacity style={[styles.reportButton,(!motivoDenuncia||enviandoDenuncia)&&{opacity:.45}]} onPress={enviarDenuncia} disabled={!motivoDenuncia||enviandoDenuncia}>
            <Ionicons name="flag" size={17} color="#fff"/><Text style={styles.reportButtonText}>{enviandoDenuncia?'Enviando...':'Enviar denúncia'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <Modal visible={ehPortaria&&gerenciarBanidos} transparent animationType="fade" onRequestClose={()=>setGerenciarBanidos(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalTop}>
            <View style={{flex:1}}><Text style={styles.modalTitle}>Perfis banidos</Text><Text style={styles.modalHelp}>A Portaria pode desfazer um banimento a qualquer momento.</Text></View>
            <TouchableOpacity onPress={()=>setGerenciarBanidos(false)}><Ionicons name="close" size={23} color={colors.muted}/></TouchableOpacity>
          </View>
          <ScrollView style={styles.bannedList} showsVerticalScrollIndicator={false}>
            {banidosAtivos.length ? banidosAtivos.map((item:any)=><View key={item.usuarioId} style={styles.bannedPerson}>
              <View style={styles.bannedPersonIcon}><Ionicons name="person-outline" size={19} color={colors.danger}/></View>
              <View style={{flex:1}}><Text style={styles.bannedPersonName}>{item.usuarioNome||'Usuário'}</Text><Text style={styles.bannedPersonMeta}>Sem permissão para publicar no mural</Text></View>
              <TouchableOpacity style={styles.unbanButton} onPress={()=>alterarBanimento(item.usuarioId,item.usuarioNome||'Usuário',false)} disabled={processandoBanId===item.usuarioId}>
                <Text style={styles.unbanText}>{processandoBanId===item.usuarioId?'...':'Desbanir'}</Text>
              </TouchableOpacity>
            </View>) : <Text style={styles.modalHelp}>Não há perfis banidos neste condomínio.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

function makeStyles(colors:ThemeColors, ehPortaria:boolean){
  const destaque=ehPortaria?colors.porter:colors.accent;
  const destaqueSoft=ehPortaria?colors.porterSoft:colors.accentSoft;
  return StyleSheet.create({
    container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},
    headingRow:{flexDirection:'row',alignItems:'flex-start',gap:10},
    eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:destaque},
    title:{fontSize:34,fontWeight:'700',marginTop:3},
    subtitle:{fontSize:15,color:colors.muted,marginBottom:12},
    headerActions:{flexDirection:'row',alignItems:'flex-start',gap:6},
    reportCenter:{alignItems:'center',justifyContent:'center',gap:3,minWidth:68,minHeight:54,paddingHorizontal:8,borderRadius:radius.medium,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
    reportCenterText:{fontSize:11,fontWeight:'700',color:colors.warning},
    bannedCenter:{alignItems:'center',justifyContent:'center',gap:3,minWidth:68,minHeight:54,paddingHorizontal:8,borderRadius:radius.medium,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.danger},
    bannedCenterText:{fontSize:11,fontWeight:'700',color:colors.danger},
    search:{height:48,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:14},
    searchInput:{flex:1,paddingHorizontal:8},
    compose:{flexDirection:'row',gap:8,alignItems:'flex-end',marginVertical:12},
    input:{flex:1,minHeight:50,maxHeight:110,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12},
    send:{width:48,height:48,borderRadius:24,backgroundColor:destaque,alignItems:'center',justifyContent:'center'},
    communityRule:{fontSize:12,color:colors.muted,lineHeight:17,marginTop:-4,marginBottom:10},
    banned:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:12,marginBottom:10,borderWidth:1,borderColor:colors.danger},
    bannedText:{flex:1,fontSize:14,color:colors.danger},
    card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:15,marginBottom:9},
    cardBanned:{borderColor:colors.danger},
    top:{flexDirection:'row',justifyContent:'space-between',gap:10},
    nameLine:{flexDirection:'row',alignItems:'center',gap:7,flexWrap:'wrap'},
    name:{fontSize:17,fontWeight:'700'},
    nameBanned:{color:colors.danger},
    bannedBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,borderWidth:1,borderColor:colors.danger},
    bannedBadgeText:{fontSize:10,fontWeight:'700',color:colors.danger},
    role:{fontSize:12,color:colors.muted,marginTop:2},
    body:{fontSize:16,lineHeight:22,marginTop:10},
    actions:{flexDirection:'row',gap:12,marginTop:12,flexWrap:'wrap'},
    action:{flexDirection:'row',alignItems:'center',gap:5},
    actionText:{fontSize:13,fontWeight:'700',color:colors.warning},
    modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',alignItems:'center',justifyContent:'center',padding:20},
    modalCard:{width:'100%',maxWidth:520,maxHeight:'82%',backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border},
    modalTop:{flexDirection:'row',gap:10},
    modalTitle:{fontSize:23,fontWeight:'700'},
    modalHelp:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:3},
    reasonList:{marginTop:13,gap:7},
    reason:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,paddingHorizontal:12,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background},
    reasonActive:{borderColor:destaque,backgroundColor:destaqueSoft},
    reasonText:{fontSize:15,fontWeight:'700'},
    detailsInput:{minHeight:76,maxHeight:110,backgroundColor:colors.background,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:11,marginTop:11,textAlignVertical:'top'},
    reportButton:{height:48,borderRadius:radius.pill,backgroundColor:colors.warning,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:12},
    reportButtonText:{color:'#fff',fontSize:15,fontWeight:'700'},
    bannedList:{marginTop:14},
    bannedPerson:{minHeight:62,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.border},
    bannedPersonIcon:{width:38,height:38,borderRadius:19,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},
    bannedPersonName:{fontSize:16,fontWeight:'700',color:colors.danger},
    bannedPersonMeta:{fontSize:12,color:colors.muted,marginTop:2},
    unbanButton:{paddingHorizontal:11,paddingVertical:8,borderRadius:radius.pill,backgroundColor:destaqueSoft},
    unbanText:{fontSize:12,fontWeight:'700',color:destaque},
  });
}
