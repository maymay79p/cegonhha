import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { arrayUnion, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

type Filtro='todas'|'nao_lidas'|'encomendas'|'condominio'|'comunidade';

function categoria(tipo:string){
  if(['chegada','retirada','retirada_solicitada','contestacao_encomenda','lembrete','previsao'].includes(tipo))return 'encomendas';
  if(['vinculo','solicitacao_vinculo'].includes(tipo))return 'condominio';
  if(['denuncia','mural','resposta_mural'].includes(tipo))return 'comunidade';
  return 'condominio';
}

export default function Notificacoes({navigation}:any){
  const {user,perfil}=useAuth();
  const {colors}=useTheme();
  const ehPortaria=perfil?.tipo==='porteiro';
  const styles=useMemo(()=>makeStyles(colors,ehPortaria),[colors,ehPortaria]);
  const [itens,setItens]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filtro,setFiltro]=useState<Filtro>('todas');

  useEffect(()=>{
    if(!user||!perfil){setItens([]);setLoading(false);return;}
    if(ehPortaria&&!perfil.condominioId){setItens([]);setLoading(false);return;}
    setLoading(true);
    const q=ehPortaria
      ? query(collection(db,'notificacoes'),where('condominioId','==',perfil.condominioId),where('destinatarioTipo','==','porteiro'))
      : query(collection(db,'notificacoes'),where('moradorId','==',user.uid));
    const unsubscribe=onSnapshot(q,snap=>{
      const dados=(snap.docs.map(x=>({id:x.id,...x.data()})) as any[])
        .filter(item=>!item.destinatarioId||item.destinatarioId===user.uid);
      dados.sort((a,b)=>(b.criadaEm?.seconds||0)-(a.criadaEm?.seconds||0));
      setItens(dados);
      setLoading(false);
    },(e:any)=>{
      setLoading(false);
      const codigo=String(e?.code||'');
      Alert.alert('Notificações',codigo.includes('permission-denied')?'O Firestore bloqueou a leitura. Publique as regras mais recentes do Cegonha.':'Não foi possível carregar os avisos.');
    });
    return unsubscribe;
  },[user?.uid,perfil?.tipo,perfil?.condominioId,ehPortaria]);

  function estaLida(item:any){
    if(ehPortaria)return Array.isArray(item.lidaPor)&&!!user?.uid&&item.lidaPor.includes(user.uid);
    return item.lida===true;
  }

  async function marcarLida(item:any){
    if(!user||estaLida(item))return;
    if(ehPortaria)await updateDoc(doc(db,'notificacoes',item.id),{lidaPor:arrayUnion(user.uid)});
    else await updateDoc(doc(db,'notificacoes',item.id),{lida:true});
  }

  async function abrirAviso(item:any){
    try{
      if(!estaLida(item))await marcarLida(item);
      if(item.encomendaId){
        const snap=await getDoc(doc(db,'encomendas',String(item.encomendaId)));
        if(snap.exists()){
          navigation.navigate('Detalhes',{encomenda:{id:snap.id,...snap.data()}});
          return;
        }
      }
      if(item.tipo==='solicitacao_vinculo'&&ehPortaria){navigation.navigate('SolicitacoesCondominio');return;}
      if(item.tipo==='vinculo'&&!ehPortaria){navigation.navigate('Perfil');return;}
      if(item.tipo==='denuncia'){navigation.navigate('Denuncias');return;}
      if(item.tipo==='previsao'&&!ehPortaria){navigation.navigate('Previsoes');return;}
      if(item.tipo==='previsao'&&ehPortaria){navigation.navigate('Home',{screen:'Painel'});return;}
      if(item.tipo==='mural'||item.tipo==='resposta_mural'){navigation.navigate('Mural');return;}
    }catch(e:any){
      const codigo=String(e?.code||'');
      Alert.alert('Notificações',codigo.includes('permission-denied')?'O Firestore bloqueou esta ação. Publique as regras mais recentes do Cegonha.':e?.message||'Não foi possível abrir este aviso.');
    }
  }

  async function marcarTodas(){
    if(!user)return;
    const pendentes=itens.filter(i=>!estaLida(i));
    if(!pendentes.length)return;
    try{
      await Promise.all(pendentes.map(item=>ehPortaria
        ? updateDoc(doc(db,'notificacoes',item.id),{lidaPor:arrayUnion(user.uid)})
        : updateDoc(doc(db,'notificacoes',item.id),{lida:true})
      ));
    }catch(e:any){Alert.alert('Notificações',e?.message||'Não foi possível marcar todos os avisos como lidos.');}
  }

  const naoLidas=itens.filter(i=>!estaLida(i)).length;
  const exibidos=useMemo(()=>itens.filter(i=>{
    if(filtro==='nao_lidas')return !estaLida(i);
    if(filtro==='todas')return true;
    return categoria(String(i.tipo||''))===filtro;
  }),[itens,filtro,ehPortaria,user?.uid]);

  function icon(tipo:string){
    if(tipo==='chegada')return'cube-outline';
    if(tipo==='retirada')return'checkmark-circle-outline';
    if(tipo==='retirada_solicitada')return'hand-right-outline';
    if(tipo==='contestacao_encomenda')return'alert-circle-outline';
    if(tipo==='lembrete')return'time-outline';
    if(tipo==='vinculo'||tipo==='solicitacao_vinculo')return'people-outline';
    if(tipo==='previsao')return'time-outline';
    if(tipo==='denuncia')return'flag-outline';
    if(tipo==='resposta_mural')return'chatbubble-ellipses-outline';
    return'notifications-outline';
  }

  function dica(item:any){
    if(item.encomendaId)return 'Toque para abrir a encomenda';
    if(item.tipo==='solicitacao_vinculo')return 'Toque para revisar a solicitação';
    if(item.tipo==='vinculo')return 'Toque para abrir o Perfil';
    if(item.tipo==='denuncia')return 'Toque para abrir as denúncias';
    if(item.tipo==='resposta_mural')return 'Toque para abrir a resposta no mural';
    return '';
  }

  const vazio=ehPortaria
    ? 'Solicitações de retirada, contestações, vínculos, respostas do mural, entregas previstas e denúncias aparecerão aqui.'
    : 'Chegadas, retiradas, lembretes, respostas do mural e decisões da portaria aparecerão aqui automaticamente.';
  const destaque=ehPortaria?colors.porter:colors.accent;
  const filtros:[Filtro,string][]=[['todas','Todas'],['nao_lidas',`Não lidas · ${naoLidas}`],['encomendas','Encomendas'],['condominio','Condomínio'],['comunidade','Comunidade']];

  return <View style={styles.container}>
    <View style={styles.top}><View style={{flex:1}}><Text style={styles.eyebrow}>CENTRAL</Text><Text style={styles.title}>Notificações</Text><Text style={styles.subtitle}>{ehPortaria?'Avisos do condomínio para a portaria':'Atualizações da portaria e da comunidade para você'}</Text></View>{naoLidas>0&&<TouchableOpacity onPress={marcarTodas}><Text style={styles.markAll}>Marcar todas</Text></TouchableOpacity>}</View>
    <View style={styles.tabsShell}><FlatList horizontal showsHorizontalScrollIndicator={false} data={filtros} keyExtractor={i=>i[0]} contentContainerStyle={styles.filters} renderItem={({item})=>{const ativo=filtro===item[0];return <TouchableOpacity style={[styles.filter,ativo&&styles.filterActive]} onPress={()=>setFiltro(item[0])} accessibilityRole="tab" accessibilityState={{selected:ativo}}><Text style={[styles.filterText,ativo&&styles.filterTextActive]}>{item[1]}</Text></TouchableOpacity>;}}/></View>
    {loading?<LoadingCards/>:<FlatList data={exibidos} keyExtractor={item=>item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Sem avisos" text={vazio}/>} renderItem={({item})=>{
      const lida=estaLida(item);const hint=dica(item);
      return <TouchableOpacity style={[styles.card,!lida&&styles.unread]} onPress={()=>abrirAviso(item)}>
        <View style={[styles.icon,!lida&&styles.iconUnread]}><Ionicons name={icon(item.tipo) as any} size={21} color={!lida?destaque:colors.muted}/></View>
        <View style={{flex:1}}><View style={styles.cardTop}><Text style={styles.category}>{categoria(String(item.tipo||''))==='encomendas'?'ENCOMENDAS':categoria(String(item.tipo||''))==='comunidade'?'COMUNIDADE':'CONDOMÍNIO'}</Text>{!lida&&<Text style={styles.newTag}>NOVO</Text>}</View><Text style={styles.message}>{item.mensagem}</Text>{!!item.remetenteNome&&<Text style={styles.sender}>Enviado por {item.remetenteNome}</Text>}<Text style={styles.date}>{item.criadaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text>{!!hint&&<Text style={styles.hint}>{hint}</Text>}</View>
      </TouchableOpacity>;
    }}/>} 
  </View>;
}

