import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import { radius, ThemeColors } from '../theme';

function Bloco({ icon, title, children, colors, styles }: any) {
  return <View style={styles.card}>
    <View style={styles.row}><Ionicons name={icon} size={20} color={colors.accent} /><Text style={styles.cardTitle}>{title}</Text></View>
    <Text style={styles.body}>{children}</Text>
  </View>;
}

export default function Privacidade({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
      <Text style={styles.eyebrow}>PRIVACIDADE</Text>
      <Text style={styles.title}>Como seus dados são usados</Text>
      <Text style={styles.intro}>O Cegonha usa os dados necessários para identificar moradores, organizar entregas, manter o histórico e permitir a comunicação do condomínio.</Text>

      <Bloco icon="person-outline" title="Dados do perfil" colors={colors} styles={styles}>Nome, e-mail, CPF, bloco, apartamento, telefone, tipo de acesso e vínculo com o condomínio.</Bloco>
      <Bloco icon="cube-outline" title="Dados das encomendas" colors={colors} styles={styles}>Destinatário, status, datas, responsável pelo registro, histórico, descrição e, quando houver OCR, somente a pontuação de correspondência e os principais dados extraídos. A foto da etiqueta não é anexada à encomenda.</Bloco>
      <Bloco icon="scan-outline" title="OCR externo" colors={colors} styles={styles}>Para reconhecer uma etiqueta, o Cegonha envia temporariamente uma versão comprimida da imagem ao OCR.Space por HTTPS. O Cegonha não salva essa foto nem o texto bruto no Firestore. Depois da confirmação, ficam somente nome, CPF, bloco, apartamento e métricas necessárias para avaliar o OCR. O OCR.Space informa em sua política/FAQ que não armazena os documentos ou imagens enviados.</Bloco>
      <Bloco icon="trash-outline" title="Descarte da leitura" colors={colors} styles={styles}>Após o reconhecimento, a Portaria pode remover apenas a foto da tela e manter os dados reconhecidos, ou descartar a leitura inteira antes de registrar a encomenda.</Bloco>
      <Bloco icon="chatbubbles-outline" title="Mural do condomínio" colors={colors} styles={styles}>Publicações, denúncias e moderação ficam vinculadas ao condomínio. Usuários banidos continuam podendo ler o mural, mas não publicar.</Bloco>
      <Bloco icon="shield-checkmark-outline" title="Separação por condomínio" colors={colors} styles={styles}>As regras do Firestore limitam leituras e alterações conforme o usuário, o perfil e o condomínio vinculado.</Bloco>
      <Bloco icon="analytics-outline" title="Avaliação acadêmica" colors={colors} styles={styles}>As leituras confirmadas geram métricas de tempo, condições da imagem e acerto do primeiro candidato para avaliação do OCR no TCC, sem armazenar a foto ou o texto bruto.</Bloco>
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{padding:22,paddingBottom:42,backgroundColor:colors.background},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',marginBottom:20,borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:13,fontWeight:'700',letterSpacing:2,color:colors.accent},title:{fontSize:36,fontWeight:'700',lineHeight:39,marginTop:6,color:colors.text},intro:{fontSize:17,lineHeight:24,color:colors.muted,marginTop:10,marginBottom:18},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:17,marginBottom:11},row:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:7},cardTitle:{fontSize:19,fontWeight:'700'},body:{fontSize:16,lineHeight:22,color:colors.muted}
});}
