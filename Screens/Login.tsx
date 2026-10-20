import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { lerPerfilDoCache, PerfilUsuario, useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { fonts, radius, shadow, ThemeColors } from '../theme';

export default function Login({ navigation }: any) {
  const { aplicarPerfilLocal } = useAuth();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<'morador' | 'porteiro'>('morador');
  const [loading, setLoading] = useState(false);
  const [erroLogin, setErroLogin] = useState('');

  const obterPerfil = useCallback(async (uid: string): Promise<PerfilUsuario | null> => {
    const cache = await lerPerfilDoCache(uid);
    if (cache) return cache;
    const snapshot = await getDoc(doc(db, 'usuarios', uid));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as PerfilUsuario;
  }, []);

  const validarEAbrirArea = useCallback(async (uid: string) => {
    const dados = await obterPerfil(uid);
    if (!dados) {
      // Mantém a autenticação: o navegador raiz encaminha para Register, onde
      // uma conta ainda sem perfil pode concluir a confirmação/cadastro.
      feedback.notify('Complete as etapas pendentes para entrar no Cegonha.', { title:'Cadastro ainda não concluído', tone:'info' });
      return false;
    }
    if (dados.tipo !== tipo) {
      await signOut(auth);
      const area = dados.tipo === 'morador' ? 'Morador' : 'Portaria';
      feedback.alert('Tipo de acesso incorreto', `Esta conta pertence à área ${area}. Selecione a opção correta no login.`, undefined, 'warning');
      return false;
    }
    await aplicarPerfilLocal(dados);
    return true;
  }, [aplicarPerfilLocal, feedback, obterPerfil, tipo]);

  async function entrar() {
    setErroLogin('');
    if (!email.trim() || !senha) return setErroLogin('Informe e-mail e senha para continuar.');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
      const usaSenha = cred.user.providerData.some(p => p.providerId === 'password');
      if (usaSenha && !cred.user.emailVerified) {
        // AuthContext não carrega o perfil enquanto o e-mail não estiver
        // confirmado. O usuário segue autenticado e é levado para a etapa de
        // confirmação, onde também pode reenviar o e-mail.
        feedback.notify('Confirme o endereço de e-mail para concluir o cadastro.', { title:'Confirmação pendente', tone:'info' });
        return;
      }
      await validarEAbrirArea(cred.user.uid);
    } catch (e:any) {
      const codigo = String(e?.code || '');
      if (codigo.includes('invalid-credential') || codigo.includes('wrong-password') || codigo.includes('user-not-found')) setErroLogin('E-mail ou senha incorretos.');
      else feedback.alert('Não foi possível entrar', e?.message || 'Tente novamente em instantes.', undefined, 'danger');
    } finally { setLoading(false); }
  }

  const entrarComGoogle = useCallback(async (uid: string) => {
    await validarEAbrirArea(uid);
  }, [validarEAbrirArea]);

  const ocupado = loading;
  return <KeyboardScreen contentContainerStyle={styles.container}>
    <View style={styles.topActions}>
      <TouchableOpacity style={styles.accessibilityButton} onPress={()=>navigation.navigate('Acessibilidade')} accessibilityLabel="Abrir configurações de acessibilidade">
        <Ionicons name="accessibility-outline" size={20} color={colors.text}/><Text style={styles.accessibilityText}>Acessibilidade</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.brandMark}><Ionicons name="paper-plane-outline" size={22} color={colors.accent} /></View>
    <Text style={styles.title}>Cegonha</Text>
    <Text style={styles.subtitle}>Encomendas organizadas, sem complicação.</Text>

    <View style={styles.roleRow}>
      <TouchableOpacity style={[styles.roleCard, tipo === 'morador' && styles.roleActive]} onPress={() => {setTipo('morador');setErroLogin('');}} disabled={ocupado} accessibilityRole="button" accessibilityState={{selected:tipo==='morador'}}>
        <Ionicons name="home-outline" size={20} color={tipo === 'morador' ? '#fff' : colors.text} />
        <Text style={[styles.roleTitle, tipo === 'morador' && styles.roleTextActive]}>Morador</Text>
        <Text style={[styles.roleHelp, tipo === 'morador' && styles.roleHelpActive]}>Entregas e avisos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.roleCard, tipo === 'porteiro' && styles.roleActivePorter]} onPress={() => {setTipo('porteiro');setErroLogin('');}} disabled={ocupado} accessibilityRole="button" accessibilityState={{selected:tipo==='porteiro'}}>
        <Ionicons name="cube-outline" size={20} color={tipo === 'porteiro' ? '#fff' : colors.text} />
        <Text style={[styles.roleTitle, tipo === 'porteiro' && styles.roleTextActive]}>Portaria</Text>
        <Text style={[styles.roleHelp, tipo === 'porteiro' && styles.roleHelpActive]}>Recebimento e OCR</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.formCard}>
      <TextInput style={styles.input} placeholder="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={v=>{setEmail(v);setErroLogin('');}} returnKeyType="next" />
      <TextInput style={styles.input} placeholder="Senha" secureTextEntry textContentType="password" value={senha} onChangeText={v=>{setSenha(v);setErroLogin('');}} returnKeyType="done" onSubmitEditing={entrar} />
      {!!erroLogin&&<View style={styles.inlineError} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={18} color={colors.danger}/><Text style={styles.inlineErrorText}>{erroLogin}</Text></View>}
      <TouchableOpacity style={[styles.button, ocupado && styles.disabled, tipo === 'porteiro' && styles.buttonPorter]} onPress={entrar} disabled={ocupado}><Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('RecuperaSenha')} disabled={ocupado}><Text style={styles.linkSoft}>Esqueci minha senha</Text></TouchableOpacity>

      <View style={styles.divider}><View style={styles.line}/><Text style={styles.ou}>ou</Text><View style={styles.line}/></View>
      <GoogleSignInButton tipo={tipo} disabled={ocupado} onSignedIn={entrarComGoogle}/>
    </View>

    <TouchableOpacity style={styles.createLink} onPress={() => navigation.navigate('Register', { tipoInicial: tipo })} disabled={ocupado}><Text style={styles.createText}>Ainda não tem conta? </Text><Text style={styles.createStrong}>Criar cadastro</Text></TouchableOpacity>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{justifyContent:'center',paddingHorizontal:24,paddingTop:28,paddingBottom:90,backgroundColor:colors.background},topActions:{alignItems:'flex-end',marginBottom:10},accessibilityButton:{minHeight:42,paddingHorizontal:12,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',gap:6},accessibilityText:{fontSize:13,fontWeight:'700'},brandMark:{width:46,height:46,borderRadius:23,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:12},title:{fontFamily:fonts.bold,fontSize:56,color:colors.text,textAlign:'center',letterSpacing:-1.2},subtitle:{fontSize:18,textAlign:'center',color:colors.muted,marginTop:2,marginBottom:28},roleRow:{flexDirection:'row',gap:10,marginBottom:16},roleCard:{flex:1,minHeight:94,padding:14,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,justifyContent:'center',...shadow},roleActive:{backgroundColor:colors.accent,borderColor:colors.accent},roleActivePorter:{backgroundColor:colors.porter,borderColor:colors.porter},roleTitle:{fontSize:18,fontWeight:'700',color:colors.text,marginTop:7},roleTextActive:{color:'#fff'},roleHelp:{fontSize:13,color:colors.muted,marginTop:1},roleHelpActive:{color:'#F8F4F5'},formCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border,...shadow},input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:16,paddingVertical:14,marginBottom:10},inlineError:{flexDirection:'row',gap:7,alignItems:'flex-start',backgroundColor:`${colors.danger}12`,padding:10,borderRadius:radius.medium,marginBottom:10},inlineErrorText:{flex:1,fontSize:13,lineHeight:18,color:colors.danger,fontWeight:'600'},button:{backgroundColor:colors.accent,paddingHorizontal:18,paddingVertical:15,borderRadius:radius.pill,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:2},buttonPorter:{backgroundColor:colors.porter},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},linkSoft:{textAlign:'center',color:colors.muted,fontSize:15,marginTop:14},divider:{flexDirection:'row',alignItems:'center',marginTop:16,marginBottom:0},line:{flex:1,height:1,backgroundColor:colors.border},ou:{marginHorizontal:10,color:colors.muted,fontSize:14},disabled:{opacity:0.55},createLink:{flexDirection:'row',justifyContent:'center',marginTop:22},createText:{color:colors.muted,fontSize:16},createStrong:{color:colors.text,fontWeight:'700',fontSize:16}
});}
