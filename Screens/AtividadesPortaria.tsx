import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

type Filtro = 'todas' | 'encomendas' | 'condominio' | 'comunidade';

function grupo(acao:string):Filtro{
  if(acao.startsWith('mural_'))return 'comunidade';
  if(acao.startsWith('vinculo_'))return 'condominio';
  return 'encomendas';
}

function descricao(item:any){
  const nome=item.atorNome||'Portaria';
  const alvo=item.alvoNome||'';
  const mapa:Record<string,string>={
    chegada_registrada:`${nome} registrou uma nova encomenda${alvo?` para ${alvo}`:''}.`,
    retirada_registrada:`${nome} confirmou a retirada${alvo?` da encomenda de ${alvo}`:''}.`,
    lembrete_3_dias:`${nome} enviou um lembrete de retirada${alvo?` para ${alvo}`:''}.`,
    vinculo_aprovado:`${nome} aprovou a entrada${alvo?` de ${alvo}`:''} no condomínio.`,
    vinculo_rejeitado:`${nome} recusou a solicitação de entrada${alvo?` de ${alvo}`:''}.`,
    mural_banimento:`${nome} baniu ${alvo||'um usuário'} do mural do condomínio.`,
    mural_desbanimento:`${nome} desfez o banimento de ${alvo||'um usuário'} no mural.`,
  };
  return mapa[item.acao]||item.detalhe||`${nome} realizou uma ação na Portaria.`;
}

function icone(acao:string){
  if(acao==='chegada_registrada')return 'cube-outline';
  if(acao==='retirada_registrada')return 'checkmark-circle-outline';
  if(acao==='lembrete_3_dias')return 'time-outline';
  if(acao.startsWith('vinculo_'))return 'people-outline';
  if(acao==='mural_banimento')return 'ban-outline';
  if(acao==='mural_desbanimento')return 'person-add-outline';
  return 'receipt-outline';
}

export default function AtividadesPortaria({navigation}:any){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  const [itens,setItens]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filtro,setFiltro]=useState<Filtro>('todas');

  useEffect(()=>{
    if(perfil?.tipo!=='porteiro'||!perfil.condominioId){setItens([]);setLoading(false);return;}
    setLoading(true);
    const q=query(collection(db,'auditoria'),where('condominioId','==',perfil.condominioId));
    return onSnapshot(q,snap=>{
      const lista=snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.criadoEm?.seconds||0)-(a.criadoEm?.seconds||0));
      setItens(lista);
      setLoading(false);
    },(e:any)=>{
      setLoading(false);
      Alert.alert('Atividades',String(e?.code||'').includes('permission-denied')?'O Firestore bloqueou a leitura do histórico de auditoria.':'Não foi possível carregar as atividades da Portaria.');
    });
  },[perfil?.tipo,perfil?.condominioId]);

  const exibidos=useMemo(()=>filtro==='todas'?itens:itens.filter(i=>grupo(String(i.acao||''))===filtro),[itens,filtro]);
  if(perfil?.tipo!=='porteiro')return null;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><View style={{flex:1}}><Text style={styles.eyebrow}>AUDITORIA</Text><Text style={styles.title}>Atividades da Portaria</Text><Text style={styles.subtitle}>Registro cronológico das principais ações realizadas no condomínio.</Text></View></View>
      <View style={styles.filters}>{([['todas','Todas'],['encomendas','Encomendas'],['condominio','Condomínio'],['comunidade','Comunidade']] as const).map(([valor,label])=>{const ativo=filtro===valor;return <TouchableOpacity key={valor} style={[styles.filter,ativo&&styles.filterActive]} onPress={()=>setFiltro(valor)}><Text style={[styles.filterText,ativo&&styles.filterTextActive]}>{label}</Text></TouchableOpacity>;})}</View>
      {loading?<LoadingCards count={4}/>:<FlatList data={exibidos} keyExtractor={i=>i.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="receipt-outline" title="Sem atividades" text="As ações registradas pela Portaria aparecerão aqui."/>} renderItem={({item})=><TouchableOpacity style={styles.card} onPress={()=>item.encomendaId&&navigation.navigate('Detalhes',{encomenda:{id:item.encomendaId,condominioId:item.condominioId}})} disabled={!item.encomendaId}>
        <View style={styles.icon}><Ionicons name={icone(String(item.acao||'')) as any} size={21} color={colors.porter}/></View>
        <View style={{flex:1}}><Text style={styles.text}>{descricao(item)}</Text>{!!item.detalhe&&<Text style={styles.detail}>{item.detalhe}</Text>}<Text style={styles.date}>{item.criadoEm?.toDate?.().toLocaleString('pt-BR')||'Data indisponível'}</Text>{!!item.encomendaId&&<Text style={styles.hint}>Toque para abrir a encomenda</Text>}</View>
      </TouchableOpacity>}/>} 
    </View>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{flex:1,paddingHorizontal:20,paddingTop:22,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'flex-start',gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:33,fontWeight:'700',marginTop:1},subtitle:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:2},filters:{flexDirection:'row',flexWrap:'wrap',gap:7,marginVertical:13},filter:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},filterActive:{backgroundColor:colors.porter,borderColor:colors.porter},filterText:{fontSize:13,fontWeight:'700',color:colors.muted},filterTextActive:{color:'#fff'},list:{paddingBottom:80,flexGrow:1},card:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:14,marginBottom:9,flexDirection:'row',gap:11},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.porterSoft,alignItems:'center',justifyContent:'center'},text:{fontSize:16,fontWeight:'700',lineHeight:21},detail:{fontSize:13,color:colors.muted,marginTop:3},date:{fontSize:12,color:colors.muted,marginTop:5},hint:{fontSize:11,fontWeight:'700',color:colors.porter,marginTop:4}
});}
