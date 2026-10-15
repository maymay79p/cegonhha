import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { colors, radius } from '../theme';

type Filtro = 'pendente'|'retirada'|'hoje'|'atrasadas'|'todas';

export default function PorteiroEncomendas({navigation}:any) {
  const {perfil}=useAuth();
  const [itens,setItens]=useState<any[]>([]);
  const [filtro,setFiltro]=useState<Filtro>('pendente');
  const [busca,setBusca]=useState('');
  const [loading,setLoading]=useState(true);

  async function carregar(){
    if(!perfil?.condominioId)return;
    setLoading(true);
    try{
      const snap=await getDocs(query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId)));
      const lista=snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.recebidaEm?.seconds||0)-(a.recebidaEm?.seconds||0));
      setItens(lista);
    }finally{setLoading(false);}
  }

  useEffect(()=>{
    carregar();
    const u=navigation.addListener?.('focus',carregar);
    return()=>u?.();
  },[perfil?.condominioId]);

  const exibidos=useMemo(()=>{
    const hoje=new Date();hoje.setHours(0,0,0,0);
    const b=busca.trim().toLowerCase();
    return itens.filter(item=>{
      const data=item.recebidaEm?.toDate?.()?.getTime?.()||0;
      const atrasada=item.status==='pendente'&&Date.now()-data>=3*86400000;
      const passouFiltro=filtro==='todas'||(filtro==='hoje'&&data>=hoje.getTime())||(filtro==='atrasadas'&&atrasada)||item.status===filtro;
      const texto=((item.moradorNome||'')+' '+(item.bloco||'')+' '+(item.apartamento||'')+' '+(item.codigoReferencia||'')+' '+(item.descricao||'')).toLowerCase();
      return passouFiltro&&(!b||texto.includes(b));
    });
  },[itens,filtro,busca]);

  const filtros:[Filtro,string][]=[['pendente','Pendentes'],['hoje','Hoje'],['atrasadas','+3 dias'],['retirada','Retiradas'],['todas','Todas']];

  return(
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ENCOMENDAS</Text>
      <Text style={styles.title}>Controle da portaria</Text>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={19} color={colors.muted}/>
        <TextInput style={styles.searchInput} placeholder="Nome, bloco, ap. ou código" value={busca} onChangeText={setBusca}/>
      </View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={filtros} keyExtractor={i=>i[0]} contentContainerStyle={styles.filters} renderItem={({item})=>
        <TouchableOpacity style={[styles.filter,filtro===item[0]&&styles.filterActive]} onPress={()=>setFiltro(item[0])}>
          <Text style={[styles.filterText,filtro===item[0]&&styles.filterTextActive]}>{item[1]}</Text>
        </TouchableOpacity>
      }/>
      <TouchableOpacity style={styles.newButton} onPress={()=>navigation.navigate('EncomendaForm')}>
        <Ionicons name="add" size={19} color="#fff"/><Text style={styles.newButtonText}>Nova chegada</Text>
      </TouchableOpacity>
      {loading?<LoadingCards/>:<FlatList data={exibidos} keyExtractor={i=>i.id} onRefresh={carregar} refreshing={loading} contentContainerStyle={{paddingBottom:120}} ListEmptyComponent={<EmptyState icon="cube-outline" title="Nada por aqui" text="Nenhuma encomenda corresponde a este filtro."/>} renderItem={({item})=>(
        <TouchableOpacity style={styles.card} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})}>
          <View style={styles.top}>
            <View style={{flex:1}}><Text style={styles.name}>{item.moradorNome}</Text><Text style={styles.meta}>Bloco {item.bloco} · Ap. {item.apartamento}</Text></View>
            <View style={[styles.badge,item.status==='retirada'?styles.done:styles.pending]}><Text style={item.status==='retirada'?styles.doneText:styles.pendingText}>{item.status==='retirada'?'Retirada':'Pendente'}</Text></View>
          </View>
          <View style={styles.bottom}><Text style={styles.code}>{item.codigoReferencia?'#'+item.codigoReferencia:''}</Text><Text style={styles.date}>{item.recebidaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text></View>
        </TouchableOpacity>
      )}/>}
    </View>
  );
}
const styles=StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},
  eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},
  title:{fontSize:34,fontWeight:'700',marginTop:3,marginBottom:13},
  search:{height:50,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',paddingHorizontal:15},
  searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent',paddingHorizontal:10},
  filters:{gap:7,paddingVertical:11},
  filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  filterActive:{backgroundColor:colors.porter,borderColor:colors.porter},
  filterText:{fontSize:14,color:colors.text},filterTextActive:{color:'#fff',fontWeight:'700'},
  newButton:{alignSelf:'flex-start',backgroundColor:colors.porter,height:43,paddingHorizontal:16,borderRadius:radius.pill,flexDirection:'row',alignItems:'center',gap:6,marginBottom:12},
  newButtonText:{color:'#fff',fontWeight:'700'},
  card:{backgroundColor:colors.surface,padding:16,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:10},
  top:{flexDirection:'row',alignItems:'center',gap:8},
  name:{fontSize:19,fontWeight:'700'},meta:{fontSize:14,color:colors.muted,marginTop:2},
  badge:{paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},pending:{backgroundColor:'#F8EBDD'},done:{backgroundColor:'#E5F0E8'},
  pendingText:{fontSize:12,fontWeight:'700',color:colors.warning},doneText:{fontSize:12,fontWeight:'700',color:colors.success},
  bottom:{flexDirection:'row',justifyContent:'space-between',marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:colors.border},
  code:{fontSize:12,color:colors.muted,fontWeight:'700'},date:{fontSize:12,color:colors.muted},
});
