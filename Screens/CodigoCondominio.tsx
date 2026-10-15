import React, { useMemo } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { doc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { radius, shadow, ThemeColors } from '../theme';

export default function CodigoCondominio() {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function copiar() {
    if (!perfil?.condominioCodigo) return;
    await Clipboard.setStringAsync(perfil.condominioCodigo);
    Alert.alert('Código copiado', 'Agora você pode compartilhar o código com os moradores.');
  }

  async function continuar() {
    if (!perfil?.id) return;
    await updateDoc(doc(db, 'usuarios', perfil.id), { mostrarCodigoCondominio: false });
  }

  return <View style={styles.container}>
    <View style={styles.icon}><Ionicons name="key-outline" size={36} color={colors.porter}/></View>
    <Text style={styles.eyebrow}>GUARDE ESTE CÓDIGO</Text>
    <Text style={styles.title}>Seu condomínio foi criado</Text>
    <Text style={styles.subtitle}>Os moradores precisam deste código para solicitar entrada no condomínio.</Text>
    <View style={styles.codeCard}>
      <Text style={styles.condo}>{perfil?.condominioNome || 'Condomínio'}</Text>
      <Text style={styles.code}>{perfil?.condominioCodigo || '—'}</Text>
      <TouchableOpacity style={styles.copy} onPress={copiar}><Ionicons name="copy-outline" size={20} color="#fff"/><Text style={styles.copyText}>Copiar código</Text></TouchableOpacity>
    </View>
    <Text style={styles.hint}>Esta tela fica em destaque antes do painel. O código também continuará disponível em Condomínio e Perfil.</Text>
    <TouchableOpacity style={styles.continue} onPress={continuar}><Text style={styles.continueText}>Já guardei o código</Text><Ionicons name="arrow-forward" size={18} color={colors.porter}/></TouchableOpacity>
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,backgroundColor:colors.background,padding:24,justifyContent:'center'},icon:{width:72,height:72,borderRadius:36,backgroundColor:colors.porterSoft,alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:18},eyebrow:{textAlign:'center',fontSize:12,fontWeight:'700',letterSpacing:2,color:colors.porter},title:{fontSize:36,fontWeight:'700',textAlign:'center',marginTop:6},subtitle:{fontSize:17,lineHeight:23,color:colors.muted,textAlign:'center',marginTop:8},codeCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:22,borderWidth:1,borderColor:colors.border,marginTop:24,...shadow},condo:{fontSize:17,color:colors.muted,textAlign:'center'},code:{fontSize:42,fontWeight:'700',letterSpacing:4,textAlign:'center',color:colors.porter,marginVertical:18},copy:{height:52,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},copyText:{color:'#fff',fontSize:17,fontWeight:'700'},hint:{fontSize:14,lineHeight:20,color:colors.muted,textAlign:'center',marginTop:14},continue:{height:52,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:14},continueText:{fontSize:17,fontWeight:'700',color:colors.porter}
});}
