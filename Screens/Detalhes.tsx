import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { registrarRetirada } from '../services/encomendas';
import {
  confirmarSolicitacaoRetirada,
  contestarEncomenda,
  refContestacaoEncomenda,
  refSolicitacaoRetirada,
  solicitarConfirmacaoRetirada,
} from '../services/interacoesEncomenda';
import { radius, ThemeColors } from '../theme';

export default function Detalhes({route,navigation}:any){
  const inicial=route.params.encomenda;
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [encomenda,setEncomenda]=useState<any>(inicial);
  const [solicitacaoRetirada,setSolicitacaoRetirada]=useState<any>(null);
  const [contestacao,setContestacao]=useState<any>(null);
  const [loading,setLoading]=useState(false);

  const ehPortaria=perfil?.tipo==='porteiro';
  const ehMorador=perfil?.tipo==='morador';

  useEffect(()=>{
    const unsubEncomenda=onSnapshot(doc(db,'encomendas',inicial.id),snap=>{
      if(snap.exists())setEncomenda({id:snap.id,...snap.data()});
    });
    const unsubRetirada=onSnapshot(refSolicitacaoRetirada(inicial.id),snap=>{
      setSolicitacaoRetirada(snap.exists()?{id:snap.id,...snap.data()}:null);
    },()=>setSolicitacaoRetirada(null));
    const unsubContestacao=onSnapshot(refContestacaoEncomenda(inicial.id),snap=>{
      setContestacao(snap.exists()?{id:snap.id,...snap.data()}:null);
    },()=>setContestacao(null));
    return()=>{unsubEncomenda();unsubRetirada();unsubContestacao();};
  },[inicial.id]);

  const historico=useMemo(()=>{
    if(encomenda.historico?.length)return encomenda.historico;
    const h:any[]=[];
    if(encomenda.recebidaEm?.toDate)h.push({tipo:'recebida',titulo:'Recebida pela portaria',data:encomenda.recebidaEm.toDate().toISOString(),atorNome:encomenda.porteiroNome});
    if(encomenda.status==='pendente')h.push({tipo:'pendente',titulo:'Aguardando retirada',data:encomenda.recebidaEm?.toDate?.().toISOString?.()||''});
    if(encomenda.retiradaEm?.toDate)h.push({tipo:'retirada',titulo:'Retirada registrada',data:encomenda.retiradaEm.toDate().toISOString(),atorNome:encomenda.retiradaPorNome});
    return h;
  },[encomenda]);

  const retiradaSolicitada=!!solicitacaoRetirada&&encomenda.status==='pendente';
  const retiradaConfirmada=encomenda.status==='retirada';

  async function retirar(){
    if(!ehPortaria)return;
    try{
      setLoading(true);
      const alterou=await registrarRetirada(encomenda,perfil);
      if(!alterou){Alert.alert('Retirada','Esta encomenda já não está pendente.');return;}
      await confirmarSolicitacaoRetirada(encomenda.id,perfil).catch(()=>false);
      Alert.alert('Retirada registrada',retiradaSolicitada?'A solicitação do morador foi confirmada e ele foi avisado.':'A retirada foi registrada pela portaria e o morador foi avisado.');
    }catch(e:any){Alert.alert('Erro',e?.message||'Não foi possível registrar a retirada.');}
    finally{setLoading(false);}
  }

  function informarRetirada(){
    if(!ehMorador||retiradaSolicitada||retiradaConfirmada||contestacao)return;
    Alert.alert('Informar retirada?','A portaria receberá um aviso e precisará confirmar a retirada no sistema.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Sim, já retirei',onPress:async()=>{
        try{
          setLoading(true);
          await solicitarConfirmacaoRetirada(encomenda,perfil);
          Alert.alert('Portaria avisada','Sua retirada foi informada. Agora aguarde a confirmação da portaria.');
        }catch(e:any){
          const codigo=String(e?.code||'');
          Alert.alert('Não foi possível informar',codigo.includes('permission-denied')?'Esta solicitação já pode ter sido enviada ou as regras do Firestore ainda não foram publicadas. Atualize as regras e tente novamente.':e?.message||'Tente novamente.');
        }finally{setLoading(false);}
      }},
    ]);
  }

  function contestar(){
    if(!ehMorador||contestacao)return;
    const tipo=retiradaConfirmada?'nao_retirei':'nao_reconheco';
    const titulo=retiradaConfirmada?'Contestar retirada?':'Contestar encomenda?';
    const mensagem=retiradaConfirmada
      ? 'Use esta opção se o sistema informa que a encomenda foi retirada, mas você não realizou essa retirada.'
      : 'Use esta opção se você não reconhece esta encomenda ou acredita que ela foi registrada para o morador errado.';
    Alert.alert(titulo,mensagem,[
      {text:'Cancelar',style:'cancel'},
      {text:'Enviar contestação',style:'destructive',onPress:async()=>{
        try{
          setLoading(true);
          await contestarEncomenda(encomenda,perfil,tipo);
          Alert.alert('Contestação enviada','A portaria foi notificada e a contestação ficou registrada no sistema.');
        }catch(e:any){
          const codigo=String(e?.code||'');
          Alert.alert('Não foi possível contestar',codigo.includes('permission-denied')?'Esta contestação já pode ter sido registrada ou as regras do Firestore ainda não foram publicadas.':e?.message||'Tente novamente.');
        }finally{setLoading(false);}
      }},
    ]);
  }

  const statusTexto=retiradaConfirmada?'Retirada':retiradaSolicitada?'Aguardando confirmação':'Aguardando retirada';

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity>
      <Text style={styles.eyebrow}>ENCOMENDA {encomenda.codigoReferencia?'#'+encomenda.codigoReferencia:''}</Text>
      <Text style={styles.title}>{encomenda.moradorNome}</Text>
      <Text style={styles.subtitle}>Bloco {encomenda.bloco} · Ap. {encomenda.apartamento}</Text>

      <View style={styles.infoCard}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Status atual</Text>
          <View style={[styles.badge,retiradaConfirmada?styles.done:styles.pending]}><Text style={retiradaConfirmada?styles.doneText:styles.pendingText}>{statusTexto}</Text></View>
        </View>
        {!!encomenda.descricao&&<><Text style={styles.label}>Descrição</Text><Text style={styles.value}>{encomenda.descricao}</Text></>}
        <Text style={styles.label}>Registrada por</Text><Text style={styles.value}>{encomenda.porteiroNome||'Portaria'}</Text>
      </View>

      {!!solicitacaoRetirada&&<View style={[styles.interactionCard,{borderColor:colors.info}]}>
        <Ionicons name={retiradaConfirmada?'checkmark-circle-outline':'hand-right-outline'} size={22} color={retiradaConfirmada?colors.success:colors.info}/>
        <View style={{flex:1}}><Text style={styles.interactionTitle}>{retiradaConfirmada?'Retirada confirmada':'Morador informou a retirada'}</Text><Text style={styles.interactionText}>{retiradaConfirmada?'A portaria confirmou a retirada no sistema.':'A confirmação da portaria ainda está pendente.'}</Text></View>
      </View>}

      {!!contestacao&&<View style={[styles.interactionCard,{borderColor:colors.danger}]}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger}/>
        <View style={{flex:1}}><Text style={[styles.interactionTitle,{color:colors.danger}]}>Encomenda contestada</Text><Text style={styles.interactionText}>{contestacao.motivo||'O morador contestou este registro.'}</Text><Text style={styles.interactionMeta}>{contestacao.criadaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text></View>
      </View>}

      <Text style={styles.section}>Linha do tempo</Text>
      <View style={styles.timeline}>{historico.map((ev:any,i:number)=><View key={`${ev.tipo}-${ev.data}-${i}`} style={styles.event}>
        <View style={styles.track}><View style={[styles.dot,ev.tipo==='retirada'&&{backgroundColor:colors.success}]}/>{i<historico.length-1&&<View style={styles.line}/>}</View>
        <View style={styles.eventBody}><Text style={styles.eventTitle}>{ev.titulo}</Text><Text style={styles.eventMeta}>{ev.data?new Date(ev.data).toLocaleString('pt-BR'):''}{ev.atorNome?' · '+ev.atorNome:''}</Text>{!!ev.observacao&&<Text style={styles.eventObs}>{ev.observacao}</Text>}</View>
      </View>)}</View>

      {ehMorador&&!retiradaConfirmada&&!retiradaSolicitada&&!contestacao&&<TouchableOpacity style={[styles.button,{backgroundColor:colors.accent},loading&&{opacity:.55}]} onPress={informarRetirada} disabled={loading}><Text style={styles.buttonText}>Já retirei esta encomenda</Text><Ionicons name="hand-right-outline" size={20} color="#fff"/></TouchableOpacity>}
      {ehMorador&&retiradaSolicitada&&!retiradaConfirmada&&<View style={styles.waiting}><Ionicons name="time-outline" size={19} color={colors.info}/><Text style={styles.waitingText}>Você informou a retirada. Aguardando a portaria confirmar.</Text></View>}
      {ehMorador&&!contestacao&&!retiradaSolicitada&&<TouchableOpacity style={[styles.outlineButton,loading&&{opacity:.55}]} onPress={contestar} disabled={loading}><Ionicons name="alert-circle-outline" size={19} color={colors.danger}/><Text style={styles.outlineButtonText}>{retiradaConfirmada?'Não retirei esta encomenda':'Não reconheço esta encomenda'}</Text></TouchableOpacity>}

      {encomenda.status==='pendente'&&ehPortaria&&<TouchableOpacity style={[styles.button,loading&&{opacity:.55}]} onPress={retirar} disabled={loading}><Text style={styles.buttonText}>{loading?'Registrando...':retiradaSolicitada?'Confirmar retirada informada':'Registrar retirada'}</Text><Ionicons name="checkmark-circle-outline" size={20} color="#fff"/></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{padding:22,paddingBottom:60,backgroundColor:colors.background},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginBottom:20},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.5,color:colors.accent},title:{fontSize:36,fontWeight:'700',marginTop:4},subtitle:{fontSize:17,color:colors.muted,marginTop:2,marginBottom:15},infoCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:17,borderWidth:1,borderColor:colors.border},statusRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:13,gap:10},label:{fontSize:12,fontWeight:'700',letterSpacing:.7,color:colors.muted,textTransform:'uppercase',marginTop:10},value:{fontSize:17,marginTop:3},badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},pending:{backgroundColor:colors.surfaceSoft},done:{backgroundColor:colors.surfaceSoft},pendingText:{fontSize:12,fontWeight:'700',color:colors.warning},doneText:{fontSize:12,fontWeight:'700',color:colors.success},interactionCard:{marginTop:12,backgroundColor:colors.surface,borderRadius:radius.medium,padding:14,borderWidth:1,flexDirection:'row',gap:10,alignItems:'flex-start'},interactionTitle:{fontSize:16,fontWeight:'700'},interactionText:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:2},interactionMeta:{fontSize:12,color:colors.muted,marginTop:5},section:{fontSize:24,fontWeight:'700',marginTop:20,marginBottom:10},timeline:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border},event:{flexDirection:'row'},track:{width:24,alignItems:'center'},dot:{width:10,height:10,borderRadius:5,backgroundColor:colors.accent,marginTop:5},line:{width:1,flex:1,backgroundColor:colors.border,minHeight:38},eventBody:{flex:1,paddingBottom:18},eventTitle:{fontSize:17,fontWeight:'700'},eventMeta:{fontSize:13,color:colors.muted,marginTop:2},eventObs:{fontSize:14,color:colors.muted,marginTop:4},button:{height:54,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:18},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},outlineButton:{height:52,borderRadius:radius.pill,borderWidth:1,borderColor:colors.danger,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:10},outlineButtonText:{fontSize:16,fontWeight:'700',color:colors.danger},waiting:{marginTop:16,padding:13,borderRadius:radius.medium,backgroundColor:colors.surfaceSoft,flexDirection:'row',gap:8,alignItems:'center'},waitingText:{flex:1,fontSize:14,fontWeight:'600',color:colors.info}
});}
