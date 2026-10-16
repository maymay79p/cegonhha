import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { solicitarVinculoPorCodigo, concluirVinculoAprovado } from '../services/vinculo';
import { desregistrarDispositivoPush } from '../services/pushNotifications';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { formatarCPF, formatarTelefoneBR, somenteDigitos, validarCPF, validarTelefoneBR } from '../utils/validacao';
import { radius, shadow, ThemeColors } from '../theme';

export default function Perfil({ navigation }: any) {
  const { perfil, user, recarregarPerfil } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const ehPortaria = perfil?.tipo === 'porteiro';
  const styles = useMemo(() => makeStyles(colors, ehPortaria), [colors, ehPortaria]);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [bloco, setBloco] = useState('');
  const [apartamento, setApartamento] = useState('');
  const [codigo, setCodigo] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    setNome(perfil.nome || '');
    setCpf(formatarCPF(perfil.cpf || ''));
    setTelefone(formatarTelefoneBR(perfil.telefone || ''));
    setBloco(perfil.bloco || '');
    setApartamento(perfil.apartamento || '');
  }, [perfil?.nome, perfil?.cpf, perfil?.telefone, perfil?.bloco, perfil?.apartamento]);

  useEffect(() => {
    let ativo = true;
    if (!user) return;
    getDoc(doc(db, 'fotosPerfil', user.uid)).then(s => {
      if (ativo && s.exists()) setFotoPerfil(String(s.data()?.fotoPerfil || ''));
    }).catch(() => {});
    return () => { ativo = false; };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || perfil?.tipo !== 'morador' || perfil?.condominioId) {
      setSolicitacao(null);
      return;
    }
    const q = query(collection(db, 'solicitacoesCondominio'), where('moradorId', '==', user.uid));
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      lista.sort((a,b)=>(b.atualizadoEm?.seconds||b.criadoEm?.seconds||0)-(a.atualizadoEm?.seconds||a.criadoEm?.seconds||0));
      setSolicitacao(lista.find(i => i.status !== 'concluida') || null);
    }, () => setSolicitacao(null));
  }, [user?.uid, perfil?.tipo, perfil?.condominioId]);

  async function salvarDados() {
    if (!user || !perfil) return;
    if (!nome.trim()) return Alert.alert('Perfil', 'Informe seu nome.');
    if (!validarCPF(cpf)) return Alert.alert('CPF inválido', 'Informe um CPF válido no formato 000.000.000-00.');
    if (!validarTelefoneBR(telefone)) return Alert.alert('Telefone inválido', 'Informe um telefone brasileiro válido com DDD, por exemplo (53) 99999-9999.');
    if (perfil.tipo === 'morador' && (!bloco.trim() || !apartamento.trim())) return Alert.alert('Perfil', 'Informe bloco e apartamento.');
    try {
      setSalvando(true);
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nome: nome.trim(),
        cpf: somenteDigitos(cpf),
        telefone: formatarTelefoneBR(telefone),
        bloco: perfil.tipo === 'morador' ? bloco.trim().toUpperCase() : '',
        apartamento: perfil.tipo === 'morador' ? apartamento.trim() : '',
        atualizadoEm: serverTimestamp(),
      });
      await recarregarPerfil();
      Alert.alert('Perfil atualizado', 'As alterações já foram sincronizadas com o aplicativo.');
    } catch (e:any) {
      Alert.alert('Perfil', e?.message || 'Não foi possível salvar seus dados.');
    } finally { setSalvando(false); }
  }

  async function solicitarCondominio() {
    if (!user || !perfil || !codigo.trim()) return Alert.alert('Código', 'Digite o código do condomínio.');
    try {
      setSalvando(true);
      const resultado = await solicitarVinculoPorCodigo({ moradorId:user.uid, moradorNome:perfil.nome, email:perfil.email, bloco:perfil.bloco, apartamento:perfil.apartamento, codigo });
      setCodigo('');
      Alert.alert('Solicitação enviada', resultado.status === 'aprovada' ? 'Sua entrada já foi aprovada. Toque em “Concluir vínculo”.' : 'A portaria recebeu sua solicitação de entrada.');
    } catch (e:any) { Alert.alert('Vínculo', e?.message || 'Não foi possível solicitar o vínculo.'); }
    finally { setSalvando(false); }
  }

  async function concluirVinculo() {
    if (!user || !solicitacao || solicitacao.status !== 'aprovada') return;
    try {
      setSalvando(true);
      const dados = await concluirVinculoAprovado({ moradorId:user.uid, solicitacaoId:solicitacao.id });
      await recarregarPerfil();
      Alert.alert('Vínculo concluído', `Sua conta agora pertence ao condomínio ${dados.condominioNome}.`);
    } catch (e:any) { Alert.alert('Vínculo', e?.message || 'Não foi possível concluir o vínculo.'); }
    finally { setSalvando(false); }
  }

  async function copiarCodigo() {
    if (!perfil?.condominioCodigo) return;
    await Clipboard.setStringAsync(perfil.condominioCodigo);
    Alert.alert('Código copiado', 'O código do condomínio foi copiado.');
  }

  async function salvarFoto(uri: string) {
    if (!user) return;
    try {
      setSalvandoFoto(true);
      const tratada = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 256, height: 256 } }], { compress:0.55, format:ImageManipulator.SaveFormat.JPEG, base64:true });
      if (!tratada.base64) throw new Error('Não foi possível preparar a foto.');
      if (tratada.base64.length > 400000) throw new Error('A foto ficou muito grande. Escolha outra imagem.');
      const novaFoto = `data:image/jpeg;base64,${tratada.base64}`;
      await setDoc(doc(db, 'fotosPerfil', user.uid), { fotoPerfil:novaFoto, atualizadoEm:serverTimestamp() });
      setFotoPerfil(novaFoto);
    } catch (e:any) { Alert.alert('Foto de perfil', e?.message || 'Não foi possível salvar a foto.'); }
    finally { setSalvandoFoto(false); }
  }

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:0.8 });
    if (!resultado.canceled) await salvarFoto(resultado.assets[0].uri);
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o uso da câmera.');
    const resultado = await ImagePicker.launchCameraAsync({ mediaTypes:['images'], allowsEditing:true, aspect:[1,1], quality:0.8 });
    if (!resultado.canceled) await salvarFoto(resultado.assets[0].uri);
  }

  async function removerFoto() {
    if (!user) return;
    try { setSalvandoFoto(true); await deleteDoc(doc(db, 'fotosPerfil', user.uid)); setFotoPerfil(''); }
    finally { setSalvandoFoto(false); }
  }

  async function sair() {
    await desregistrarDispositivoPush();
    await signOut(auth);
  }

  if (!perfil || !user) return <KeyboardScreen contentContainerStyle={styles.container}><Text style={styles.title}>Carregando perfil...</Text></KeyboardScreen>;

  const isMorador = perfil.tipo === 'morador';
  const inicial = (perfil.nome || 'U').trim().charAt(0).toUpperCase();

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>PERFIL</Text>
    <Text style={styles.title}>Sua conta</Text>
    <View style={styles.identity}>
      <View>{fotoPerfil ? <Image source={{uri:fotoPerfil}} style={styles.photo}/> : <View style={styles.photoFallback}><Text style={styles.initial}>{inicial}</Text></View>}<TouchableOpacity style={styles.cameraBadge} onPress={tirarFoto} disabled={salvandoFoto}><Ionicons name="camera-outline" size={16} color="#fff"/></TouchableOpacity></View>
      <View style={{flex:1}}><Text style={styles.name}>{perfil.nome}</Text><Text style={styles.email}>{perfil.email}</Text><Text style={styles.role}>{isMorador?'Morador':'Portaria'}</Text></View>
    </View>
    <View style={styles.photoActions}><TouchableOpacity style={styles.smallButton} onPress={escolherFoto} disabled={salvandoFoto}><Text style={styles.smallButtonText}>{salvandoFoto?'Salvando...':'Escolher foto'}</Text></TouchableOpacity>{!!fotoPerfil && <TouchableOpacity onPress={removerFoto} disabled={salvandoFoto}><Text style={styles.remove}>Remover</Text></TouchableOpacity>}</View>

    <View style={styles.card}>
      <Text style={styles.cardLabel}>DADOS PESSOAIS</Text>
      <TextInput style={styles.input} placeholder="Nome completo" value={nome} onChangeText={setNome}/>
      <TextInput style={styles.input} placeholder="CPF · 000.000.000-00" keyboardType="numeric" value={cpf} onChangeText={valor=>setCpf(formatarCPF(valor))} maxLength={14}/>
      <Text style={styles.fieldHint}>O CPF precisa ser válido e conter 11 dígitos.</Text>
      <TextInput style={styles.input} placeholder="Telefone · (00) 00000-0000" keyboardType="phone-pad" value={telefone} onChangeText={valor=>setTelefone(formatarTelefoneBR(valor))} maxLength={15}/>
      <Text style={styles.fieldHint}>Use DDD + número de telefone brasileiro.</Text>
      <View style={styles.readonly}><Text style={styles.readonlyLabel}>E-mail de acesso</Text><Text style={styles.readonlyValue}>{perfil.email}</Text></View>
      {isMorador && <View style={styles.twoCols}><TextInput style={[styles.input,styles.half]} placeholder="Bloco" autoCapitalize="characters" value={bloco} onChangeText={setBloco}/><TextInput style={[styles.input,styles.half]} placeholder="Apartamento" value={apartamento} onChangeText={setApartamento}/></View>}
      <TouchableOpacity style={[styles.primary,salvando&&{opacity:.55}]} onPress={salvarDados} disabled={salvando}><Ionicons name="save-outline" size={18} color="#fff"/><Text style={styles.primaryText}>{salvando?'Salvando...':'Salvar alterações'}</Text></TouchableOpacity>
    </View>

    <View style={styles.card}>
      <Text style={styles.cardLabel}>CONDOMÍNIO</Text><Text style={styles.condoName}>{perfil.condominioNome || 'Ainda sem condomínio vinculado'}</Text>
      {!!perfil.condominioCodigo && <TouchableOpacity style={styles.codeRow} onPress={copiarCodigo}><Text style={styles.code}>{perfil.condominioCodigo}</Text><Ionicons name="copy-outline" size={17} color={colors.muted}/><Text style={styles.copyText}>Copiar</Text></TouchableOpacity>}
      {!!perfil.condominioId && <TouchableOpacity style={styles.menuRow} onPress={()=>navigation.navigate('Condominio')}><View style={styles.menuLeft}><Ionicons name="location-outline" size={21} color={colors.text}/><Text style={styles.menuText}>Endereço e localização no mapa</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>}
    </View>

    {isMorador && !perfil.condominioId && <View style={styles.card}>
      <Text style={styles.cardLabel}>VINCULAR CONDOMÍNIO</Text>
      {!solicitacao || solicitacao.status === 'rejeitada' ? <><TextInput style={styles.input} placeholder="Código, ex.: ABC-2DEF" autoCapitalize="characters" autoCorrect={false} value={codigo} onChangeText={setCodigo}/><TouchableOpacity style={styles.primary} onPress={solicitarCondominio} disabled={salvando}><Text style={styles.primaryText}>Enviar solicitação</Text></TouchableOpacity></> : null}
      {solicitacao?.status === 'pendente' && <View style={styles.statusBox}><Ionicons name="time-outline" size={20} color={colors.warning}/><Text style={styles.statusText}>Aguardando aprovação da portaria para {solicitacao.condominioNome}.</Text></View>}
      {solicitacao?.status === 'aprovada' && <><View style={styles.statusBox}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/><Text style={styles.statusText}>Sua entrada foi aprovada.</Text></View><TouchableOpacity style={styles.primary} onPress={concluirVinculo}><Text style={styles.primaryText}>Concluir vínculo</Text></TouchableOpacity></>}
    </View>}

    <View style={styles.card}><Text style={styles.cardLabel}>APARÊNCIA</Text><Text style={styles.themeHelp}>Escolha como o Cegonha deve aparecer neste dispositivo.</Text><View style={styles.themeRow}>{([['light','Claro','sunny-outline'],['dark','Escuro','moon-outline'],['system','Sistema','phone-portrait-outline']] as const).map(([valor,label,icone]) => <TouchableOpacity key={valor} style={[styles.themeButton,mode===valor&&styles.themeButtonActive]} onPress={()=>setMode(valor)}><Ionicons name={icone} size={18} color={mode===valor?'#fff':colors.text}/><Text style={[styles.themeText,mode===valor&&{color:'#fff'}]}>{label}</Text></TouchableOpacity>)}</View></View>

    <TouchableOpacity style={styles.menuRowStandalone} onPress={()=>navigation.navigate('Privacidade')}><View style={styles.menuLeft}><Ionicons name="shield-checkmark-outline" size={21} color={colors.text}/><Text style={styles.menuText}>Privacidade e segurança</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>
    <TouchableOpacity style={styles.logout} onPress={sair}><Ionicons name="log-out-outline" size={19} color={colors.danger}/><Text style={styles.logoutText}>Sair da conta</Text></TouchableOpacity>
  </KeyboardScreen>;
}

