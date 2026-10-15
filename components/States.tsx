import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from './AppText';
import { radius, ThemeColors } from '../theme';
import { useTheme } from '../context/ThemeContext';

export function EmptyState({ icon = 'cube-outline', title, text }: { icon?: any; title: string; text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <View style={styles.icon}><Ionicons name={icon} size={26} color={colors.muted} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, { width: '48%' }]} />
          <View style={[styles.skeletonLine, { width: '72%' }]} />
          <View style={[styles.skeletonLine, { width: '34%' }]} />
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty:{alignItems:'center',paddingVertical:42,paddingHorizontal:24},
    icon:{width:52,height:52,borderRadius:26,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center',marginBottom:12},
    title:{fontSize:20,fontWeight:'700',color:colors.text,textAlign:'center'},
    text:{fontSize:15,color:colors.muted,textAlign:'center',lineHeight:21,marginTop:4},
    skeletonCard:{backgroundColor:colors.surface,padding:18,borderRadius:radius.medium,marginBottom:12,borderWidth:1,borderColor:colors.border},
    skeletonLine:{height:11,borderRadius:8,backgroundColor:colors.surfaceSoft,marginBottom:10},
  });
}
