import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text } from '../components/AppText';
import { colors, radius } from '../theme';

function Barra({valor}:{valor:number}){
  return <View style={styles.bar}><View style={[styles.fill,{width:(String(Math.max(0,Math.min(100,valor)))+'%') as any}]}/></View>;
}

export default function Relatorios(){
  const {perfil}=useAuth();
  const [encomendas,setEncomendas]=useState<any[]>([]);
  const [testes,setTestes]=useState<any[]>([]);

  async function carregar(){
    if(!perfil?.condominioId)return;
    const [e,o]=await Promise.all([
      getDocs(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId))),
      getDocs(query(collection(db,'ocrTestes'),where('condominioId','==',perfil.condominioId)))
    ]);
    setEncomendas(e.docs.map(d=>({id:d.id,...d.data()})));
    setTestes(o.docs.map(d=>({id:d.id,...d.data()})));
  }

  useEffect(()=>{carregar();},[perfil?.condominioId]);

  const resumo=useMemo(()=>{
    const total=encomendas.length;
    const pendentes=encomendas.filter(e=>e.status==='pendente').length;
    const retiradas=encomendas.filter(e=>e.status==='retirada').length;
    const pares=encomendas.filter(e=>e.recebidaEm?.toDate&&e.retiradaEm?.toDate);
    const mediaHoras=pares.length?pares.reduce((s,e)=>s+(e.retiradaEm.toDate().getTime()-e.recebidaEm.toDate().getTime())/3600000,0)/pares.length:0;
    const n=testes.length;
    const acertos=n?testes.filter(t=>t.acertoTop1).length/n*100:0;
    const tempo=n?testes.reduce((s,t)=>s+(t.tempoMs||0),0)/n/1000:0;
    const campo=(k:string)=>n?testes.filter(t=>t[k]).length/n*100:0;
    const manus=testes.filter(t=>t.tipoTexto==='manuscrito');
    const imp=testes.filter(t=>t.tipoTexto==='impresso');
    const taxa=(arr:any[])=>arr.length?arr.filter(t=>t.acertoTop1).length/arr.length*100:0;
    return{total,pendentes,retiradas,mediaHoras,n,acertos,tempo,nome:campo('reconheceuNome'),bloco:campo('reconheceuBloco'),apto:campo('reconheceuApartamento'),manus:taxa(manus),imp:taxa(imp)};
  },[encomendas,testes]);

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>INDICADORES</Text>
    <Text style={styles.title}>Relatório do condomínio</Text>
    <Text style={styles.subtitle}>Dados operacionais e avaliação do OCR para apresentação do TCC.</Text>

    <View style={styles.grid}>
      <View style={styles.card}><Text style={styles.number}>{resumo.total}</Text><Text style={styles.label}>Encomendas</Text></View>
      <View style={styles.card}><Text style={styles.number}>{resumo.pendentes}</Text><Text style={styles.label}>Pendentes</Text></View>
      <View style={styles.card}><Text style={styles.number}>{resumo.retiradas}</Text><Text style={styles.label}>Retiradas</Text></View>
      <View style={styles.card}><Text style={styles.number}>{resumo.mediaHoras?resumo.mediaHoras.toFixed(1)+'h':'—'}</Text><Text style={styles.label}>Tempo médio</Text></View>
    </View>

    <Text style={styles.section}>Avaliação do OCR</Text>
    <View style={styles.report}>
      <View style={styles.reportTop}>
        <View><Text style={styles.big}>{resumo.acertos.toFixed(1)}%</Text><Text style={styles.label}>acerto do primeiro candidato</Text></View>
        <View><Text style={styles.big}>{resumo.n}</Text><Text style={styles.label}>testes registrados</Text></View>
      </View>
      <Text style={styles.small}>Tempo médio de processamento: {resumo.tempo.toFixed(1)} s</Text>
      <Text style={styles.metric}>Nome reconhecido · {resumo.nome.toFixed(0)}%</Text><Barra valor={resumo.nome}/>
      <Text style={styles.metric}>Bloco reconhecido · {resumo.bloco.toFixed(0)}%</Text><Barra valor={resumo.bloco}/>
      <Text style={styles.metric}>Apartamento reconhecido · {resumo.apto.toFixed(0)}%</Text><Barra valor={resumo.apto}/>
    </View>

    <View style={styles.compare}>
      <View style={styles.compareItem}><Text style={styles.compareValue}>{resumo.imp.toFixed(1)}%</Text><Text style={styles.label}>Texto impresso</Text></View>
      <View style={styles.divider}/>
      <View style={styles.compareItem}><Text style={styles.compareValue}>{resumo.manus.toFixed(1)}%</Text><Text style={styles.label}>Manuscrito</Text></View>
    </View>

    <Text style={styles.note}>As métricas são calculadas a partir das confirmações feitas pela portaria após a leitura. Para uma análise acadêmica válida, use o protocolo em docs/AVALIACAO_OCR.md.</Text>
  </ScrollView>;
}

const styles=StyleSheet.create({
  container:{padding:22,paddingBottom:120,backgroundColor:colors.background},
  eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},
  title:{fontSize:36,fontWeight:'700',marginTop:3},
  subtitle:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:4,marginBottom:16},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:9},
  card:{width:'48.5%',backgroundColor:colors.surface,borderRadius:radius.medium,padding:16,borderWidth:1,borderColor:colors.border},
  number:{fontSize:30,fontWeight:'700',color:colors.porter},label:{fontSize:13,color:colors.muted,marginTop:1},
  section:{fontSize:24,fontWeight:'700',marginTop:20,marginBottom:10},
  report:{backgroundColor:colors.surface,borderRadius:radius.large,padding:17,borderWidth:1,borderColor:colors.border},
  reportTop:{flexDirection:'row',justifyContent:'space-between'},big:{fontSize:30,fontWeight:'700',color:colors.info},
  small:{fontSize:14,color:colors.muted,marginTop:14,marginBottom:12},
  metric:{fontSize:14,fontWeight:'700',marginTop:8},
  bar:{height:8,borderRadius:4,backgroundColor:colors.surfaceSoft,overflow:'hidden',marginTop:5},
  fill:{height:8,borderRadius:4,backgroundColor:colors.info},
  compare:{backgroundColor:colors.surface,flexDirection:'row',borderRadius:radius.large,padding:16,marginTop:10,borderWidth:1,borderColor:colors.border},
  compareItem:{flex:1,alignItems:'center'},compareValue:{fontSize:26,fontWeight:'700',color:colors.porter},divider:{width:1,backgroundColor:colors.border},
  note:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:12}
});
