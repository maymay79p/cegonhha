import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { radius, shadow, ThemeColors } from '../theme';

export default function RecuperaSenha({ navigation }: any){
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(false);

  async function enviar(){
    if(!email.trim()) return Alert.alert('Atenção','Informe seu e-mail.');
    try{
      setLoading(true);
      await sendPasswordResetEmail(auth,email.trim().toLowerCase());
      Alert.alert('Pronto','E-mail de recuperação enviado.');
    } catch(e:any){
      Alert.alert('Erro',e?.message || 'Não foi possível enviar o e-mail.');
    } finally { setLoading(false); }
  }

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={20} color={colors.text} /></TouchableOpacity>
    <Text style={styles.eyebrow}>ACESSO</Text><Text style={styles.title}>Recuperar senha</Text><Text style={styles.subtitle}>Informe seu e-mail e enviaremos o link de recuperação.</Text>
    <TextInput style={styles.input} placeholder="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} returnKeyType="done" onSubmitEditing={enviar}/>
    <TouchableOpacity style={[styles.button,loading&&styles.disabled]} onPress={enviar} disabled={loading}><Text style={styles.buttonText}>{loading?'Enviando...':'Enviar link'}</Text><Ionicons name="arrow-forward" size={18} color="#fff"/></TouchableOpacity>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{paddingHorizontal:24,paddingTop:48,paddingBottom:90,backgroundColor:colors.background},backButton:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginBottom:24},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:2,color:colors.accent},title:{fontSize:38,fontWeight:'700',color:colors.text,marginTop:4},subtitle:{fontSize:17,color:colors.muted,marginTop:4,marginBottom:18,lineHeight:22},input:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,paddingHorizontal:16,paddingVertical:14,...shadow},button:{backgroundColor:colors.accent,padding:14,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:12},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},disabled:{opacity:0.55}
});}
