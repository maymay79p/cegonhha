import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { correspondeBusca, montarTextoBuscaEncomenda } from '../utils/busca';
import { radius, ThemeColors } from '../theme';

type Filtro = 'pendente'|'retirada'|'hoje'|'retiradasHoje'|'atrasadas'|'todas';

export default function PorteiroEncomendas({navigation,route}:any) {
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [itens,setItens]=useState<any[]>([]);
  const [filtro,setFiltro]=useState<Filtro>('pendente');
  const [busca,setBusca]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const recebido=route?.params?.filtroInicial as Filtro|undefined;
    if(recebido&&['pendente','retirada','hoje','retiradasHoje','atrasadas','todas'].includes(recebido)){
      setFiltro(recebido);
      navigation.setParams?.({filtroInicial:undefined});
    }
  },[route?.params?.filtroInicial,navigation]);

  useEffect(()=>{
    if(!perfil?.condominioId){setItens([]);setLoading(false);return;}
    setLoading(true);
    const q=query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId));
    const unsub=onSnapshot(q,snap=>{
      const lista=snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.recebidaEm?.seconds||0)-(a.recebidaEm?.seconds||0));
      setItens(lista);
      setLoading(false);
    },()=>setLoading(false));
    return unsub;
  },[perfil?.condominioId]);

  const exibidos=useMemo(()=>{
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const hojeMs=hoje.getTime();
    return itens.filter(item=>{
      const recebida=item.recebidaEm?.toDate?.()?.getTime?.()||0;
      const retirada=item.retiradaEm?.toDate?.()?.getTime?.()||0;
      const atrasada=item.status==='pendente'&&Date.now()-recebida>=3*86400000;
      let passouFiltro=false;
      if(filtro==='todas')passouFiltro=true;
      else if(filtro==='hoje')passouFiltro=recebida>=hojeMs;
      else if(filtro==='retiradasHoje')passouFiltro=item.status==='retirada'&&retirada>=hojeMs;
      else if(filtro==='atrasadas')passouFiltro=atrasada;
      else passouFiltro=item.status===filtro;
      return passouFiltro&&correspondeBusca(montarTextoBuscaEncomenda(item),busca);
    });
  },[itens,filtro,busca]);

  const filtros:[Filtro,string][]=[['pendente','Pendentes'],['hoje','Recebidas hoje'],['atrasadas','+3 dias'],['retiradasHoje','Retiradas hoje'],['retirada','Retiradas'],['todas','Todas']];

  return <View style={styles.container}>
    <Text style={styles.eyebrow}>ENCOMENDAS</Text><Text style={styles.title}>Controle da portaria</Text>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Nome, bloco, apartamento ou código" value={busca} onChangeText={setBusca}/>{!!busca&&<TouchableOpacity onPress={()=>setBusca('')} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>

    <View style={styles.tabsShell}>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={filtros} keyExtractor={i=>i[0]} contentContainerStyle={styles.filters} renderItem={({item})=>{
        const ativo=filtro===item[0];
        return <TouchableOpacity style={[styles.filter,ativo&&styles.filterActive]} onPress={()=>setFiltro(item[0])} accessibilityRole="tab" accessibilityState={{selected:ativo}}>
          <Text style={[styles.filterText,ativo&&styles.filterTextActive]}>{item[1]}</Text>
        </TouchableOpacity>;
      }}/>
    </View>

    <TouchableOpacity style={styles.newButton} onPress={()=>navigation.navigate('EncomendaForm')}><Ionicons name="add" size={19} color="#fff"/><Text style={styles.newButtonText}>Nova chegada</Text></TouchableOpacity>
    {loading?<LoadingCards/>:<FlatList data={exibidos} keyExtractor={i=>i.id} contentContainerStyle={{paddingBottom:120}} ListEmptyComponent={<EmptyState icon="cube-outline" title="Nada por aqui" text="Nenhuma encomenda corresponde aos filtros ou à busca."/>} renderItem={({item})=><TouchableOpacity style={styles.card} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})} accessibilityLabel={`${item.moradorNome || 'Morador'}, bloco ${item.bloco || 'não informado'}, apartamento ${item.apartamento || 'não informado'}, ${item.status === 'retirada' ? 'retirada' : 'pendente'}`}>
      <View style={styles.top}><View style={{flex:1}}><Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>Bloco {item.bloco} · Ap. {item.apartamento}</Text></View><View style={[styles.badge,item.status==='retirada'?styles.done:styles.pending]}><Text style={item.status==='retirada'?styles.doneText:styles.pendingText}>{item.status==='retirada'?'Retirada':'Pendente'}</Text></View></View>
      <View style={styles.bottom}><Text style={styles.code}>{item.codigoReferencia?'#'+item.codigoReferencia:''}</Text><Text style={styles.date}>{item.recebidaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text></View>
    </TouchableOpacity>}/>}  
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:34,fontWeight:'700',marginTop:3,marginBottom:13},search:{minHeight:50,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15},searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent',paddingHorizontal:10},tabsShell:{marginTop:12,marginBottom:12,borderBottomWidth:1,borderBottomColor:colors.border},filters:{paddingHorizontal:2,gap:4},filter:{minHeight:40,paddingHorizontal:12,paddingVertical:9,justifyContent:'center',borderBottomWidth:3,borderBottomColor:'transparent'},filterActive:{borderBottomColor:colors.porter,backgroundColor:colors.porterSoft},filterText:{fontSize:14,color:colors.muted},filterTextActive:{color:colors.porter,fontWeight:'700'},newButton:{alignSelf:'flex-start',backgroundColor:colors.porter,minHeight:43,paddingHorizontal:16,borderRadius:radius.pill,flexDirection:'row',alignItems:'center',gap:6,marginBottom:12},newButtonText:{color:'#fff',fontWeight:'700'},card:{backgroundColor:colors.surface,padding:16,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:10},top:{flexDirection:'row',alignItems:'center',gap:8},name:{fontSize:19,fontWeight:'700'},meta:{fontSize:14,color:colors.muted,marginTop:2},badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},pending:{backgroundColor:colors.surfaceSoft},done:{backgroundColor:colors.surfaceSoft},pendingText:{fontSize:12,fontWeight:'700',color:colors.warning},doneText:{fontSize:12,fontWeight:'700',color:colors.success},bottom:{flexDirection:'row',justifyContent:'space-between',marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:colors.border},code:{fontSize:12,color:colors.muted,fontWeight:'700'},date:{fontSize:12,color:colors.muted}
});}
