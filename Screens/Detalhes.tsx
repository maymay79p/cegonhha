import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { registrarRetirada } from '../services/encomendas';
import { radius, ThemeColors } from '../theme';

export default function Detalhes({route,navigation}:any){
  const inicial=route.params.encomenda;
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [encomenda,setEncomenda]=useState<any>(inicial);
  const [loading,setLoading]=useState(false);
  const [foto,setFoto]=useState('');

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,'encomendas',inicial.id),snap=>{
      if(snap.exists())setEncomenda({id:snap.id,...snap.data()});
    });
    getDoc(doc(db,'fotosEncomendas',inicial.id)).then(s=>{if(s.exists())setFoto(String(s.data()?.foto||''));}).catch(()=>{});
    return unsub;
  },[inicial.id]);

  const historico=useMemo(()=>{
    if(encomenda.historico?.length)return encomenda.historico;
    const h:any[]=[];
    if(encomenda.recebidaEm?.toDate)h.push({tipo:'recebida',titulo:'Recebida pela portaria',data:encomenda.recebidaEm.toDate().toISOString(),atorNome:encomenda.porteiroNome});
    if(encomenda.status==='pendente')h.push({tipo:'pendente',titulo:'Aguardando retirada',data:encomenda.recebidaEm?.toDate?.().toISOString?.()||''});
    if(encomenda.retiradaEm?.toDate)h.push({tipo:'retirada',titulo:'Retirada registrada',data:encomenda.retiradaEm.toDate().toISOString(),atorNome:encomenda.retiradaPorNome});
    return h;
  },[encomenda]);

  async function retirar(){
    if(perfil?.tipo!=='porteiro')return;
    try{
      setLoading(true);
      await registrarRetirada(encomenda,perfil);
      Alert.alert('Retirada registrada','O histórico foi atualizado e o morador foi avisado.');
    }catch(e:any){
      Alert.alert('Erro',e?.message||'Não foi possível registrar a retirada.');
    }finally{setLoading(false);}
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity>
      <Text style={styles.eyebrow}>ENCOMENDA {encomenda.codigoReferencia?'#'+encomenda.codigoReferencia:''}</Text>
      <Text style={styles.title}>{encomenda.moradorNome}</Text>
      <Text style={styles.subtitle}>Bloco {encomenda.bloco} · Ap. {encomenda.apartamento}</Text>

      {foto?<Image source={{uri:foto}} style={styles.image}/>:null}

      <View style={styles.infoCard}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Status atual</Text>
          <View style={[styles.badge,encomenda.status==='retirada'?styles.done:styles.pending]}><Text style={encomenda.status==='retirada'?styles.doneText:styles.pendingText}>{encomenda.status==='retirada'?'Retirada':'Aguardando retirada'}</Text></View>
        </View>
        {!!encomenda.descricao&&<><Text style={styles.label}>Descrição</Text><Text style={styles.value}>{encomenda.descricao}</Text></>}
        <Text style={styles.label}>Registrada por</Text><Text style={styles.value}>{encomenda.porteiroNome||'Portaria'}</Text>
        {!!encomenda.textoOCR&&<><Text style={styles.label}>Texto identificado pelo OCR</Text><Text style={styles.ocr}>{encomenda.textoOCR}</Text></>}
      </View>

      <Text style={styles.section}>Linha do tempo</Text>
      <View style={styles.timeline}>{historico.map((ev:any,i:number)=><View key={`${ev.tipo}-${ev.data}-${i}`} style={styles.event}>
        <View style={styles.track}><View style={[styles.dot,ev.tipo==='retirada'&&{backgroundColor:colors.success}]}/>{i<historico.length-1&&<View style={styles.line}/>}</View>
        <View style={styles.eventBody}><Text style={styles.eventTitle}>{ev.titulo}</Text><Text style={styles.eventMeta}>{ev.data?new Date(ev.data).toLocaleString('pt-BR'):''}{ev.atorNome?' · '+ev.atorNome:''}</Text>{!!ev.observacao&&<Text style={styles.eventObs}>{ev.observacao}</Text>}</View>
      </View>)}</View>

      {encomenda.status==='pendente'&&perfil?.tipo==='porteiro'&&<TouchableOpacity style={[styles.button,loading&&{opacity:.55}]} onPress={retirar} disabled={loading}><Text style={styles.buttonText}>{loading?'Registrando...':'Registrar retirada'}</Text><Ionicons name="checkmark-circle-outline" size={20} color="#fff"/></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{padding:22,paddingBottom:45,backgroundColor:colors.background},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginBottom:20},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.5,color:colors.accent},title:{fontSize:36,fontWeight:'700',marginTop:4},subtitle:{fontSize:17,color:colors.muted,marginTop:2,marginBottom:15},image:{width:'100%',height:210,borderRadius:radius.large,marginBottom:14},infoCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:17,borderWidth:1,borderColor:colors.border},statusRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:13},label:{fontSize:12,fontWeight:'700',letterSpacing:.7,color:colors.muted,textTransform:'uppercase',marginTop:10},value:{fontSize:17,marginTop:3},ocr:{fontSize:14,lineHeight:20,color:colors.muted,marginTop:5},badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},pending:{backgroundColor:colors.surfaceSoft},done:{backgroundColor:colors.surfaceSoft},pendingText:{fontSize:12,fontWeight:'700',color:colors.warning},doneText:{fontSize:12,fontWeight:'700',color:colors.success},section:{fontSize:24,fontWeight:'700',marginTop:20,marginBottom:10},timeline:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border},event:{flexDirection:'row'},track:{width:24,alignItems:'center'},dot:{width:10,height:10,borderRadius:5,backgroundColor:colors.accent,marginTop:5},line:{width:1,flex:1,backgroundColor:colors.border,minHeight:38},eventBody:{flex:1,paddingBottom:18},eventTitle:{fontSize:17,fontWeight:'700'},eventMeta:{fontSize:13,color:colors.muted,marginTop:2},eventObs:{fontSize:14,color:colors.muted,marginTop:4},button:{height:54,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:18},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'}
});}
