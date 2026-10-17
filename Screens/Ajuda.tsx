import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { radius, ThemeColors } from '../theme';

const ITENS=[
  ['Como registrar uma encomenda?','A Portaria pode usar a leitura OCR ou o cadastro manual. Depois de confirmar o morador, a chegada é salva e o morador recebe um aviso dentro do Cegonha.'],
  ['Como funciona o OCR?','A foto da etiqueta é comprimida e enviada ao OCR.Space apenas para reconhecimento. O Cegonha não salva a foto nem o texto bruto da etiqueta no Firestore. A Portaria sempre confirma o morador antes de registrar.'],
  ['Como o morador entra no condomínio?','O Morador informa o código do condomínio no Perfil. A Portaria recebe a solicitação, aprova ou recusa e, depois da aprovação, o Morador conclui o vínculo.'],
  ['Como funciona a retirada?','Cada nova encomenda recebe um código de retirada de 6 dígitos. O Morador mostra o código à Portaria, que o confere antes de confirmar a retirada e registrar quem realizou a entrega.'],
  ['E se houver um registro incorreto?','O Morador pode contestar uma encomenda que não reconhece ou uma retirada que não realizou. A Portaria recebe a contestação na Central de Notificações.'],
  ['Como funciona o Mural?','Moradores e Portaria podem publicar no mural do condomínio. Publicações podem ser denunciadas e a Portaria pode remover conteúdo, banir autores e desfazer banimentos quando necessário.'],
] as const;

export default function Ajuda({navigation}:any){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const ehPortaria=perfil?.tipo==='porteiro';
  const styles=useMemo(()=>makeStyles(colors,ehPortaria),[colors,ehPortaria]);
  const versao=Constants.expoConfig?.version||'1.0.0';
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><View style={{flex:1}}><Text style={styles.eyebrow}>CEGONHA</Text><Text style={styles.title}>Ajuda e sobre</Text><Text style={styles.subtitle}>Um guia rápido dos principais fluxos do aplicativo.</Text></View></View>
      {ITENS.map(([titulo,texto],index)=><View key={titulo} style={styles.card}><View style={styles.number}><Text style={styles.numberText}>{index+1}</Text></View><View style={{flex:1}}><Text style={styles.cardTitle}>{titulo}</Text><Text style={styles.cardText}>{texto}</Text></View></View>)}
      <View style={styles.about}><Ionicons name="information-circle-outline" size={23} color={ehPortaria?colors.porter:colors.accent}/><View style={{flex:1}}><Text style={styles.aboutTitle}>Cegonha · versão {versao}</Text><Text style={styles.aboutText}>Sistema de apoio à gestão de encomendas e comunicação entre Moradores e Portaria.</Text></View></View>
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors,ehPortaria:boolean){const destaque=ehPortaria?colors.porter:colors.accent;return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{padding:20,paddingTop:22,paddingBottom:70,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:destaque},title:{fontSize:34,fontWeight:'700'},subtitle:{fontSize:14,color:colors.muted,lineHeight:19,marginTop:2},card:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:15,marginBottom:9,flexDirection:'row',gap:11},number:{width:34,height:34,borderRadius:17,backgroundColor:ehPortaria?colors.porterSoft:colors.accentSoft,alignItems:'center',justifyContent:'center'},numberText:{fontSize:15,fontWeight:'700',color:destaque},cardTitle:{fontSize:17,fontWeight:'700'},cardText:{fontSize:14,lineHeight:20,color:colors.muted,marginTop:3},about:{marginTop:8,padding:15,borderRadius:radius.large,backgroundColor:ehPortaria?colors.porterSoft:colors.accentSoft,flexDirection:'row',gap:10,alignItems:'flex-start'},aboutTitle:{fontSize:16,fontWeight:'700'},aboutText:{fontSize:13,lineHeight:18,color:colors.muted,marginTop:2}
});}
