import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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

function dataHora(ms:number){
  return ms ? new Date(ms).toLocaleString('pt-BR') : '';
}

function csvCelula(valor:unknown){
  return `"${String(valor ?? '').replace(/"/g,'""')}"`;
}

export default function Relatorios({navigation}:any){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [encomendas,setEncomendas]=useState<any[]>([]);
  const [testes,setTestes]=useState<any[]>([]);
  const [solicitacoes,setSolicitacoes]=useState<any[]>([]);
  const [denuncias,setDenuncias]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [periodo,setPeriodo]=useState<Periodo>(7);
  const [exportando,setExportando]=useState(false);

  useEffect(()=>{
    if(!perfil?.condominioId){setEncomendas([]);setTestes([]);setSolicitacoes([]);setDenuncias([]);setLoading(false);return;}
    setLoading(true);
    const prontos={encomendas:false,ocr:false,solicitacoes:false,denuncias:false};
    const concluir=()=>{if(Object.values(prontos).every(Boolean))setLoading(false);};

    const unsubEncomendas=onSnapshot(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId)),snap=>{
      setEncomendas(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.encomendas=true;concluir();
    },()=>{prontos.encomendas=true;concluir();});

    const unsubOCR=onSnapshot(query(collection(db,'ocrTestes'),where('condominioId','==',perfil.condominioId)),snap=>{
      setTestes(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.ocr=true;concluir();
    },()=>{prontos.ocr=true;concluir();});

    const unsubSolicitacoes=onSnapshot(query(collection(db,'solicitacoesCondominio'),where('condominioId','==',perfil.condominioId)),snap=>{
      setSolicitacoes(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.solicitacoes=true;concluir();
    },()=>{prontos.solicitacoes=true;concluir();});

    const unsubDenuncias=onSnapshot(query(collection(db,'muralDenuncias'),where('condominioId','==',perfil.condominioId)),snap=>{
      setDenuncias(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      prontos.denuncias=true;concluir();
    },()=>{prontos.denuncias=true;concluir();});

    return()=>{unsubEncomendas();unsubOCR();unsubSolicitacoes();unsubDenuncias();};
  },[perfil?.condominioId]);

  const resumo=useMemo(()=>{
    const hoje=inicioDoDia();
    const inicio=hoje-(periodo-1)*DIA;
    const agora=Date.now();

    const recebidasHoje=encomendas.filter(e=>timestampMs(e.recebidaEm)>=hoje).length;
    const recebidasPeriodo=encomendas.filter(e=>timestampMs(e.recebidaEm)>=inicio).length;
    const pendentes=encomendas.filter(e=>e.status==='pendente');
    const retiradasPeriodo=encomendas.filter(e=>timestampMs(e.retiradaEm)>=inicio);
    const retiradasHoje=encomendas.filter(e=>timestampMs(e.retiradaEm)>=hoje).length;
    const atrasadas=pendentes.filter(e=>{
      const recebida=timestampMs(e.recebidaEm);
      return recebida>0&&agora-recebida>=3*DIA;
    });

    const pares=retiradasPeriodo.filter(e=>timestampMs(e.recebidaEm)>0&&timestampMs(e.retiradaEm)>0);
    const mediaHoras=pares.length?pares.reduce((s,e)=>s+(timestampMs(e.retiradaEm)-timestampMs(e.recebidaEm))/3600000,0)/pares.length:0;

    const ocrPeriodo=testes.filter(t=>timestampMs(t.criadoEm)>=inicio);
    const acertoOCR=ocrPeriodo.length?ocrPeriodo.filter(t=>t.acertoTop1).length/ocrPeriodo.length*100:0;

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
      inicio,
      recebidasHoje,
      recebidasPeriodo,
      pendentes:pendentes.length,
      retiradasPeriodo:retiradasPeriodo.length,
      retiradasHoje,
      atrasadas:atrasadas.length,
      solicitacoesPendentes:solicitacoes.filter(s=>s.status==='pendente').length,
      denunciasPendentes:denuncias.filter(d=>(d.status||'pendente')==='pendente').length,
      mediaHoras,
      atividade,
      antigas,
      ocrLeituras:ocrPeriodo.length,
      acertoOCR,
    };
  },[encomendas,testes,solicitacoes,denuncias,periodo]);

  function abrirEncomendas(filtroInicial:string){
    navigation.navigate('Home',{screen:'Encomendas',params:{filtroInicial}});
  }

  async function exportarCSV(){
    if(exportando)return;
    try{
      setExportando(true);
      const linhas=[
        ['Relatório Cegonha',perfil?.condominioNome||'Condomínio'],
        ['Período',`${periodo} dias`],
        ['Gerado em',new Date().toLocaleString('pt-BR')],
        [],
        ['Resumo'],
        ['Recebidas no período',resumo.recebidasPeriodo],
        ['Pendentes agora',resumo.pendentes],
        ['Retiradas no período',resumo.retiradasPeriodo],
        ['Retiradas hoje',resumo.retiradasHoje],
        ['Há mais de 3 dias',resumo.atrasadas],
        ['Tempo médio até retirada (h)',resumo.mediaHoras?resumo.mediaHoras.toFixed(1):''],
        ['Solicitações pendentes',resumo.solicitacoesPendentes],
        ['Denúncias pendentes',resumo.denunciasPendentes],
        ['Leituras OCR avaliadas',resumo.ocrLeituras],
        ['Acerto OCR top-1 (%)',resumo.ocrLeituras?resumo.acertoOCR.toFixed(1):''],
        [],
        ['Encomendas do período'],
        ['Código','Morador','Bloco','Apartamento','Status','Recebida em','Retirada em','Portaria','Entregue a','Origem'],
        ...encomendas
          .filter(e=>timestampMs(e.recebidaEm)>=resumo.inicio||timestampMs(e.retiradaEm)>=resumo.inicio)
          .sort((a,b)=>timestampMs(b.recebidaEm)-timestampMs(a.recebidaEm))
          .map(e=>[
            e.codigoReferencia||e.id,
            e.moradorNome||'',
            e.bloco||'',
            e.apartamento||'',
            e.status||'',
            dataHora(timestampMs(e.recebidaEm)),
            dataHora(timestampMs(e.retiradaEm)),
            e.porteiroNome||'',
            e.retiradaRecebedorNome||'',
            e.origem||'',
          ]),
      ];
      const csv='\uFEFF'+linhas.map(linha=>linha.map(csvCelula).join(';')).join('\n');
      await Clipboard.setStringAsync(csv);
      await Share.share({title:`Relatório Cegonha · ${periodo} dias`,message:csv});
    }catch(e:any){Alert.alert('Exportar relatório',e?.message||'Não foi possível preparar o CSV.');}
    finally{setExportando(false);}
  }

  return <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>RELATÓRIOS</Text>
    <Text style={styles.title}>Resumo operacional</Text>
    <Text style={styles.subtitle}>Acompanhe o que exige atenção agora e consulte os indicadores do condomínio.</Text>

    <View style={styles.toolbar}>
      <View style={styles.filters}>
        {PERIODOS.map(dias=><TouchableOpacity key={dias} style={[styles.filter,periodo===dias&&styles.filterActive]} onPress={()=>setPeriodo(dias)}><Text style={[styles.filterText,periodo===dias&&styles.filterTextActive]}>{dias} dias</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity style={styles.exportButton} onPress={exportarCSV} disabled={exportando}><Ionicons name="download-outline" size={18} color="#fff"/><Text style={styles.exportText}>{exportando?'Preparando...':'Exportar CSV'}</Text></TouchableOpacity>
    </View>

    {loading?<LoadingCards count={3}/>:<>
      <Text style={styles.sectionFirst}>Atenção da portaria</Text>
      <View style={styles.attentionGrid}>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>abrirEncomendas('atrasadas')}><Ionicons name="alert-circle-outline" size={21} color={resumo.atrasadas?colors.warning:colors.muted}/><Text style={styles.attentionNumber}>{resumo.atrasadas}</Text><Text style={styles.attentionLabel}>encomendas há +3 dias</Text><Text style={styles.openHint}>Abrir pendências</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>navigation.navigate('SolicitacoesCondominio')}><Ionicons name="person-add-outline" size={21} color={colors.porter}/><Text style={styles.attentionNumber}>{resumo.solicitacoesPendentes}</Text><Text style={styles.attentionLabel}>solicitações de entrada</Text><Text style={styles.openHint}>Revisar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>navigation.navigate('Denuncias')}><Ionicons name="flag-outline" size={21} color={resumo.denunciasPendentes?colors.danger:colors.muted}/><Text style={styles.attentionNumber}>{resumo.denunciasPendentes}</Text><Text style={styles.attentionLabel}>denúncias pendentes</Text><Text style={styles.openHint}>Abrir central</Text></TouchableOpacity>
        <TouchableOpacity style={styles.attentionCard} onPress={()=>abrirEncomendas('retiradasHoje')}><Ionicons name="checkmark-circle-outline" size={21} color={colors.success}/><Text style={styles.attentionNumber}>{resumo.retiradasHoje}</Text><Text style={styles.attentionLabel}>retiradas hoje</Text><Text style={styles.openHint}>Ver retiradas</Text></TouchableOpacity>
      </View>

      <Text style={styles.section}>Indicadores</Text>
      <View style={styles.grid}>
        <View style={styles.card}><Ionicons name="today-outline" size={20} color={colors.info}/><Text style={styles.number}>{resumo.recebidasHoje}</Text><Text style={styles.label}>Recebidas hoje</Text></View>
        <View style={styles.card}><Ionicons name="cube-outline" size={20} color={colors.porter}/><Text style={styles.number}>{resumo.pendentes}</Text><Text style={styles.label}>Pendentes agora</Text></View>
        <View style={styles.card}><Ionicons name="checkmark-circle-outline" size={20} color={colors.success}/><Text style={styles.number}>{resumo.retiradasPeriodo}</Text><Text style={styles.label}>Retiradas em {periodo} dias</Text></View>
        <View style={styles.card}><Ionicons name="alert-circle-outline" size={20} color={resumo.atrasadas?colors.warning:colors.muted}/><Text style={[styles.number,resumo.atrasadas>0&&{color:colors.warning}]}>{resumo.atrasadas}</Text><Text style={styles.label}>Há +3 dias</Text></View>
      </View>

      <View style={styles.summary}>
        <View style={{flex:1}}><Text style={styles.summaryValue}>{resumo.recebidasPeriodo}</Text><Text style={styles.summaryLabel}>recebidas no período</Text></View>
        <View style={styles.verticalLine}/>
        <View style={{flex:1}}><Text style={styles.summaryValue}>{resumo.mediaHoras?`${resumo.mediaHoras.toFixed(1)} h`:'—'}</Text><Text style={styles.summaryLabel}>tempo médio até retirada</Text></View>
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
      {resumo.antigas.length?<View>{resumo.antigas.map(item=><TouchableOpacity key={item.id} style={styles.pendingRow} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})}>
        <View style={{flex:1}}><Text style={styles.pendingName}>{item.moradorNome||'Morador'}</Text><Text style={styles.pendingMeta}>Bloco {item.bloco||'-'} · Ap. {item.apartamento||'-'} · {item.codigoReferencia?`#${item.codigoReferencia}`:'sem código'}</Text></View>
        <View style={styles.daysBadge}><Text style={styles.daysText}>{item.dias} dias</Text></View>
      </TouchableOpacity>)}</View>:<EmptyState icon="checkmark-done-outline" title="Sem atrasos" text="Não há encomendas aguardando retirada há mais de 3 dias."/>}

      <Text style={styles.section}>OCR no período</Text>
      <View style={styles.ocrBox}>
        <View style={{flex:1}}><Text style={styles.ocrValue}>{resumo.ocrLeituras}</Text><Text style={styles.label}>leituras avaliadas</Text></View>
        <View style={styles.verticalLine}/>
        <View style={{flex:1}}><Text style={styles.ocrValue}>{resumo.ocrLeituras?`${resumo.acertoOCR.toFixed(1)}%`:'—'}</Text><Text style={styles.label}>acerto do 1º candidato</Text></View>
      </View>
      <TouchableOpacity style={styles.auditLink} onPress={()=>navigation.navigate('AtividadesPortaria')}><View style={styles.auditLeft}><Ionicons name="receipt-outline" size={20} color={colors.porter}/><View><Text style={styles.auditTitle}>Atividades da Portaria</Text><Text style={styles.auditHint}>Consulte registros de chegada, retirada, vínculos e moderação</Text></View></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>
      <Text style={styles.note}>O relatório usa os registros em tempo real do condomínio. O CSV é preparado no aparelho e também fica copiado para a área de transferência.</Text>
    </>}
  </ScrollView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{padding:22,paddingBottom:120,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:36,fontWeight:'700',marginTop:3},subtitle:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:4,marginBottom:13},toolbar:{gap:9,marginBottom:5},filters:{flexDirection:'row',gap:7},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.porter,borderColor:colors.porter},filterText:{fontSize:13,fontWeight:'700'},filterTextActive:{color:'#fff'},exportButton:{alignSelf:'flex-start',height:42,paddingHorizontal:14,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',gap:6},exportText:{fontSize:13,fontWeight:'700',color:'#fff'},sectionFirst:{fontSize:22,fontWeight:'700',marginTop:15,marginBottom:9},attentionGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},attentionCard:{width:'48.5%',minHeight:128,backgroundColor:colors.surface,borderRadius:radius.medium,padding:14,borderWidth:1,borderColor:colors.border},attentionNumber:{fontSize:29,fontWeight:'700',color:colors.porter,marginTop:5},attentionLabel:{fontSize:13,color:colors.muted,lineHeight:17},openHint:{fontSize:11,fontWeight:'700',color:colors.porter,marginTop:7},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},card:{width:'48.5%',backgroundColor:colors.surface,borderRadius:radius.medium,padding:15,borderWidth:1,borderColor:colors.border},number:{fontSize:30,fontWeight:'700',color:colors.porter,marginTop:5},label:{fontSize:13,color:colors.muted,marginTop:1},summary:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:15,marginTop:10,borderWidth:1,borderColor:colors.border},summaryValue:{fontSize:23,fontWeight:'700',color:colors.porter},summaryLabel:{fontSize:12,color:colors.muted,marginTop:1},verticalLine:{width:1,height:40,backgroundColor:colors.border,marginHorizontal:16},section:{fontSize:22,fontWeight:'700',marginTop:20,marginBottom:9},activityBox:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,paddingHorizontal:13},activityRow:{minHeight:48,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border,gap:10},activityRowLast:{borderBottomWidth:0},day:{width:52,fontSize:13,fontWeight:'700',color:colors.porter},activityMetric:{flex:1,flexDirection:'row',alignItems:'center',gap:5},activityText:{fontSize:12,color:colors.muted},pendingRow:{minHeight:58,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:12,marginBottom:7,flexDirection:'row',alignItems:'center',gap:10},pendingName:{fontSize:16,fontWeight:'700'},pendingMeta:{fontSize:12,color:colors.muted,marginTop:2},daysBadge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft},daysText:{fontSize:12,fontWeight:'700',color:colors.warning},ocrBox:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:radius.medium,padding:16,borderWidth:1,borderColor:colors.border},ocrValue:{fontSize:26,fontWeight:'700',color:colors.porter},auditLink:{minHeight:64,backgroundColor:colors.porterSoft,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:13,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},auditLeft:{flexDirection:'row',alignItems:'center',gap:10,flex:1},auditTitle:{fontSize:16,fontWeight:'700'},auditHint:{fontSize:12,color:colors.muted,marginTop:2},note:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:12}
});}
