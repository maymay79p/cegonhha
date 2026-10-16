import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

const DIA = 86400000;
const PERIODOS = [7, 14, 30] as const;
type Periodo = typeof PERIODOS[number];

function inicioDoDia(data = new Date()) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function timestampMs(valor: any) {
  return valor?.toDate?.()?.getTime?.() || 0;
}

function dataCurta(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function Relatorios(){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [encomendas,setEncomendas]=useState<any[]>([]);
  const [testes,setTestes]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [periodo,setPeriodo]=useState<Periodo>(7);

  useEffect(()=>{
    if(!perfil?.condominioId){setEncomendas([]);setTestes([]);setLoading(false);return;}
    setLoading(true);
    let encomendasProntas=false;
    let ocrPronto=false;
    const concluir=()=>{if(encomendasProntas&&ocrPronto)setLoading(false);};

    const unsubEncomendas=onSnapshot(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId)),snap=>{
      setEncomendas(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      encomendasProntas=true;
      concluir();
    },()=>{encomendasProntas=true;concluir();});

    const unsubOCR=onSnapshot(query(collection(db,'ocrTestes'),where('condominioId','==',perfil.condominioId)),snap=>{
      setTestes(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      ocrPronto=true;
      concluir();
    },()=>{ocrPronto=true;concluir();});

    return()=>{unsubEncomendas();unsubOCR();};
  },[perfil?.condominioId]);

  const resumo=useMemo(()=>{
    const hoje=inicioDoDia();
    const inicio=hoje-(periodo-1)*DIA;
    const agora=Date.now();

    const recebidasHoje=encomendas.filter(e=>timestampMs(e.recebidaEm)>=hoje).length;
    const recebidasPeriodo=encomendas.filter(e=>timestampMs(e.recebidaEm)>=inicio).length;
    const pendentes=encomendas.filter(e=>e.status==='pendente');
    const retiradasPeriodo=encomendas.filter(e=>timestampMs(e.retiradaEm)>=inicio);
    const atrasadas=pendentes.filter(e=>{
      const recebida=timestampMs(e.recebidaEm);
      return recebida>0&&agora-recebida>=3*DIA;
    });

    const pares=retiradasPeriodo.filter(e=>timestampMs(e.recebidaEm)>0&&timestampMs(e.retiradaEm)>0);
    const mediaHoras=pares.length?pares.reduce((s,e)=>s+(timestampMs(e.retiradaEm)-timestampMs(e.recebidaEm))/3600000,0)/pares.length:0;

    const ocrPeriodo=testes.filter(t=>timestampMs(t.criadoEm)>=inicio);
    const acertoOCR=ocrPeriodo.length?ocrPeriodo.filter(t=>t.acertoTop1).length/ocrPeriodo.length*100:0;

    // Mais recente primeiro: hoje fica no topo e os dias anteriores vêm abaixo.
    const atividade=Array.from({length:7},(_,index)=>{
      const dia=hoje-index*DIA;
      const proximo=dia+DIA;
      return {
        dia,
        recebidas:encomendas.filter(e=>{const t=timestampMs(e.recebidaEm);return t>=dia&&t<proximo;}).length,
        retiradas:encomendas.filter(e=>{const t=timestampMs(e.retiradaEm);return t>=dia&&t<proximo;}).length,
      };
    });

    const antigas=[...atrasadas].sort((a,b)=>timestampMs(a.recebidaEm)-timestampMs(b.recebidaEm)).slice(0,5).map(e=>({
      ...e,
      dias:Math.max(3,Math.floor((agora-timestampMs(e.recebidaEm))/DIA)),
    }));

    return{
      recebidasHoje,
      recebidasPeriodo,
      pendentes:pendentes.length,
      retiradasPeriodo:retiradasPeriodo.length,
      atrasadas:atrasadas.length,
      mediaHoras,
      atividade,
      antigas,
      ocrLeituras:ocrPeriodo.length,
      acertoOCR,
    };
  },[encomendas,testes,periodo]);

  return <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>RELATÓRIOS</Text>
    <Text style={styles.title}>Resumo operacional</Text>
    <Text style={styles.subtitle}>Acompanhe a semana da portaria e amplie o período quando precisar comparar o movimento.</Text>

    <View style={styles.filters}>
      {PERIODOS.map(dias=><TouchableOpacity key={dias} style={[styles.filter,periodo===dias&&styles.filterActive]} onPress={()=>setPeriodo(dias)}><Text style={[styles.filterText,periodo===dias&&styles.filterTextActive]}>{dias} dias</Text></TouchableOpacity>)}
    </View>

    {loading?<LoadingCards count={3}/>:<>
      <View style={styles.grid}>
        <View style={styles.card}><Ionicons name="today-outline" size={20} color={colors.info}/><Text style={styles.number}>{resumo.recebidasHoje}</Text><Text style={styles.label}>Recebidas hoje</Text></View>
        <View style={styles.card}><Ionicons name="cube-outline" size={20} color={colors.porter}/><Text style={styles.number}>{resumo.pendentes}</Text><Text style={styles.label}>Pendentes agora</Text></View>
        <View style={styles.card}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/><Text style={styles.number}>{resumo.retiradasPeriodo}</Text><Text style={styles.label}>Retiradas em {periodo} dias</Text></View>
        <View style={styles.card}><Ionicons name="alert-circle-outline" size={20} color={resumo.atrasadas?colors.warning:colors.muted}/><Text style={[styles.number,resumo.atrasadas>0&&{color:colors.warning}]}>{resumo.atrasadas}</Text><Text style={styles.label}>Há +3 dias</Text></View>
      </View>

      <View style={styles.summary}>
        <View><Text style={styles.summaryValue}>{resumo.recebidasPeriodo}</Text><Text style={styles.summaryLabel}>recebidas no período</Text></View>
        <View style={styles.verticalLine}/>
        <View><Text style={styles.summaryValue}>{resumo.mediaHoras?`${resumo.mediaHoras.toFixed(1)} h`:'—'}</Text><Text style={styles.summaryLabel}>tempo médio até retirada</Text></View>
      </View>

      <Text style={styles.section}>Movimento dos últimos 7 dias</Text>
      <View style={styles.activityBox}>
        {resumo.atividade.map((item,index)=><View key={item.dia} style={[styles.activityRow,index===resumo.atividade.length-1&&styles.activityRowLast]}>
          <Text style={styles.day}>{dataCurta(item.dia)}</Text>
          <View style={styles.activityMetric}><Ionicons name="arrow-down-circle-outline" size={16} color={colors.info}/><Text style={styles.activityText}>{item.recebidas} recebidas</Text></View>
          <View style={styles.activityMetric}><Ionicons name="checkmark-circle-outline" size={16} color={colors.success}/><Text style={styles.activityText}>{item.retiradas} retiradas</Text></View>
        </View>)}
      </View>

      <Text style={styles.section}>Pendências mais antigas</Text>
      {resumo.antigas.length?<View>{resumo.antigas.map(item=><View key={item.id} style={styles.pendingRow}>
        <View style={{flex:1}}><Text style={styles.pendingName}>{item.moradorNome||'Morador'}</Text><Text style={styles.pendingMeta}>Bloco {item.bloco||'-'} · Ap. {item.apartamento||'-'} · {item.codigoReferencia?`#${item.codigoReferencia}`:'sem código'}</Text></View>
        <View style={styles.daysBadge}><Text style={styles.daysText}>{item.dias} dias</Text></View>
      </View>)}</View>:<EmptyState icon="checkmark-done-outline" title="Sem atrasos" text="Não há encomendas aguardando retirada há mais de 3 dias."/>}

      <Text style={styles.section}>OCR no período</Text>
      <View style={styles.ocrBox}>
        <View><Text style={styles.ocrValue}>{resumo.ocrLeituras}</Text><Text style={styles.label}>leituras avaliadas</Text></View>
        <View style={styles.verticalLine}/>
        <View><Text style={styles.ocrValue}>{resumo.ocrLeituras?`${resumo.acertoOCR.toFixed(1)}%`:'—'}</Text><Text style={styles.label}>acerto do 1º candidato</Text></View>
      </View>
      <Text style={styles.note}>O relatório usa os registros em tempo real do condomínio. “Há +3 dias” considera apenas encomendas ainda pendentes.</Text>
    </>}
  </ScrollView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{padding:22,paddingBottom:120,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:36,fontWeight:'700',marginTop:3},subtitle:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:4,marginBottom:13},filters:{flexDirection:'row',gap:7,marginBottom:15},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.porter,borderColor:colors.porter},filterText:{fontSize:13,fontWeight:'700'},filterTextActive:{color:'#fff'},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},card:{width:'48.5%',backgroundColor:colors.surface,borderRadius:radius.medium,padding:15,borderWidth:1,borderColor:colors.border},number:{fontSize:30,fontWeight:'700',color:colors.porter,marginTop:5},label:{fontSize:13,color:colors.muted,marginTop:1},summary:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:15,marginTop:10,borderWidth:1,borderColor:colors.border},summaryValue:{fontSize:23,fontWeight:'700',color:colors.porter},summaryLabel:{fontSize:12,color:colors.muted,marginTop:1},verticalLine:{width:1,height:40,backgroundColor:colors.border,marginHorizontal:20},section:{fontSize:22,fontWeight:'700',marginTop:20,marginBottom:9},activityBox:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,paddingHorizontal:13},activityRow:{minHeight:48,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border,gap:10},activityRowLast:{borderBottomWidth:0},day:{width:52,fontSize:13,fontWeight:'700',color:colors.porter},activityMetric:{flex:1,flexDirection:'row',alignItems:'center',gap:5},activityText:{fontSize:12,color:colors.muted},pendingRow:{minHeight:58,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12,marginBottom:7,flexDirection:'row',alignItems:'center',gap:10},pendingName:{fontSize:16,fontWeight:'700'},pendingMeta:{fontSize:12,color:colors.muted,marginTop:2},daysBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft},daysText:{fontSize:12,fontWeight:'700',color:colors.warning},ocrBox:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:radius.medium,padding:16,borderWidth:1,borderColor:colors.border},ocrValue:{fontSize:26,fontWeight:'700',color:colors.porter},note:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:12}
});}
