import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { lerPerfilDoCache, PerfilUsuario, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { fonts, radius, shadow, ThemeColors } from '../theme';

export default function Login({ navigation }: any) {
  const { aplicarPerfilLocal } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<'morador' | 'porteiro'>('morador');
  const [loading, setLoading] = useState(false);

  const obterPerfil = useCallback(async (uid: string): Promise<PerfilUsuario | null> => {
    const cache = await lerPerfilDoCache(uid);
    if (cache) return cache;
    const snapshot = await getDoc(doc(db, 'usuarios', uid));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as PerfilUsuario;
  }, []);

  const validarEAbrirArea = useCallback(async (uid: string, manterAutenticadoSemPerfil = false) => {
    const dados = await obterPerfil(uid);
    if (!dados) {
      if (!manterAutenticadoSemPerfil) {
        await signOut(auth);
        Alert.alert('Perfil não encontrado', 'Sua conta existe no Firebase, mas ainda não possui um perfil no Cegonha. Use “Criar cadastro” para concluir.');
      } else {
        Alert.alert('Primeiro acesso com Google', 'Sua conta Google foi autenticada. Complete agora os dados do seu cadastro no Cegonha.');
      }
      return false;
    }
    if (dados.tipo !== tipo) {
      await signOut(auth);
      const area = dados.tipo === 'morador' ? 'Morador' : 'Portaria';
      Alert.alert('Tipo de acesso incorreto', 'Esta conta pertence à área ' + area + '. Selecione a opção correta no login.');
      return false;
    }
    await aplicarPerfilLocal(dados);
    return true;
  }, [aplicarPerfilLocal, obterPerfil, tipo]);

  async function entrar() {
    if (!email.trim() || !senha) return Alert.alert('Atenção', 'Informe e-mail e senha.');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
      await validarEAbrirArea(cred.user.uid);
    } catch (e:any) {
      const codigo = String(e?.code || '');
      if (codigo.includes('invalid-credential') || codigo.includes('wrong-password') || codigo.includes('user-not-found')) Alert.alert('Login', 'E-mail ou senha incorretos.');
      else Alert.alert('Erro', e?.message || 'Não foi possível entrar.');
    } finally { setLoading(false); }
  }

  const entrarComGoogle = useCallback(async (uid: string) => {
    await validarEAbrirArea(uid, true);
  }, [validarEAbrirArea]);

  const ocupado = loading;
  return <KeyboardScreen contentContainerStyle={styles.container}>
    <View style={styles.brandMark}><Ionicons name="paper-plane-outline" size={22} color={colors.accent} /></View>
    <Text style={styles.title}>Cegonha</Text>
    <Text style={styles.subtitle}>Encomendas organizadas, sem complicação.</Text>

    <View style={styles.roleRow}>
      <TouchableOpacity style={[styles.roleCard, tipo === 'morador' && styles.roleActive]} onPress={() => setTipo('morador')} disabled={ocupado}>
        <Ionicons name="home-outline" size={20} color={tipo === 'morador' ? '#fff' : colors.text} />
        <Text style={[styles.roleTitle, tipo === 'morador' && styles.roleTextActive]}>Morador</Text>
        <Text style={[styles.roleHelp, tipo === 'morador' && styles.roleHelpActive]}>Entregas e avisos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.roleCard, tipo === 'porteiro' && styles.roleActivePorter]} onPress={() => setTipo('porteiro')} disabled={ocupado}>
        <Ionicons name="cube-outline" size={20} color={tipo === 'porteiro' ? '#fff' : colors.text} />
        <Text style={[styles.roleTitle, tipo === 'porteiro' && styles.roleTextActive]}>Portaria</Text>
        <Text style={[styles.roleHelp, tipo === 'porteiro' && styles.roleHelpActive]}>Recebimento e OCR</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.formCard}>
      <TextInput style={styles.input} placeholder="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} returnKeyType="next" />
      <TextInput style={styles.input} placeholder="Senha" secureTextEntry textContentType="password" value={senha} onChangeText={setSenha} returnKeyType="done" onSubmitEditing={entrar} />
      <TouchableOpacity style={[styles.button, ocupado && styles.disabled, tipo === 'porteiro' && styles.buttonPorter]} onPress={entrar} disabled={ocupado}><Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('RecuperaSenha')} disabled={ocupado}><Text style={styles.linkSoft}>Esqueci minha senha</Text></TouchableOpacity>

      <View style={styles.divider}><View style={styles.line}/><Text style={styles.ou}>ou</Text><View style={styles.line}/></View>
      <GoogleSignInButton tipo={tipo} disabled={ocupado} onSignedIn={entrarComGoogle}/>
    </View>

    <TouchableOpacity style={styles.createLink} onPress={() => navigation.navigate('Register', { tipoInicial: tipo })} disabled={ocupado}><Text style={styles.createText}>Ainda não tem conta? </Text><Text style={styles.createStrong}>Criar cadastro</Text></TouchableOpacity>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{justifyContent:'center',paddingHorizontal:24,paddingTop:54,paddingBottom:90,backgroundColor:colors.background},brandMark:{width:46,height:46,borderRadius:23,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:12},title:{fontFamily:fonts.bold,fontSize:56,color:colors.text,textAlign:'center',letterSpacing:-1.2},subtitle:{fontSize:18,textAlign:'center',color:colors.muted,marginTop:2,marginBottom:28},roleRow:{flexDirection:'row',gap:10,marginBottom:16},roleCard:{flex:1,minHeight:94,padding:14,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,justifyContent:'center',...shadow},roleActive:{backgroundColor:colors.accent,borderColor:colors.accent},roleActivePorter:{backgroundColor:colors.porter,borderColor:colors.porter},roleTitle:{fontSize:18,fontWeight:'700',color:colors.text,marginTop:7},roleTextActive:{color:'#fff'},roleHelp:{fontSize:13,color:colors.muted,marginTop:1},roleHelpActive:{color:'#F8F4F5'},formCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border,...shadow},input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:16,paddingVertical:14,marginBottom:10},button:{backgroundColor:colors.accent,paddingHorizontal:18,paddingVertical:15,borderRadius:radius.pill,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:2},buttonPorter:{backgroundColor:colors.porter},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},linkSoft:{textAlign:'center',color:colors.muted,fontSize:15,marginTop:14},divider:{flexDirection:'row',alignItems:'center',marginTop:16,marginBottom:0},line:{flex:1,height:1,backgroundColor:colors.border},ou:{marginHorizontal:10,color:colors.muted,fontSize:14},disabled:{opacity:0.55},createLink:{flexDirection:'row',justifyContent:'center',marginTop:22},createText:{color:colors.muted,fontSize:16},createStrong:{color:colors.text,fontWeight:'700',fontSize:16}
});}
