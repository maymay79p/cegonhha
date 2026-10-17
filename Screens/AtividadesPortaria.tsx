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

function segundos(valor:any){
  return valor?.seconds || Math.floor((valor?.toDate?.()?.getTime?.() || 0)/1000);
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
  const [auditoria,setAuditoria]=useState<any[]>([]);
  const [moderacao,setModeracao]=useState<any[]>([]);
  const [auditoriaPronta,setAuditoriaPronta]=useState(false);
  const [moderacaoPronta,setModeracaoPronta]=useState(false);
  const [filtro,setFiltro]=useState<Filtro>('todas');

  useEffect(()=>{
    if(perfil?.tipo!=='porteiro'||!perfil.condominioId){setAuditoria([]);setModeracao([]);setAuditoriaPronta(true);setModeracaoPronta(true);return;}
    setAuditoriaPronta(false);
    setModeracaoPronta(false);

    const qAuditoria=query(collection(db,'auditoria'),where('condominioId','==',perfil.condominioId));
    const unsubAuditoria=onSnapshot(qAuditoria,snap=>{
      setAuditoria(snap.docs.map(d=>({id:d.id,...d.data()})) as any[]);
      setAuditoriaPronta(true);
    },(e:any)=>{
      setAuditoriaPronta(true);
      Alert.alert('Atividades',String(e?.code||'').includes('permission-denied')?'O Firestore bloqueou a leitura do histórico de auditoria.':'Não foi possível carregar as atividades da Portaria.');
    });

    const qBanidos=query(collection(db,'muralBanidos'),where('condominioId','==',perfil.condominioId));
    const unsubBanidos=onSnapshot(qBanidos,snap=>{
      const eventos:any[]=[];
      snap.docs.forEach(d=>{
        const item=d.data();
        if(item.banidoEm){
          eventos.push({
            id:`${d.id}_ban`,
            condominioId:item.condominioId,
            atorId:item.banidoPorId||'',
            atorNome:item.banidoPorNome||'Portaria',
            alvoNome:item.usuarioNome||'Usuário',
            acao:'mural_banimento',
            detalhe:'Publicação bloqueada para este perfil no mural',
            criadoEm:item.banidoEm,
          });
        }else if(item.ativo===true&&item.atualizadoEm){
          eventos.push({
            id:`${d.id}_ban_legacy`,
            condominioId:item.condominioId,
            atorId:item.banidoPorId||'',
            atorNome:item.banidoPorNome||'Portaria',
            alvoNome:item.usuarioNome||'Usuário',
            acao:'mural_banimento',
            detalhe:'Perfil atualmente banido do mural',
            criadoEm:item.atualizadoEm,
          });
        }
        if(item.desbanidoEm){
          eventos.push({
            id:`${d.id}_unban`,
            condominioId:item.condominioId,
            atorId:item.desbanidoPorId||'',
            atorNome:item.desbanidoPorNome||'Portaria',
            alvoNome:item.usuarioNome||'Usuário',
            acao:'mural_desbanimento',
            detalhe:'Permissão para publicar no mural restaurada',
            criadoEm:item.desbanidoEm,
          });
        }
      });
      setModeracao(eventos);
      setModeracaoPronta(true);
    },()=>{
      setModeracao([]);
      setModeracaoPronta(true);
    });

    return()=>{unsubAuditoria();unsubBanidos();};
  },[perfil?.tipo,perfil?.condominioId]);

  const itens=useMemo(()=>[...auditoria,...moderacao].sort((a,b)=>segundos(b.criadoEm)-segundos(a.criadoEm)),[auditoria,moderacao]);
  const exibidos=useMemo(()=>filtro==='todas'?itens:itens.filter(i=>grupo(String(i.acao||''))===filtro),[itens,filtro]);
  const loading=!auditoriaPronta||!moderacaoPronta;
  if(perfil?.tipo!=='porteiro')return null;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><View style={{flex:1}}><Text style={styles.eyebrow}>AUDITORIA</Text><Text style={styles.title}>Atividades da Portaria</Text><Text style={styles.subtitle}>Registro cronológico de chegadas, retiradas, vínculos e moderação do condomínio.</Text></View></View>
      <View style={styles.tabsShell}><FlatList horizontal showsHorizontalScrollIndicator={false} data={([['todas','Todas'],['encomendas','Encomendas'],['condominio','Condomínio'],['comunidade','Comunidade']] as const)} keyExtractor={i=>i[0]} contentContainerStyle={styles.filters} renderItem={({item})=>{const ativo=filtro===item[0];return <TouchableOpacity style={[styles.filter,ativo&&styles.filterActive]} onPress={()=>setFiltro(item[0])}><Text style={[styles.filterText,ativo&&styles.filterTextActive]}>{item[1]}</Text></TouchableOpacity>;}}/></View>
      {loading?<LoadingCards count={4}/>:<FlatList data={exibidos} keyExtractor={i=>i.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="receipt-outline" title="Sem atividades" text="As principais ações realizadas pela Portaria aparecerão aqui."/>} renderItem={({item})=><TouchableOpacity style={styles.card} onPress={()=>item.encomendaId&&navigation.navigate('Detalhes',{encomenda:{id:item.encomendaId,condominioId:item.condominioId}})} disabled={!item.encomendaId}>
        <View style={styles.icon}><Ionicons name={icone(String(item.acao||'')) as any} size={21} color={item.acao==='mural_banimento'?colors.danger:item.acao==='mural_desbanimento'?colors.success:colors.porter}/></View>
        <View style={{flex:1}}><Text style={styles.text}>{descricao(item)}</Text>{!!item.detalhe&&<Text style={styles.detail}>{item.detalhe}</Text>}<Text style={styles.date}>{item.criadoEm?.toDate?.().toLocaleString('pt-BR')||'Data indisponível'}</Text>{!!item.encomendaId&&<Text style={styles.hint}>Toque para abrir a encomenda</Text>}</View>
      </TouchableOpacity>}/>} 
    </View>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{flex:1,paddingHorizontal:20,paddingTop:22,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'flex-start',gap:12},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:33,fontWeight:'700',marginTop:1},subtitle:{fontSize:14,lineHeight:19,color:colors.muted,marginTop:2},tabsShell:{marginVertical:13,borderBottomWidth:1,borderBottomColor:colors.border},filters:{gap:3},filter:{minHeight:39,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:3,borderBottomColor:'transparent'},filterActive:{borderBottomColor:colors.porter,backgroundColor:colors.porterSoft},filterText:{fontSize:13,fontWeight:'700',color:colors.muted},filterTextActive:{color:colors.porter},list:{paddingBottom:80,flexGrow:1},card:{backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:14,marginBottom:9,flexDirection:'row',gap:11},icon:{width:42,height:42,borderRadius:21,backgroundColor:colors.porterSoft,alignItems:'center',justifyContent:'center'},text:{fontSize:16,fontWeight:'700',lineHeight:21},detail:{fontSize:13,color:colors.muted,marginTop:3},date:{fontSize:12,color:colors.muted,marginTop:5},hint:{fontSize:11,fontWeight:'700',color:colors.porter,marginTop:4}
});}
