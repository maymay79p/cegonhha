import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../components/AppText';
import { colors, radius } from '../theme';

function Bloco({ icon, title, children }: any) {
  return (
    <View style={styles.card}>
      <View style={styles.row}><Ionicons name={icon} size={20} color={colors.accent} /><Text style={styles.cardTitle}>{title}</Text></View>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function Privacidade({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.eyebrow}>PRIVACIDADE</Text>
        <Text style={styles.title}>Como seus dados são usados</Text>
        <Text style={styles.intro}>O Cegonha usa apenas os dados necessários para identificar moradores, organizar entregas e manter rastreabilidade do atendimento.</Text>

        <Bloco icon="person-outline" title="Dados do perfil">Nome, e-mail, bloco, apartamento, telefone opcional, tipo de acesso e vínculo com o condomínio.</Bloco>
        <Bloco icon="cube-outline" title="Dados das encomendas">Destinatário, status, datas, responsável pelo registro, histórico e uma miniatura da etiqueta quando a chegada é registrada pelo OCR.</Bloco>
        <Bloco icon="scan-outline" title="OCR externo">A imagem escolhida para leitura é enviada ao OCR.Space para reconhecimento do texto. O Cegonha salva apenas uma miniatura vinculada à encomenda confirmada.</Bloco>
        <Bloco icon="shield-checkmark-outline" title="Separação por condomínio">As regras do Firestore limitam leituras e alterações conforme o usuário, o perfil e o condomínio vinculado.</Bloco>
        <Bloco icon="analytics-outline" title="Avaliação acadêmica">Os testes de OCR guardam métricas como tempo de processamento, condição de iluminação e se o primeiro candidato foi confirmado. O relatório não precisa armazenar o texto completo da etiqueta.</Bloco>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},
  container:{padding:22,paddingBottom:42},
  back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',marginBottom:20,borderWidth:1,borderColor:colors.border},
  eyebrow:{fontSize:13,fontWeight:'700',letterSpacing:2,color:colors.accent},
  title:{fontSize:36,fontWeight:'700',lineHeight:39,marginTop:6,color:colors.text},
  intro:{fontSize:17,lineHeight:24,color:colors.muted,marginTop:10,marginBottom:18},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:17,marginBottom:11},
  row:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:7},
  cardTitle:{fontSize:19,fontWeight:'700'},
  body:{fontSize:16,lineHeight:22,color:colors.muted},
});
