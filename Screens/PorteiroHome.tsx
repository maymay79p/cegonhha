import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { enviarLembreteAtrasado } from '../services/encomendas';
import { colors, radius, shadow } from '../theme';

function inicioDoDia() { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }

export default function PorteiroHome({ navigation }: any) {
  const { perfil } = useAuth();
  const [encomendas,setEncomendas] = useState<any[]>([]);
  const [solicitacoes,setSolicitacoes] = useState(0);
  const [loading,setLoading] = useState(true);

  async function carregar() {
    if (!perfil?.condominioId) return;
    setLoading(true);
    try {
      const [snap, solicitacoesSnap] = await Promise.all([
        getDocs(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId))),
        getDocs(query(collection(db,'solicitacoesCondominio'),where('condominioId','==',perfil.condominioId))),
      ]);
      const lista = snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.recebidaEm?.seconds||0)-(a.recebidaEm?.seconds||0));
      setEncomendas(lista);
      setSolicitacoes(solicitacoesSnap.docs.filter(d=>d.data()?.status==='pendente').length);
      const limite = Date.now() - 3*86400000;
      const atrasadas = lista.filter(e => e.status==='pendente' && !e.lembrete3dEnviado && (e.recebidaEm?.toDate?.()?.getTime?.()||0) <= limite);
      await Promise.allSettled(atrasadas.slice(0,5).map(e=>enviarLembreteAtrasado(e,perfil)));
    } finally { setLoading(false); }
  }

  useEffect(()=>{ carregar(); const unsub = navigation.addListener?.('focus',carregar); return ()=>unsub?.(); },[perfil?.condominioId]);

  const stats = useMemo(()=>{
    const hoje = inicioDoDia();
    const pendentes = encomendas.filter(e=>e.status==='pendente');
    const recebidasHoje = encomendas.filter(e=>(e.recebidaEm?.toDate?.()?.getTime?.()||0)>=hoje).length;
    const retiradasHoje = encomendas.filter(e=>(e.retiradaEm?.toDate?.()?.getTime?.()||0)>=hoje).length;
    const mais3 = pendentes.filter(e=>Date.now()-(e.recebidaEm?.toDate?.()?.getTime?.()||Date.now())>=3*86400000).length;
    const retiradas = encomendas.filter(e=>e.retiradaEm?.toDate && e.recebidaEm?.toDate);
    const mediaHoras = retiradas.length ? retiradas.reduce((s,e)=>s+(e.retiradaEm.toDate().getTime()-e.recebidaEm.toDate().getTime())/3600000,0)/retiradas.length : 0;
    const contagem:Record<string,{nome:string,total:number}> = {};
    pendentes.forEach(e=>{ const k=e.moradorId; contagem[k]=contagem[k]||{nome:e.moradorNome,total:0}; contagem[k].total++; });
    return {pendentes:pendentes.length,recebidasHoje,retiradasHoje,mais3,mediaHoras,top:Object.values(contagem).sort((a,b)=>b.total-a.total).slice(0,3)};
  },[encomendas]);

  return <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>PORTARIA</Text><Text style={styles.title}>Visão de hoje</Text><Text style={styles.condo}>{perfil?.condominioNome || 'Condomínio'}{perfil?.condominioCodigo ? ' · ' + perfil.condominioCodigo : ''}</Text>
    {loading ? <LoadingCards count={2}/> : <>
      <View style={styles.grid}>
        <View style={styles.stat}><Text style={styles.number}>{stats.recebidasHoje}</Text><Text style={styles.statLabel}>Recebidas hoje</Text></View>
        <View style={styles.stat}><Text style={styles.number}>{stats.pendentes}</Text><Text style={styles.statLabel}>Aguardando retirada</Text></View>
        <View style={styles.stat}><Text style={styles.number}>{stats.retiradasHoje}</Text><Text style={styles.statLabel}>Retiradas hoje</Text></View>
        <View style={styles.stat}><Text style={[styles.number,stats.mais3>0&&{color:colors.warning}]}>{stats.mais3}</Text><Text style={styles.statLabel}>Há mais de 3 dias</Text></View>
      </View>
      <View style={styles.insight}><Ionicons name="time-outline" size={20} color={colors.info}/><View><Text style={styles.insightValue}>{stats.mediaHoras ? stats.mediaHoras.toFixed(1) + ' h' : 'Sem dados'}</Text><Text style={styles.insightText}>tempo médio entre chegada e retirada</Text></View></View>
    </>}

    <View style={styles.actions}>
      <TouchableOpacity style={styles.primary} onPress={()=>navigation.navigate('OCR')}><Ionicons name="scan-outline" size={25} color="#fff"/><Text style={styles.primaryTitle}>Ler etiqueta</Text><Text style={styles.primaryText}>Identificação assistida por OCR</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={()=>navigation.navigate('EncomendaForm')}><Ionicons name="add-circle-outline" size={23} color={colors.porter}/><Text style={styles.secondaryTitle}>Registrar manualmente</Text></TouchableOpacity>
    </View>

    <TouchableOpacity style={styles.requests} onPress={()=>navigation.navigate('SolicitacoesCondominio')}><View style={styles.requestLeft}><Ionicons name="people-outline" size={21} color={colors.porter}/><Text style={styles.requestText}>Solicitações de moradores</Text></View><View style={styles.requestCount}><Text style={styles.requestCountText}>{solicitacoes}</Text></View></TouchableOpacity>
    <View style={styles.quickRow}>
      <TouchableOpacity style={styles.quick} onPress={()=>navigation.navigate('Condominio')}><Ionicons name="location-outline" size={20} color={colors.info}/><Text style={styles.quickText}>Condomínio e mapa</Text></TouchableOpacity>
      <TouchableOpacity style={styles.quick} onPress={()=>navigation.navigate('OCRHistorico')}><Ionicons name="time-outline" size={20} color={colors.info}/><Text style={styles.quickText}>Histórico OCR</Text></TouchableOpacity>
    </View>
    <TouchableOpacity style={styles.reports} onPress={()=>navigation.navigate('Relatorios')}><View style={styles.requestLeft}><Ionicons name="analytics-outline" size={21} color={colors.info}/><Text style={styles.requestText}>Relatórios e indicadores</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>

    <Text style={styles.section}>Quem tem mais encomendas pendentes</Text>
    {stats.top.length ? <View>{stats.top.map((item,index)=><View key={`${item.nome}-${index}`} style={styles.personRow}><Text style={styles.rank}>{index+1}</Text><Text style={styles.personName}>{item.nome}</Text><Text style={styles.personTotal}>{item.total}</Text></View>)}</View> : !loading ? <EmptyState icon="checkmark-circle-outline" title="Portaria em dia" text="Não há encomendas pendentes neste momento."/> : null}
  </ScrollView>;
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:colors.background},content:{padding:20,paddingBottom:122},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:38,fontWeight:'700',color:colors.text,marginTop:3},condo:{fontSize:16,color:colors.muted,marginBottom:15},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},stat:{width:'48.5%',backgroundColor:colors.surface,padding:15,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border},number:{fontSize:31,fontWeight:'700',color:colors.porter},statLabel:{fontSize:14,color:colors.muted,marginTop:1},insight:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#F1F4F6',padding:14,borderRadius:radius.medium,marginTop:10},insightValue:{fontSize:18,fontWeight:'700',color:colors.info},insightText:{fontSize:13,color:colors.muted},actions:{flexDirection:'row',gap:10,marginTop:14},primary:{flex:1,backgroundColor:colors.porter,padding:16,borderRadius:radius.large,...shadow},primaryTitle:{color:'#fff',fontSize:19,fontWeight:'700',marginTop:12},primaryText:{color:'#EDE7EA',fontSize:13,marginTop:2},secondary:{width:124,backgroundColor:colors.surface,padding:15,borderRadius:radius.large,borderWidth:1,borderColor:colors.border,justifyContent:'space-between'},secondaryTitle:{fontSize:16,fontWeight:'700',color:colors.text},requests:{height:54,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginTop:11,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},requestLeft:{flexDirection:'row',alignItems:'center',gap:9},requestText:{fontSize:16,fontWeight:'700'},requestCount:{minWidth:30,height:30,borderRadius:15,backgroundColor:colors.porterSoft,alignItems:'center',justifyContent:'center'},requestCountText:{fontWeight:'700',color:colors.porter},quickRow:{flexDirection:'row',gap:8,marginTop:8},quick:{flex:1,minHeight:62,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12,justifyContent:'center'},quickText:{fontSize:14,fontWeight:'700',marginTop:5},reports:{height:54,backgroundColor:'#F1F4F6',borderRadius:radius.medium,borderWidth:1,borderColor:'#DEE5EA',marginTop:8,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},section:{fontSize:21,fontWeight:'700',marginTop:18,marginBottom:9},personRow:{height:48,backgroundColor:colors.surface,borderRadius:radius.small,marginBottom:7,paddingHorizontal:13,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:colors.border},rank:{width:28,color:colors.muted,fontWeight:'700'},personName:{flex:1,fontSize:16,fontWeight:'700'},personTotal:{fontSize:18,fontWeight:'700',color:colors.porter},
});