function makeStyles(colors:ThemeColors,ehPortaria:boolean){const destaque=ehPortaria?colors.porter:colors.accent;const soft=ehPortaria?colors.porterSoft:colors.accentSoft;return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:100,backgroundColor:colors.background},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',gap:12},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:destaque},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:13,color:colors.muted,marginTop:2},markAll:{fontSize:14,fontWeight:'700',marginBottom:5,color:destaque},tabsShell:{marginVertical:13,borderBottomWidth:1,borderBottomColor:colors.border},filters:{gap:3,paddingHorizontal:1},filter:{minHeight:39,paddingHorizontal:11,paddingVertical:8,borderBottomWidth:3,borderBottomColor:'transparent'},filterActive:{borderBottomColor:destaque,backgroundColor:soft},filterText:{fontSize:13,color:colors.muted},filterTextActive:{color:destaque,fontWeight:'700'},list:{paddingBottom:120,flexGrow:1},card:{flexDirection:'row',gap:12,backgroundColor:colors.surface,padding:15,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:9},unread:{borderColor:destaque,backgroundColor:soft},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},iconUnread:{backgroundColor:colors.surface},cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},category:{fontSize:10,fontWeight:'700',letterSpacing:1,color:destaque},newTag:{fontSize:10,fontWeight:'700',color:destaque},message:{fontSize:16,lineHeight:21,marginTop:3},sender:{fontSize:12,color:colors.muted,marginTop:5,fontWeight:'600'},date:{fontSize:12,color:colors.muted,marginTop:4},hint:{fontSize:12,fontWeight:'700',marginTop:4,color:destaque}
});}
