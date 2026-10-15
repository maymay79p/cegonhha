import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { arrayUnion, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
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
  const ehPortaria=perfil?.tipo==='porteiro';

  useEffect(()=>{
    if(!user||!perfil){
      setItens([]);
      setLoading(false);
      return;
    }
    if(ehPortaria&&!perfil.condominioId){
      setItens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q=ehPortaria
      ? query(collection(db,'notificacoes'),where('condominioId','==',perfil.condominioId),where('destinatarioTipo','==','porteiro'))
      : query(collection(db,'notificacoes'),where('moradorId','==',user.uid));
    const unsubscribe=onSnapshot(q,snap=>{
      const dados=snap.docs.map(x=>({id:x.id,...x.data()})) as any[];
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
    try{
      if(ehPortaria)await updateDoc(doc(db,'notificacoes',item.id),{lidaPor:arrayUnion(user.uid)});
      else await updateDoc(doc(db,'notificacoes',item.id),{lida:true});
    }catch(e:any){
      const codigo=String(e?.code||'');
      Alert.alert('Notificações',codigo.includes('permission-denied')?'O Firestore bloqueou esta atualização. Publique as regras mais recentes do Cegonha.':e?.message||'Não foi possível marcar o aviso como lido.');
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
    }catch(e:any){
      Alert.alert('Notificações',e?.message||'Não foi possível marcar todos os avisos como lidos.');
    }
  }

  const exibidos=useMemo(()=>soNaoLidas?itens.filter(i=>!estaLida(i)):itens,[itens,soNaoLidas,ehPortaria,user?.uid]);
  const naoLidas=itens.filter(i=>!estaLida(i)).length;

  function icon(tipo:string){
    if(tipo==='chegada')return'cube-outline';
    if(tipo==='retirada')return'checkmark-circle-outline';
    if(tipo==='lembrete')return'time-outline';
    if(tipo==='vinculo'||tipo==='solicitacao_vinculo')return'people-outline';
    if(tipo==='previsao')return'time-outline';
    if(tipo==='denuncia')return'flag-outline';
    return'notifications-outline';
  }

  const vazio=ehPortaria
    ? 'Novas solicitações de vínculo, entregas previstas e denúncias da comunidade aparecerão aqui.'
    : 'Chegadas, retiradas, lembretes e decisões da portaria aparecerão aqui automaticamente.';

  return <View style={styles.container}>
    <View style={styles.top}><View><Text style={[styles.eyebrow,{color:ehPortaria?colors.porter:colors.accent}]}>CENTRAL</Text><Text style={styles.title}>Notificações</Text><Text style={styles.subtitle}>{ehPortaria?'Avisos do condomínio para a portaria':'Atualizações da portaria para você'}</Text></View>{naoLidas>0&&<TouchableOpacity onPress={marcarTodas}><Text style={[styles.markAll,{color:ehPortaria?colors.porter:colors.accent}]}>Marcar todas</Text></TouchableOpacity>}</View>
    <View style={styles.filters}>
      <TouchableOpacity style={[styles.filter,!soNaoLidas&&styles.active,ehPortaria&&!soNaoLidas&&{backgroundColor:colors.porter,borderColor:colors.porter}]} onPress={()=>setSoNaoLidas(false)}><Text style={[styles.filterText,!soNaoLidas&&styles.activeText]}>Todas</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.filter,soNaoLidas&&styles.active,ehPortaria&&soNaoLidas&&{backgroundColor:colors.porter,borderColor:colors.porter}]} onPress={()=>setSoNaoLidas(true)}><Text style={[styles.filterText,soNaoLidas&&styles.activeText]}>Não lidas · {naoLidas}</Text></TouchableOpacity>
    </View>
    {loading?<LoadingCards/>:<View>{!exibidos.length?<EmptyState icon="notifications-off-outline" title="Sem avisos" text={vazio}/>:exibidos.map(item=>{
      const lida=estaLida(item);
      const destaque=ehPortaria?colors.porter:colors.accent;
      return <TouchableOpacity key={item.id} style={[styles.card,!lida&&styles.unread,!lida&&ehPortaria&&{borderColor:colors.porter,backgroundColor:colors.porterSoft}]} onPress={()=>!lida&&marcarLida(item)}>
        <View style={[styles.icon,!lida&&styles.iconUnread]}><Ionicons name={icon(item.tipo) as any} size={21} color={!lida?destaque:colors.muted}/></View>
        <View style={{flex:1}}><Text style={styles.message}>{item.mensagem}</Text>{!!item.remetenteNome&&ehPortaria&&<Text style={styles.sender}>Enviado por {item.remetenteNome}</Text>}<Text style={styles.date}>{item.criadaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text>{!lida&&<Text style={[styles.hint,{color:destaque}]}>Novo</Text>}</View>
      </TouchableOpacity>;
    })}</View>}
  </View>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{flex:1,padding:20,paddingBottom:110,backgroundColor:colors.background},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',gap:12},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8},title:{fontSize:34,fontWeight:'700',marginTop:3},subtitle:{fontSize:13,color:colors.muted,marginTop:2},markAll:{fontSize:14,fontWeight:'700',marginBottom:5},filters:{flexDirection:'row',gap:7,marginVertical:13},filter:{paddingHorizontal:14,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},active:{backgroundColor:colors.accent,borderColor:colors.accent},filterText:{fontSize:14},activeText:{color:'#fff',fontWeight:'700'},card:{flexDirection:'row',gap:12,backgroundColor:colors.surface,padding:15,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:9},unread:{borderColor:colors.accent,backgroundColor:colors.accentSoft},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.surfaceSoft,alignItems:'center',justifyContent:'center'},iconUnread:{backgroundColor:colors.accentSoft},message:{fontSize:16,lineHeight:21},sender:{fontSize:12,color:colors.muted,marginTop:5,fontWeight:'600'},date:{fontSize:12,color:colors.muted,marginTop:4},hint:{fontSize:12,fontWeight:'700',marginTop:4}
});}
