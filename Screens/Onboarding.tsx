import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../components/AppText';
import { BrandLogo } from '../components/BrandLogo';
import { useTheme } from '../context/ThemeContext';
import { fonts, radius, ThemeColors } from '../theme';

const paginas = [
  { icon:'cube-outline', kicker:'RECEBA', title:'Toda encomenda em um só lugar', text:'A portaria registra a chegada e o morador acompanha o que está esperando por ele.' },
  { icon:'scan-outline', kicker:'IDENTIFIQUE', title:'OCR para reduzir erros', text:'A etiqueta é lida, os moradores mais prováveis aparecem e a portaria sempre confirma antes de salvar.' },
  { icon:'notifications-outline', kicker:'AVISE', title:'Comunicação simples e rastreável', text:'Chegadas, lembretes e retiradas ficam registradas com histórico, data e responsável.' },
];

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pagina, setPagina] = useState(0);
  const item = paginas[pagina];
  const ultimo = pagina === paginas.length - 1;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}>
      <View style={styles.brandRow}><BrandLogo size={42}/><Text style={styles.brand}>Cegonha</Text></View>
      {!ultimo && <TouchableOpacity onPress={onFinish}><Text style={styles.skip}>Pular</Text></TouchableOpacity>}
    </View>
    <View style={styles.content}>
      <View style={styles.visual}><Ionicons name={item.icon as any} size={72} color={colors.accent} /></View>
      <Text style={styles.kicker}>{item.kicker}</Text><Text style={styles.title}>{item.title}</Text><Text style={styles.text}>{item.text}</Text>
    </View>
    <View style={styles.footer}>
      <View style={styles.dots}>{paginas.map((_,i)=><View key={i} style={[styles.dot,i===pagina&&styles.dotActive]}/>)}</View>
      <TouchableOpacity style={styles.button} onPress={()=>ultimo?onFinish():setPagina(p=>p+1)}><Text style={styles.buttonText}>{ultimo?'Começar':'Continuar'}</Text><Ionicons name="arrow-forward" size={18} color={colors.background}/></TouchableOpacity>
    </View>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background,paddingHorizontal:24},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:10},brandRow:{flexDirection:'row',alignItems:'center',gap:9},brand:{fontFamily:fonts.brand,fontSize:30,color:colors.text},skip:{fontSize:16,color:colors.muted},content:{flex:1,justifyContent:'center'},visual:{height:210,borderRadius:radius.large,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',marginBottom:28},kicker:{fontSize:13,fontWeight:'700',letterSpacing:2,color:colors.accent,marginBottom:8},title:{fontSize:38,fontWeight:'700',lineHeight:42,color:colors.text,maxWidth:330},text:{fontSize:18,lineHeight:25,color:colors.muted,marginTop:14,maxWidth:340},footer:{paddingBottom:24},dots:{flexDirection:'row',gap:6,marginBottom:18},dot:{width:7,height:7,borderRadius:4,backgroundColor:colors.border},dotActive:{width:24,backgroundColor:colors.accent},button:{height:54,borderRadius:radius.pill,backgroundColor:colors.text,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},buttonText:{color:colors.background,fontSize:17,fontWeight:'700'}
});}
