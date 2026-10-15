import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { radius, ThemeColors } from '../theme';

export default function Condominio({ navigation }: any) {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dados, setDados] = useState<any>(null);
  const [endereco, setEndereco] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil?.condominioId) return;
    return onSnapshot(doc(db, 'condominios', perfil.condominioId), snap => {
      const valor:any = snap.exists() ? { id:snap.id, ...snap.data() } : null;
      setDados(valor);
      setEndereco(String(valor?.endereco || ''));
    });
  }, [perfil?.condominioId]);

  async function salvarEndereco() {
    if (perfil?.tipo !== 'porteiro' || !perfil.condominioId) return;
    if (endereco.trim().length < 5) return Alert.alert('Localização', 'Informe um endereço válido do condomínio.');
    try {
      setSalvando(true);
      await updateDoc(doc(db, 'condominios', perfil.condominioId), { endereco: endereco.trim(), atualizadoEm: serverTimestamp() });
      Alert.alert('Localização salva', 'O endereço do condomínio foi atualizado para todos os usuários.');
    } catch (e:any) {
      Alert.alert('Localização', e?.message || 'Não foi possível salvar o endereço.');
    } finally { setSalvando(false); }
  }

  async function abrirMapa() {
    const valor = String(dados?.endereco || endereco || '').trim();
    if (!valor) return Alert.alert('Mapa', 'A portaria ainda não cadastrou a localização do condomínio.');
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(valor)}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Mapa','Não foi possível abrir o aplicativo de mapas.');
  }

  async function copiarCodigo() {
    const codigo = perfil?.condominioCodigo || dados?.codigoExibicao || '';
    if (!codigo) return;
    await Clipboard.setStringAsync(codigo);
    Alert.alert('Código copiado', 'O código do condomínio foi copiado.');
  }

  if (!perfil?.condominioId) return <KeyboardScreen contentContainerStyle={styles.container}><Text style={styles.title}>Condomínio</Text><Text style={styles.muted}>Sua conta ainda não está vinculada a um condomínio.</Text></KeyboardScreen>;

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={21} color={colors.text}/></TouchableOpacity><View><Text style={styles.eyebrow}>CONDOMÍNIO</Text><Text style={styles.title}>{perfil.condominioNome || dados?.nome || 'Condomínio'}</Text></View></View>
    <View style={styles.card}>
      <Text style={styles.label}>CÓDIGO DE ACESSO</Text>
      <Text style={styles.code}>{perfil.condominioCodigo || dados?.codigoExibicao || '—'}</Text>
      <TouchableOpacity style={styles.copy} onPress={copiarCodigo}><Ionicons name="copy-outline" size={18} color={colors.porter}/><Text style={styles.copyText}>Copiar código</Text></TouchableOpacity>
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>LOCALIZAÇÃO</Text>
      {perfil.tipo === 'porteiro' ? <>
        <Text style={styles.muted}>Cadastre o endereço completo. Moradores e portaria poderão abri-lo diretamente no mapa.</Text>
        <TextInput style={styles.input} placeholder="Rua, número, bairro, cidade" value={endereco} onChangeText={setEndereco} />
        <TouchableOpacity style={[styles.primary,salvando&&{opacity:.55}]} onPress={salvarEndereco} disabled={salvando}><Text style={styles.primaryText}>{salvando?'Salvando...':'Salvar localização'}</Text></TouchableOpacity>
      </> : <Text style={styles.address}>{dados?.endereco || 'A portaria ainda não cadastrou o endereço.'}</Text>}
      <TouchableOpacity style={styles.mapButton} onPress={abrirMapa}><Ionicons name="map-outline" size={19} color={colors.info}/><Text style={styles.mapText}>Abrir no mapa</Text></TouchableOpacity>
    </View>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{padding:20,paddingBottom:80,backgroundColor:colors.background},header:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:16},back:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:31,fontWeight:'700'},muted:{fontSize:15,color:colors.muted,marginTop:8,lineHeight:20},card:{backgroundColor:colors.surface,borderRadius:radius.large,borderWidth:1,borderColor:colors.border,padding:18,marginBottom:12},label:{fontSize:11,fontWeight:'700',letterSpacing:1.5,color:colors.muted},code:{fontSize:34,fontWeight:'700',letterSpacing:3,marginTop:7,color:colors.porter},copy:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10},copyText:{fontWeight:'700',color:colors.porter},input:{backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:13,marginTop:10},primary:{height:48,borderRadius:radius.pill,backgroundColor:colors.porter,alignItems:'center',justifyContent:'center',marginTop:9},primaryText:{color:'#fff',fontWeight:'700'},address:{fontSize:17,lineHeight:23,marginTop:10},mapButton:{height:48,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,marginTop:10},mapText:{fontWeight:'700',color:colors.info}
});}
