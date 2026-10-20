import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAccessibility, FontScaleOption } from '../context/AccessibilityContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { radius, ThemeColors } from '../theme';

export default function Acessibilidade({ navigation }: any) {
  const { colors } = useTheme();
  const a11y = useAccessibility();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const tamanhos: { value: FontScaleOption; label: string; help: string }[] = [
    { value: 1, label: 'Padrão', help: '100%' },
    { value: 1.15, label: 'Grande', help: '115%' },
    { value: 1.3, label: 'Maior', help: '130%' },
  ];

  const toggle = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    text: string,
    value: boolean,
    onChange: (value: boolean) => Promise<void>,
  ) => <View style={styles.optionRow}>
    <View style={styles.optionIcon}><Ionicons name={icon} size={21} color={colors.text}/></View>
    <View style={styles.optionBody}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionText}>{text}</Text></View>
    <Switch
      accessibilityLabel={title}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.accentSoft }}
      thumbColor={value ? colors.accent : colors.muted}
    />
  </View>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={22} color={colors.text}/>
        </TouchableOpacity>
        <View style={{flex:1}}><Text style={styles.eyebrow}>ACESSIBILIDADE</Text><Text style={styles.title}>Conforto e inclusão</Text><Text style={styles.subtitle}>Ajustes ficam salvos somente neste dispositivo e podem ser alterados a qualquer momento.</Text></View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}><Ionicons name="text-outline" size={21} color={colors.accent}/><Text style={styles.cardTitle}>Tamanho do texto</Text></View>
        <Text style={styles.cardHelp}>O tamanho escolhido é aplicado aos textos e campos do Cegonha, além do ajuste de fonte configurado no próprio celular.</Text>
        <View style={styles.segmentRow}>{tamanhos.map(item => {
          const active = a11y.fontScale === item.value;
          return <TouchableOpacity
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => a11y.setFontScale(item.value)}
          ><Text style={[styles.segmentTitle,active&&styles.segmentTitleActive]}>{item.label}</Text><Text style={[styles.segmentHelp,active&&styles.segmentHelpActive]}>{item.help}</Text></TouchableOpacity>;
        })}</View>
        <View style={styles.preview}><Text style={styles.previewLabel}>Prévia</Text><Text style={styles.previewText}>Sua encomenda chegou à portaria.</Text></View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}><Ionicons name="eye-outline" size={21} color={colors.accent}/><Text style={styles.cardTitle}>Acessibilidade visual</Text></View>
        {toggle('contrast-outline','Alto contraste','Aumenta a diferença entre fundo, texto, bordas e cores de estado.',a11y.highContrast,a11y.setHighContrast)}
        {toggle('text-outline','Texto mais forte','Usa pesos tipográficos mais fortes para melhorar a legibilidade.',a11y.boldText,a11y.setBoldText)}
        {toggle('volume-high-outline','Avisos para leitor de tela','Anuncia confirmações, erros e avisos importantes com os recursos de acessibilidade do sistema.',a11y.spokenFeedback,a11y.setSpokenFeedback)}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}><Ionicons name="ear-outline" size={21} color={colors.accent}/><Text style={styles.cardTitle}>Acessibilidade auditiva</Text></View>
        <Text style={styles.cardHelp}>O Cegonha não depende de sons para comunicar estados importantes. As mensagens relevantes também aparecem visualmente.</Text>
        {toggle('phone-portrait-outline','Feedback por vibração','Usa vibrações curtas como apoio em confirmações, avisos e erros.',a11y.vibrationFeedback,a11y.setVibrationFeedback)}
        {toggle('notifications-outline','Feedback visual reforçado','Mantém avisos visuais por mais tempo e com bordas mais destacadas.',a11y.enhancedVisualFeedback,a11y.setEnhancedVisualFeedback)}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}><Ionicons name="accessibility-outline" size={21} color={colors.accent}/><Text style={styles.cardTitle}>Movimento e interação</Text></View>
        {toggle('remove-outline','Reduzir animações','Evita animações desnecessárias nos avisos e transições controladas pelo Cegonha.',a11y.reduceMotion,a11y.setReduceMotion)}
        <View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={colors.info}/><Text style={styles.noteText}>Botões importantes continuam acompanhados de texto e ícones, evitando depender apenas de cor para indicar uma ação.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:{flex:1,backgroundColor:colors.background},
    container:{padding:20,paddingBottom:70,backgroundColor:colors.background},
    header:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:18},
    back:{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
    eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.accent},
    title:{fontSize:32,fontWeight:'700',marginTop:1},
    subtitle:{fontSize:14,lineHeight:20,color:colors.muted,marginTop:3},
    card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,padding:17,marginBottom:13},
    cardHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:5},
    cardTitle:{fontSize:20,fontWeight:'700'},
    cardHelp:{fontSize:14,lineHeight:20,color:colors.muted,marginBottom:12},
    segmentRow:{flexDirection:'row',gap:7},
    segment:{flex:1,minHeight:60,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,alignItems:'center',justifyContent:'center',backgroundColor:colors.surfaceSoft},
    segmentActive:{backgroundColor:colors.accentSoft,borderColor:colors.accent},
    segmentTitle:{fontSize:14,fontWeight:'700',color:colors.text},
    segmentTitleActive:{color:colors.accent},
    segmentHelp:{fontSize:11,color:colors.muted,marginTop:1},
    segmentHelpActive:{color:colors.accent},
    preview:{marginTop:12,padding:12,borderRadius:radius.medium,backgroundColor:colors.surfaceSoft},
    previewLabel:{fontSize:11,fontWeight:'700',letterSpacing:.8,color:colors.muted,textTransform:'uppercase'},
    previewText:{fontSize:17,marginTop:3},
    optionRow:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,borderTopColor:colors.border,paddingVertical:10},
    optionIcon:{width:38,height:38,borderRadius:19,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},
    optionBody:{flex:1},
    optionTitle:{fontSize:16,fontWeight:'700'},
    optionText:{fontSize:13,lineHeight:18,color:colors.muted,marginTop:2},
    note:{flexDirection:'row',gap:8,alignItems:'flex-start',padding:12,borderRadius:radius.medium,backgroundColor:colors.surfaceSoft,marginTop:5},
    noteText:{flex:1,fontSize:13,lineHeight:18,color:colors.muted},
  });
}
