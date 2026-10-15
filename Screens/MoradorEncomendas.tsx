import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

type Filtro='todas'|'pendente'|'retirada'|'hoje';

export default function MoradorEncomendas({navigation}:any){
  const {user,perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [itens,setItens]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filtro,setFiltro]=useState<Filtro>('todas');
  const [busca,setBusca]=useState('');

  useEffect(()=>{
    if(!user){setItens([]);setLoading(false);return;}
    setLoading(true);
    const q=query(collection(db,'encomendas'),where('moradorId','==',user.uid));
    const unsub=onSnapshot(q,snap=>{
      const l=snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      l.sort((a,b)=>(b.recebidaEm?.seconds||0)-(a.recebidaEm?.seconds||0));
      setItens(l);
      setLoading(false);
    },()=>setLoading(false));
    return unsub;
  },[user?.uid]);

  const exibidos=useMemo(()=>{
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const b=busca.toLowerCase().trim();
    return itens.filter(i=>{
      const data=i.recebidaEm?.toDate?.()?.getTime?.()||0;
      const ok=filtro==='todas'||(filtro==='hoje'&&data>=hoje.getTime())||i.status===filtro;
      const texto=((i.descricao||'')+' '+(i.codigoReferencia||'')+' '+(i.status||'')).toLowerCase();
      return ok&&(!b||texto.includes(b));
    });
  },[itens,filtro,busca]);

  const filtros:[Filtro,string][]=[['todas','Todas'],['pendente','Na portaria'],['retirada','Retiradas'],['hoje','Hoje']];

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>HISTÓRICO</Text>
    <Text style={styles.title}>Minhas encomendas</Text>
    <Text style={styles.subtitle}>{perfil?.condominioNome||'Sua conta'}</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Buscar descrição ou código" value={busca} onChangeText={setBusca}/></View>
    <FlatList horizontal showsHorizontalScrollIndicator={false} data={filtros} keyExtractor={i=>i[0]} contentContainerStyle={styles.filters} renderItem={({item})=><TouchableOpacity style={[styles.filter,filtro===item[0]&&styles.filterActive]} onPress={()=>setFiltro(item[0])}><Text style={[styles.filterText,filtro===item[0]&&styles.filterTextActive]}>{item[1]}</Text></TouchableOpacity>}/>
    {loading?<LoadingCards/>:<FlatList data={exibidos} keyExtractor={i=>i.id} contentContainerStyle={{paddingBottom:120}} ListEmptyComponent={<EmptyState icon="cube-outline" title="Nenhuma encomenda" text="Quando a portaria registrar uma chegada, ela aparecerá aqui automaticamente."/>} renderItem={({item})=><TouchableOpacity style={styles.card} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})}>
      <View style={styles.top}><Text style={styles.cardTitle}>{item.status==='retirada'?'Encomenda retirada':'Aguardando na portaria'}</Text><View style={[styles.dot,item.status==='retirada'?styles.dotDone:styles.dotPending]}/></View>
      {!!item.descricao&&<Text style={styles.desc}>{item.descricao}</Text>}
      <View style={styles.bottom}><Text style={styles.code}>{item.codigoReferencia?'#'+item.codigoReferencia:''}</Text><Text style={styles.date}>{item.recebidaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text></View>
    </TouchableOpacity>}/>}  
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.accent},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:16,color:colors.muted,marginBottom:13},search:{height:50,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15},searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent',paddingHorizontal:10},filters:{gap:7,paddingVertical:11},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.accent,borderColor:colors.accent},filterText:{fontSize:14},filterTextActive:{color:'#fff',fontWeight:'700'},card:{backgroundColor:colors.surface,padding:16,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:10},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},cardTitle:{fontSize:19,fontWeight:'700'},dot:{width:10,height:10,borderRadius:5},dotPending:{backgroundColor:colors.warning},dotDone:{backgroundColor:colors.success},desc:{fontSize:15,color:colors.muted,marginTop:5},bottom:{flexDirection:'row',justifyContent:'space-between',marginTop:12},code:{fontSize:12,fontWeight:'700',color:colors.muted},date:{fontSize:12,color:colors.muted}
});}