function makeStyles(colors: ThemeColors, ehPortaria:boolean) {
  const destaque = ehPortaria ? colors.porter : colors.accent;
  const destaqueSoft = ehPortaria ? colors.porterSoft : colors.accentSoft;
  return StyleSheet.create({
    container:{padding:22,paddingBottom:140,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:destaque},title:{fontSize:36,fontWeight:'700',marginTop:3,marginBottom:18,color:colors.text},identity:{flexDirection:'row',alignItems:'center',gap:15},photo:{width:86,height:86,borderRadius:43},photoFallback:{width:86,height:86,borderRadius:43,backgroundColor:destaqueSoft,alignItems:'center',justifyContent:'center'},initial:{fontSize:34,fontWeight:'700',color:destaque},cameraBadge:{position:'absolute',right:-2,bottom:2,width:30,height:30,borderRadius:15,backgroundColor:destaque,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:colors.background},name:{fontSize:25,fontWeight:'700'},email:{fontSize:15,color:colors.muted,marginTop:1},role:{fontSize:13,fontWeight:'700',color:destaque,marginTop:4},photoActions:{flexDirection:'row',alignItems:'center',gap:15,marginTop:12,marginBottom:16},smallButton:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},smallButtonText:{fontWeight:'700',color:destaque},remove:{fontSize:14,color:colors.danger,fontWeight:'700'},card:{backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border,...shadow,marginBottom:12},cardLabel:{fontSize:11,fontWeight:'700',letterSpacing:1.5,color:colors.muted,marginBottom:10},input:{backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,paddingHorizontal:14,paddingVertical:12,marginBottom:9},fieldHint:{fontSize:12,color:colors.muted,lineHeight:17,marginTop:-5,marginBottom:9},twoCols:{flexDirection:'row',gap:9},half:{flex:1},readonly:{backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:12,marginBottom:9},readonlyLabel:{fontSize:12,color:colors.muted},readonlyValue:{fontSize:16,fontWeight:'600',marginTop:2},primary:{minHeight:48,borderRadius:radius.pill,backgroundColor:destaque,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:4,paddingHorizontal:15},primaryText:{color:'#fff',fontSize:16,fontWeight:'700'},condoName:{fontSize:21,fontWeight:'700'},codeRow:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:destaqueSoft,padding:12,borderRadius:radius.medium,marginTop:10},code:{fontSize:20,fontWeight:'700',letterSpacing:1.5,flex:1,color:destaque},copyText:{fontSize:13,fontWeight:'700',color:destaque},menuRow:{minHeight:48,marginTop:10,borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:10},menuLeft:{flexDirection:'row',alignItems:'center',gap:9,flex:1},menuText:{fontSize:16,fontWeight:'700'},statusBox:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:colors.surfaceSoft,padding:12,borderRadius:radius.medium},statusText:{flex:1,fontSize:15,color:colors.muted},themeHelp:{fontSize:14,color:colors.muted,marginBottom:10},themeRow:{flexDirection:'row',gap:7},themeButton:{flex:1,minHeight:64,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center',gap:4},themeButtonActive:{backgroundColor:destaque,borderColor:destaque},themeText:{fontSize:13,fontWeight:'700'},menuRowStandalone:{minHeight:54,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logout:{height:52,marginTop:10,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},logoutText:{fontSize:16,fontWeight:'700',color:colors.danger},
  });
}
