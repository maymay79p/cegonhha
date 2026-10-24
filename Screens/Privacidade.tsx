import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, reload, sendEmailVerification, signOut, updatePassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { auth, functions } from '../firebase';
import { radius, ThemeColors } from '../theme';

function Bloco({ icon, title, children, colors, styles, iconColor }: any) {
  return <View style={styles.card}>
    <View style={styles.row}><Ionicons name={icon} size={20} color={iconColor || colors.accent} /><Text style={styles.cardTitle}>{title}</Text></View>
    <Text style={styles.body}>{children}</Text>
  </View>;
}

export default function Privacidade({ navigation }: any) {
  const { user, perfil } = useAuth();
  const { colors } = useTheme();
  const ehPortaria=perfil?.tipo==='porteiro';
  const destaque=ehPortaria?colors.porter:colors.accent;
  const styles = useMemo(() => makeStyles(colors,ehPortaria), [colors,ehPortaria]);
  const [emailVerificado,setEmailVerificado]=useState(!!user?.emailVerified);
  const [modalSenha,setModalSenha]=useState(false);
  const [modalExcluir,setModalExcluir]=useState(false);
  const [senhaAtual,setSenhaAtual]=useState('');
  const [novaSenha,setNovaSenha]=useState('');
  const [confirmarSenha,setConfirmarSenha]=useState('');
  const [confirmacaoExcluir,setConfirmacaoExcluir]=useState('');
  const [processando,setProcessando]=useState(false);

  useEffect(()=>setEmailVerificado(!!user?.emailVerified),[user?.uid,user?.emailVerified]);
  const usaSenha=!!user?.providerData?.some(p=>p.providerId==='password');

  async function reenviarVerificacao(){
    if(!user)return;
    if(emailVerificado)return Alert.alert('E-mail verificado','Seu endereço de e-mail já está verificado.');
    try{
      setProcessando(true);
      await sendEmailVerification(user);
      Alert.alert('Verificação enviada',`Enviamos um novo e-mail de verificação para ${user.email||'seu endereço'}.`);
    }catch(e:any){Alert.alert('Verificação de e-mail',e?.message||'Não foi possível reenviar a verificação agora.');}
    finally{setProcessando(false);}
  }

  async function atualizarVerificacao(){
    if(!user)return;
    try{
      setProcessando(true);
      await reload(user);
      setEmailVerificado(user.emailVerified);
      Alert.alert('Status atualizado',user.emailVerified?'Seu e-mail está verificado.':'O e-mail ainda aparece como não verificado. Abra o link enviado para sua caixa de entrada.');
    }catch(e:any){Alert.alert('Conta',e?.message||'Não foi possível atualizar o status.');}
    finally{setProcessando(false);}
  }

  function abrirSenha(){
    if(!usaSenha)return Alert.alert('Alterar senha','Esta conta usa um provedor externo de login. A senha deve ser gerenciada pelo provedor correspondente.');
    setSenhaAtual('');setNovaSenha('');setConfirmarSenha('');setModalSenha(true);
  }

  async function salvarSenha(){
    if(!user?.email)return;
    if(!senhaAtual)return Alert.alert('Senha atual','Informe sua senha atual para confirmar sua identidade.');
    if(novaSenha.length<6)return Alert.alert('Nova senha','Use pelo menos 6 caracteres.');
    if(novaSenha!==confirmarSenha)return Alert.alert('Nova senha','A confirmação da nova senha não coincide.');
    try{
      setProcessando(true);
      const credencial=EmailAuthProvider.credential(user.email,senhaAtual);
      await reauthenticateWithCredential(user,credencial);
      await updatePassword(user,novaSenha);
      setModalSenha(false);
      setSenhaAtual('');setNovaSenha('');setConfirmarSenha('');
      Alert.alert('Senha alterada','Sua nova senha já está valendo para os próximos acessos.');
    }catch(e:any){
      const codigo=String(e?.code||'');
      Alert.alert('Não foi possível alterar',codigo.includes('invalid-credential')||codigo.includes('wrong-password')?'A senha atual informada está incorreta.':e?.message||'Tente novamente.');
    }finally{setProcessando(false);}
  }

  function abrirExclusao(){
    setConfirmacaoExcluir('');
    setModalExcluir(true);
  }

  async function excluirConta(){
    if(confirmacaoExcluir.trim().toUpperCase()!=='EXCLUIR')return Alert.alert('Confirmação necessária','Digite EXCLUIR exatamente como solicitado.');
    try{
      setProcessando(true);
      const excluir=httpsCallable(functions,'excluirMinhaConta');
      await excluir({confirmacao:'EXCLUIR'});
      setModalExcluir(false);
      await signOut(auth).catch(()=>{});
      Alert.alert('Conta excluída','Sua conta de acesso foi removida. Registros operacionais que precisam permanecer foram anonimizados.');
    }catch(e:any){
      const mensagem=String(e?.message||'Não foi possível concluir a exclusão.');
      Alert.alert('Não foi possível excluir',mensagem.replace(/^Firebase:\s*/i,''));
    }finally{setProcessando(false);}
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.eyebrow}>PRIVACIDADE E SEGURANÇA</Text>
      <Text style={styles.title}>Sua conta e seus dados</Text>
      <Text style={styles.intro}>Controle a segurança do acesso e consulte como o Cegonha usa os dados necessários para operar no condomínio.</Text>

      {!!user&&<View style={styles.securityCard}>
        <View style={styles.securityTop}><View style={styles.securityIcon}><Ionicons name="shield-checkmark-outline" size={23} color={destaque}/></View><View style={{flex:1}}><Text style={styles.securityTitle}>Segurança da conta</Text><Text style={styles.securityEmail}>{user.email||'E-mail não informado'}</Text></View></View>
        <View style={styles.verifiedRow}><Ionicons name={emailVerificado?'checkmark-circle':'alert-circle-outline'} size={19} color={emailVerificado?colors.success:colors.warning}/><Text style={[styles.verifiedText,{color:emailVerificado?colors.success:colors.warning}]}>{emailVerificado?'E-mail verificado':'E-mail ainda não verificado'}</Text></View>
        {!emailVerificado&&<View style={styles.securityActions}><TouchableOpacity style={styles.secondaryButton} onPress={reenviarVerificacao} disabled={processando}><Text style={styles.secondaryText}>Reenviar verificação</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={atualizarVerificacao} disabled={processando}><Text style={styles.secondaryText}>Atualizar status</Text></TouchableOpacity></View>}
        <TouchableOpacity style={styles.primaryButton} onPress={abrirSenha} disabled={processando}><Ionicons name="key-outline" size={18} color="#fff"/><Text style={styles.primaryText}>{usaSenha?'Alterar senha':'Gerenciar acesso externo'}</Text></TouchableOpacity>
      </View>}

      <Bloco icon="person-outline" title="Dados do perfil" colors={colors} styles={styles} iconColor={destaque}>Nome, e-mail, CPF, bloco, apartamento, telefone, tipo de acesso e vínculo com o condomínio.</Bloco>
      <Bloco icon="cube-outline" title="Dados das encomendas" colors={colors} styles={styles} iconColor={destaque}>Destinatário, status, datas, responsável pelo registro, histórico, descrição, código de retirada e, quando houver OCR, somente a pontuação de correspondência e os principais dados extraídos. A foto da etiqueta não é anexada à encomenda.</Bloco>
      <Bloco icon="scan-outline" title="OCR externo" colors={colors} styles={styles} iconColor={destaque}>Para reconhecer uma etiqueta, o Cegonha envia temporariamente uma versão comprimida da imagem ao OCR.Space por HTTPS. O Cegonha não salva essa foto nem o texto bruto no Firestore. Depois da confirmação, ficam somente os campos reconhecidos e métricas necessárias para avaliar o OCR.</Bloco>
      <Bloco icon="trash-outline" title="Descarte da leitura" colors={colors} styles={styles} iconColor={destaque}>Após o reconhecimento, a Portaria pode remover apenas a foto da tela e manter os dados reconhecidos, ou descartar a leitura inteira antes de registrar a encomenda.</Bloco>
      <Bloco icon="chatbubbles-outline" title="Mural do condomínio" colors={colors} styles={styles} iconColor={destaque}>Publicações, denúncias e moderação ficam vinculadas ao condomínio. Usuários banidos continuam podendo ler o mural, mas não publicar.</Bloco>
      <Bloco icon="shield-checkmark-outline" title="Separação por condomínio" colors={colors} styles={styles} iconColor={destaque}>As regras do Firestore limitam leituras e alterações conforme o usuário, o perfil e o condomínio vinculado.</Bloco>
      <Bloco icon="analytics-outline" title="Avaliação acadêmica" colors={colors} styles={styles} iconColor={destaque}>As leituras confirmadas geram métricas de tempo, condições da imagem e acerto do primeiro candidato para avaliação do OCR no TCC, sem armazenar a foto ou o texto bruto.</Bloco>

      <View style={styles.dangerCard}>
        <View style={styles.row}><Ionicons name="warning-outline" size={20} color={colors.danger}/><Text style={styles.dangerTitle}>Excluir conta e dados pessoais</Text></View>
        <Text style={styles.body}>Remove a conta de acesso e dados descartáveis. Registros históricos necessários para a operação e auditoria são mantidos sem sua identificação direta. Por segurança, a exclusão exige login recente.</Text>
        {ehPortaria&&<Text style={styles.dangerHint}>Uma conta de Portaria não pode ser excluída se for a última Portaria vinculada ao condomínio.</Text>}
        <TouchableOpacity style={styles.dangerButton} onPress={abrirExclusao} disabled={processando}><Ionicons name="trash-outline" size={18} color={colors.danger}/><Text style={styles.dangerButtonText}>Excluir minha conta</Text></TouchableOpacity>
      </View>
    </ScrollView>

    <Modal visible={modalSenha} transparent animationType="fade" onRequestClose={()=>!processando&&setModalSenha(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <View style={styles.modalTop}><View style={{flex:1}}><Text style={styles.modalTitle}>Alterar senha</Text><Text style={styles.modalHelp}>Confirme sua senha atual e escolha uma nova senha com pelo menos 6 caracteres.</Text></View><TouchableOpacity onPress={()=>setModalSenha(false)} disabled={processando}><Ionicons name="close" size={23} color={colors.muted}/></TouchableOpacity></View>
        <TextInput style={styles.input} placeholder="Senha atual" secureTextEntry value={senhaAtual} onChangeText={setSenhaAtual}/>
        <TextInput style={styles.input} placeholder="Nova senha" secureTextEntry value={novaSenha} onChangeText={setNovaSenha}/>
        <TextInput style={styles.input} placeholder="Confirmar nova senha" secureTextEntry value={confirmarSenha} onChangeText={setConfirmarSenha}/>
        <TouchableOpacity style={[styles.primaryButton,processando&&{opacity:.55}]} onPress={salvarSenha} disabled={processando}><Ionicons name="save-outline" size={18} color="#fff"/><Text style={styles.primaryText}>{processando?'Salvando...':'Salvar nova senha'}</Text></TouchableOpacity>
      </View></View>
    </Modal>

    <Modal visible={modalExcluir} transparent animationType="fade" onRequestClose={()=>!processando&&setModalExcluir(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <View style={styles.modalTop}><View style={{flex:1}}><Text style={styles.modalTitle}>Excluir conta</Text><Text style={styles.modalHelp}>Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar. Se sua sessão tiver mais de 10 minutos, será necessário sair e entrar novamente antes de repetir.</Text></View><TouchableOpacity onPress={()=>setModalExcluir(false)} disabled={processando}><Ionicons name="close" size={23} color={colors.muted}/></TouchableOpacity></View>
        <TextInput style={styles.input} placeholder="Digite EXCLUIR" autoCapitalize="characters" autoCorrect={false} value={confirmacaoExcluir} onChangeText={setConfirmacaoExcluir}/>
        <TouchableOpacity style={[styles.dangerConfirm,processando&&{opacity:.55}]} onPress={excluirConta} disabled={processando}><Ionicons name="trash-outline" size={18} color="#fff"/><Text style={styles.primaryText}>{processando?'Excluindo...':'Excluir definitivamente'}</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors,ehPortaria:boolean){const destaque=ehPortaria?colors.porter:colors.accent;const soft=ehPortaria?colors.porterSoft:colors.accentSoft;return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{padding:22,paddingBottom:42,backgroundColor:colors.background},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',marginBottom:20,borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:13,fontWeight:'700',letterSpacing:2,color:destaque},title:{fontSize:36,fontWeight:'700',lineHeight:39,marginTop:6,color:colors.text},intro:{fontSize:17,lineHeight:24,color:colors.muted,marginTop:10,marginBottom:18},securityCard:{backgroundColor:soft,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,padding:17,marginBottom:12},securityTop:{flexDirection:'row',alignItems:'center',gap:10},securityIcon:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},securityTitle:{fontSize:20,fontWeight:'700'},securityEmail:{fontSize:13,color:colors.muted,marginTop:1},verifiedRow:{flexDirection:'row',alignItems:'center',gap:7,marginTop:13},verifiedText:{fontSize:14,fontWeight:'700'},securityActions:{flexDirection:'row',gap:7,marginTop:11},secondaryButton:{flex:1,minHeight:42,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',paddingHorizontal:8},secondaryText:{fontSize:12,fontWeight:'700',color:destaque},primaryButton:{minHeight:48,borderRadius:radius.pill,backgroundColor:destaque,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:12,paddingHorizontal:15},primaryText:{color:'#fff',fontSize:15,fontWeight:'700'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:17,marginBottom:11},row:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:7},cardTitle:{fontSize:19,fontWeight:'700'},body:{fontSize:16,lineHeight:22,color:colors.muted},dangerCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:`${colors.danger}55`,borderRadius:radius.medium,padding:17,marginTop:2},dangerTitle:{fontSize:19,fontWeight:'700',color:colors.danger},dangerHint:{fontSize:13,lineHeight:18,color:colors.warning,fontWeight:'600',marginTop:9},dangerButton:{minHeight:46,borderRadius:radius.pill,borderWidth:1,borderColor:`${colors.danger}66`,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:14},dangerButtonText:{fontSize:14,fontWeight:'700',color:colors.danger},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',alignItems:'center',justifyContent:'center',padding:20},modalCard:{width:'100%',maxWidth:520,backgroundColor:colors.surface,borderRadius:radius.large,padding:18,borderWidth:1,borderColor:colors.border},modalTop:{flexDirection:'row',gap:10,marginBottom:13},modalTitle:{fontSize:24,fontWeight:'700'},modalHelp:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:3},input:{height:50,borderRadius:radius.medium,backgroundColor:colors.surfaceSoft,paddingHorizontal:13,marginBottom:9},dangerConfirm:{minHeight:48,borderRadius:radius.pill,backgroundColor:colors.danger,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:4,paddingHorizontal:15}
});}
