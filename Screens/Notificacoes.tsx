import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

export default function Notificacoes(){
  const {user,perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [itens,setItens]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [soNaoLidas,setSoNaoLidas]=useState(false);

  useEffect(()=>{
    if(!user||perfil?.tipo!=='morador'){
      setItens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q=query(collection(db,'notificacoes'),where('moradorId','==',user.uid));
    const unsubscribe=onSnapshot(q,snap=>{
      const dados=snap.docs.map(x=>({id:x.id,...x.data()})) as any[];
      dados.sort((a,b)=>(b.criadaEm?.seconds||0)-(a.criadaEm?.seconds||0));
      setItens(dados);
      setLoading(false);
    },()=>setLoading(false));
    return unsubscribe;
  },[user?.uid,perfil?.tipo]);

  async function marcarLida(id:string){ await updateDoc(doc(db,'notificacoes',id),{lida:true}); }
  async function marcarTodas(){ await Promise.all(itens.filter(i=>!i.lida).map(i=>updateDoc(doc(db,'notificacoes',i.id),{lida:true}))); }

  const exibidos=useMemo(()=>soNaoLidas?itens.filter(i=>!i.lida):itens,[itens,soNaoLidas]);
  const naoLidas=itens.filter(i=>!i.lida).length;

  function icon(tipo:string){
    if(tipo==='chegada')return'cube-outline';
    if(tipo==='retirada')return'checkmark-circle-outline';
    if(tipo==='lembrete')return'time-outline';
    if(tipo==='vinculo')return'people-outline';
    return'notifications-outline';
  }

  return <View style={styles.container}>
    <View style={styles.top}><View><Text style={styles.eyebrow}>CENTRAL</Text><Text style={styles.title}>Notificações</Text></View>{naoLidas>0&&<TouchableOpacity onPress={marcarTodas}><Text style={styles.markAll}>Marcar todas</Text></TouchableOpacity>}</View>
    <View style={styles.filters}>
      <TouchableOpacity style={[styles.filter,!soNaoLidas&&styles.active]} onPress={()=>setSoNaoLidas(false)}><Text style={[styles.filterText,!soNaoLidas&&styles.activeText]}>Todas</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.filter,soNaoLidas&&styles.active]} onPress={()=>setSoNaoLidas(true)}><Text style={[styles.filterText,soNaoLidas&&styles.activeText]}>Não lidas · {naoLidas}</Text></TouchableOpacity>
    </View>
    {loading?<LoadingCards/>:<View>{!exibidos.length?<EmptyState icon="notifications-off-outline" title="Sem avisos" text="Assim que uma encomenda for vinculada ao seu nome, a notificação aparecerá aqui automaticamente."/>:exibidos.map(item=><TouchableOpacity key={item.id} style={[styles.card,!item.lida&&styles.unread]} onPress={()=>!item.lida&&marcarLida(item.id)}>
      <View style={[styles.icon,!item.lida&&styles.iconUnread]}><Ionicons name={icon(item.tipo) as any} size={21} color={!item.lida?colors.accent:colors.muted}/></View>
      <View style={{flex:1}}><Text style={styles.message}>{item.mensagem}</Text><Text style={styles.date}>{item.criadaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text>{!item.lida&&<Text style={styles.hint}>Nova</Text>}</View>
    </TouchableOpacity>)}</View>}
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.accent},title:{fontSize:34,fontWeight:'700',marginTop:3},markAll:{fontSize:14,fontWeight:'700',color:colors.accent,marginBottom:5},filters:{flexDirection:'row',gap:7,marginVertical:13},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},active:{backgroundColor:colors.accent,borderColor:colors.accent},filterText:{fontSize:14},activeText:{color:'#fff',fontWeight:'700'},card:{flexDirection:'row',gap:12,backgroundColor:colors.surface,padding:15,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:9},unread:{borderColor:colors.accent,backgroundColor:colors.accentSoft},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},iconUnread:{backgroundColor:colors.accentSoft},message:{fontSize:16,lineHeight:21},date:{fontSize:12,color:colors.muted,marginTop:6},hint:{fontSize:12,fontWeight:'700',color:colors.accent,marginTop:4}
});}
