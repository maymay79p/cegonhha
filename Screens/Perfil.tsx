import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { solicitarVinculoPorCodigo, concluirVinculoAprovado } from '../services/vinculo';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { colors, radius, shadow } from '../theme';

export default function Perfil({ navigation }: any) {
  const { perfil, user, recarregarPerfil } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [fotoPerfil, setFotoPerfil] = useState('');
  const [solicitacao, setSolicitacao] = useState<any>(null);

  async function carregarSolicitacao() {
    if (!user || perfil?.tipo !== 'morador' || perfil?.condominioId) {
      setSolicitacao(null);
      return;
    }

    try {
      const snap = await getDocs(query(collection(db,'solicitacoesCondominio'),where('moradorId','==',user.uid)));
      const lista = snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.atualizadoEm?.seconds||b.criadoEm?.seconds||0)-(a.atualizadoEm?.seconds||a.criadoEm?.seconds||0));
      setSolicitacao(lista.find(i=>i.status!=='concluida') || null);
    } catch {
      setSolicitacao(null);
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregarFoto() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'fotosPerfil', user.uid));
        if (ativo && snap.exists()) setFotoPerfil(String(snap.data()?.fotoPerfil || ''));
      } catch {}
    }

    carregarFoto();
    carregarSolicitacao();

    return () => { ativo = false; };
  }, [user?.uid, perfil?.tipo, perfil?.condominioId]);

  async function sair() {
    try { await signOut(auth); }
    catch { Alert.alert('Erro', 'Não foi possível sair.'); }
  }

  async function solicitarCondominio() {
    if (!user || !perfil || !codigo.trim()) {
      return Alert.alert('Código', 'Digite o código do condomínio.');
    }

    try {
      setSalvando(true);
      const resultado = await solicitarVinculoPorCodigo({
        moradorId: user.uid,
        moradorNome: perfil.nome,
        email: perfil.email,
        bloco: perfil.bloco,
        apartamento: perfil.apartamento,
        codigo,
      });

      setCodigo('');
      await carregarSolicitacao();

      if (resultado.status === 'aprovada') {
        Alert.alert('Código reconhecido', 'Sua solicitação já foi aprovada. Toque em “Concluir vínculo”.');
      } else {
        Alert.alert('Solicitação enviada', 'O código foi reconhecido. A portaria agora pode aprovar sua entrada no condomínio.');
      }
    } catch (e:any) {
      Alert.alert('Vínculo', e?.message || 'Não foi possível vincular sua conta ao condomínio.');
    } finally {
      setSalvando(false);
    }
  }

  async function concluirVinculo() {
    if (!user || !solicitacao || solicitacao.status !== 'aprovada') return;

    try {
      setSalvando(true);
      const dados = await concluirVinculoAprovado({
        moradorId: user.uid,
        solicitacaoId: solicitacao.id,
      });

      await recarregarPerfil();
      setSolicitacao(null);
      Alert.alert('Vínculo concluído', 'Sua conta agora pertence ao condomínio ' + dados.condominioNome + '.');
    } catch(e:any) {
      Alert.alert('Vínculo',e?.message||'Não foi possível concluir o vínculo.');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarCodigo() {
    if (!perfil?.condominioCodigo) return;
    await Clipboard.setStringAsync(perfil.condominioCodigo);
    Alert.alert('Código copiado','O código do condomínio foi copiado.');
  }

  async function salvarFoto(uri: string) {
    if (!user) return;

    try {
      setSalvandoFoto(true);
      const tratada = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!tratada.base64) throw new Error('Não foi possível preparar a foto.');
      if (tratada.base64.length > 400000) throw new Error('A foto ficou muito grande. Escolha outra imagem.');

      const novaFoto = 'data:image/jpeg;base64,' + tratada.base64;
      await setDoc(doc(db, 'fotosPerfil', user.uid), {
        fotoPerfil: novaFoto,
        atualizadoEm: serverTimestamp(),
      });
      setFotoPerfil(novaFoto);
    } catch (e:any) {
      Alert.alert('Foto de perfil', e?.message || 'Não foi possível salvar a foto.');
    } finally {
      setSalvandoFoto(false);
    }
  }

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['images'],
      allowsEditing:true,
      aspect:[1,1],
      quality:0.8,
    });

    if (!resultado.canceled) await salvarFoto(resultado.assets[0].uri);
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o uso da câmera.');

    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes:['images'],
      allowsEditing:true,
      aspect:[1,1],
      quality:0.8,
    });

    if (!resultado.canceled) await salvarFoto(resultado.assets[0].uri);
  }

  async function removerFoto() {
    if (!user) return;

    try {
      setSalvandoFoto(true);
      await deleteDoc(doc(db,'fotosPerfil',user.uid));
      setFotoPerfil('');
    } catch {
      Alert.alert('Foto de perfil','Não foi possível remover a foto.');
    } finally {
      setSalvandoFoto(false);
    }
  }

  const inicial = (perfil?.nome || 'U').trim().charAt(0).toUpperCase();
  const isMorador = perfil?.tipo === 'morador';

  return (
    <KeyboardScreen contentContainerStyle={styles.container}>
      <Text style={[styles.eyebrow,{color:isMorador?colors.accent:colors.porter}]}>PERFIL</Text>
      <Text style={styles.title}>Sua conta</Text>

      <View style={styles.identity}>
        <View>
          {fotoPerfil ? (
            <Image source={{uri:fotoPerfil}} style={styles.photo}/>
          ) : (
            <View style={styles.photoFallback}><Text style={styles.initial}>{inicial}</Text></View>
          )}
          <TouchableOpacity style={styles.cameraBadge} onPress={tirarFoto} disabled={salvandoFoto}>
            <Ionicons name="camera-outline" size={16} color="#fff"/>
          </TouchableOpacity>
        </View>

        <View style={{flex:1}}>
          <Text style={styles.name}>{perfil?.nome || 'Usuário'}</Text>
          <Text style={styles.email}>{perfil?.email || ''}</Text>
          <Text style={styles.role}>{isMorador?'Morador':'Portaria'}</Text>
        </View>
      </View>

      <View style={styles.photoActions}>
        <TouchableOpacity style={styles.smallButton} onPress={escolherFoto} disabled={salvandoFoto}>
          <Text style={styles.smallButtonText}>{salvandoFoto?'Salvando...':'Escolher foto'}</Text>
        </TouchableOpacity>
        {!!fotoPerfil&&(
          <TouchableOpacity onPress={removerFoto} disabled={salvandoFoto}>
            <Text style={styles.remove}>Remover</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>CONDOMÍNIO</Text>
        <Text style={styles.condoName}>{perfil?.condominioNome || 'Ainda sem condomínio vinculado'}</Text>

        {!!perfil?.condominioCodigo&&(
          <TouchableOpacity style={styles.codeRow} onPress={copiarCodigo}>
            <Text style={styles.code}>{perfil.condominioCodigo}</Text>
            {!isMorador&&(
              <>
                <Ionicons name="copy-outline" size={17} color={colors.muted}/>
                <Text style={styles.copyText}>Copiar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isMorador&&<Text style={styles.meta}>Bloco {perfil?.bloco||'-'} · Ap. {perfil?.apartamento||'-'}</Text>}
        {!!perfil?.telefone&&<Text style={styles.meta}>Telefone: {perfil.telefone}</Text>}
      </View>

      {isMorador&&!perfil?.condominioId&&(
        <View style={styles.linkCard}>
          <Text style={styles.linkTitle}>Vincular ao condomínio</Text>
          <Text style={styles.linkText}>Digite o código fornecido pela portaria. O app valida o condomínio antes de enviar sua solicitação.</Text>

          {!solicitacao&&(
            <>
              <TextInput
                style={styles.input}
                placeholder="Código, ex.: ABC-2DEF"
                autoCapitalize="characters"
                autoCorrect={false}
                value={codigo}
                onChangeText={setCodigo}
                returnKeyType="done"
                onSubmitEditing={solicitarCondominio}
              />
              <TouchableOpacity style={[styles.primary,salvando&&{opacity:.55}]} onPress={solicitarCondominio} disabled={salvando}>
                <Text style={styles.primaryText}>{salvando?'Verificando...':'Usar código do condomínio'}</Text>
              </TouchableOpacity>
            </>
          )}

          {solicitacao?.status==='pendente'&&(
            <View style={styles.statusBox}>
              <Ionicons name="time-outline" size={20} color={colors.warning}/>
              <View style={{flex:1}}>
                <Text style={styles.statusTitle}>Código reconhecido</Text>
                <Text style={styles.statusText}>{solicitacao.condominioNome} · aguardando aprovação da portaria</Text>
              </View>
            </View>
          )}

          {solicitacao?.status==='rejeitada'&&(
            <>
              <View style={styles.statusBox}>
                <Ionicons name="close-circle-outline" size={20} color={colors.danger}/>
                <View style={{flex:1}}>
                  <Text style={styles.statusTitle}>Solicitação recusada</Text>
                  <Text style={styles.statusText}>Confira o código com a portaria. Você pode reenviar para o mesmo condomínio ou tentar outro.</Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Digite o código novamente"
                autoCapitalize="characters"
                autoCorrect={false}
                value={codigo}
                onChangeText={setCodigo}
                returnKeyType="done"
                onSubmitEditing={solicitarCondominio}
              />
              <TouchableOpacity style={styles.primary} onPress={solicitarCondominio}>
                <Text style={styles.primaryText}>Enviar novamente</Text>
              </TouchableOpacity>
            </>
          )}

          {solicitacao?.status==='aprovada'&&(
            <>
              <View style={styles.statusBox}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/>
                <View style={{flex:1}}>
                  <Text style={styles.statusTitle}>Entrada aprovada</Text>
                  <Text style={styles.statusText}>{solicitacao.condominioNome}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.primary} onPress={concluirVinculo} disabled={salvando}>
                <Text style={styles.primaryText}>{salvando?'Concluindo...':'Concluir vínculo'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.menuRow} onPress={()=>navigation.navigate('Privacidade')}>
        <View style={styles.menuLeft}>
          <Ionicons name="shield-checkmark-outline" size={21} color={colors.text}/>
          <Text style={styles.menuText}>Privacidade e segurança</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={sair}>
        <Ionicons name="log-out-outline" size={19} color={colors.danger}/>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </KeyboardScreen>
  );
}

const styles=StyleSheet.create({
  container:{padding:22,paddingBottom:140,backgroundColor:colors.background},
  eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8},
  title:{fontSize:36,fontWeight:'700',marginTop:3,marginBottom:18},
  identity:{flexDirection:'row',alignItems:'center',gap:15},
  photo:{width:86,height:86,borderRadius:43},
  photoFallback:{width:86,height:86,borderRadius:43,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},
  initial:{fontSize:34,fontWeight:'700',color:colors.accent},
  cameraBadge:{position:'absolute',right:-2,bottom:2,width:30,height:30,borderRadius:15,backgroundColor:colors.text,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:colors.background},
  name:{fontSize:25,fontWeight:'700'},
  email:{fontSize:15,color:colors.muted,marginTop:1},
  role:{fontSize:13,fontWeight:'700',color:colors.accent,marginTop:4},
  photoActions:{flexDirection:'row',alignItems:'center',gap:15,marginTop:12,marginBottom:16},
  smallButton:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  smallButtonText:{fontWeight:'700'},
  remove:{fontSize:14,color:colors.danger,fontWeight:'700'},
  card:{backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border,...shadow},
  cardLabel:{fontSize:11,fontWeight:'700',letterSpacing:1.5,color:colors.muted},
  condoName:{fontSize:22,fontWeight:'700',marginTop:5},
  codeRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:9},
  code:{fontSize:20,fontWeight:'700',letterSpacing:1.2,color:colors.accent},
  copyText:{fontSize:13,color:colors.muted},
  meta:{fontSize:15,color:colors.muted,marginTop:6},
  linkCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border,marginTop:12},
  linkTitle:{fontSize:22,fontWeight:'700'},
  linkText:{fontSize:15,lineHeight:21,color:colors.muted,marginTop:5},
  input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:14,paddingVertical:12,marginTop:12},
  primary:{height:48,borderRadius:radius.pill,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',marginTop:10},
  primaryText:{color:'#fff',fontWeight:'700',fontSize:16},
  statusBox:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:14,marginTop:12},
  statusTitle:{fontSize:16,fontWeight:'700'},
  statusText:{fontSize:14,color:colors.muted,marginTop:2},
  menuRow:{height:58,borderRadius:radius.medium,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,marginTop:12,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  menuLeft:{flexDirection:'row',alignItems:'center',gap:10},
  menuText:{fontSize:16,fontWeight:'700'},
  logout:{height:52,borderRadius:radius.pill,backgroundColor:'#F7EAEA',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:13},
  logoutText:{fontSize:16,fontWeight:'700',color:colors.danger}
});
