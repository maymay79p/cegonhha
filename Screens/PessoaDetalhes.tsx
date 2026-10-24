import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

export default function PessoaDetalhes({route,navigation}:any){
  const {perfil}=useAuth();
  const {colors}=useTheme();
  const styles=useMemo(()=>makeStyles(colors),[colors]);
  // O parâmetro de rota vem do diretório mínimo e nunca deve carregar CPF,
  // telefone ou e-mail. A Portaria busca o perfil privado diretamente, sujeito
  // às regras do Firestore, somente ao abrir esta tela.
  const pessoa=route.params?.pessoa||{};
  const [dadosPrivados,setDadosPrivados]=useState<any>(null);
  const [encomendas,setEncomendas]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(perfil?.tipo!=='porteiro'||!perfil.condominioId||!pessoa.id){
      setDadosPrivados(null);return;
    }
    return onSnapshot(doc(db,'usuarios',pessoa.id),snap=>{
      if(!snap.exists()){setDadosPrivados(null);return;}
      const dados={id:snap.id,...snap.data()} as any;
      setDadosPrivados(dados.condominioId===perfil.condominioId?dados:null);
    },()=>setDadosPrivados(null));
  },[perfil?.tipo,perfil?.condominioId,pessoa.id]);

  useEffect(()=>{
    if(perfil?.tipo!=='porteiro'||!perfil.condominioId||pessoa.tipo!=='morador'){
      setEncomendas([]);setLoading(false);return;
    }
    setLoading(true);
    const q=query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId));
    return onSnapshot(q,snap=>{
      const lista=(snap.docs.map(d=>({id:d.id,...d.data()})) as any[])
        .filter(e=>e.moradorId===pessoa.id)
        .sort((a,b)=>(b.recebidaEm?.seconds||0)-(a.recebidaEm?.seconds||0));
      setEncomendas(lista);
      setLoading(false);
    },()=>setLoading(false));
  },[perfil?.tipo,perfil?.condominioId,pessoa.id,pessoa.tipo]);

  if(perfil?.tipo!=='porteiro')return null;
  const pendentes=encomendas.filter(e=>e.status==='pendente').length;
  const retiradas=encomendas.filter(e=>e.status==='retirada').length;
  const inicial=String(pessoa.nome||'P').trim().charAt(0).toUpperCase();

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><View style={{flex:1}}><Text style={styles.eyebrow}>PESSOAS</Text><Text style={styles.title}>Detalhes do perfil</Text></View></View>

      <View style={styles.identity}>
        <View style={[styles.avatar,{backgroundColor:pessoa.tipo==='porteiro'?colors.porterSoft:colors.accentSoft}]}><Text style={[styles.avatarText,{color:pessoa.tipo==='porteiro'?colors.porter:colors.accent}]}>{inicial}</Text></View>
        <View style={{flex:1}}><Text style={styles.name}>{pessoa.nome||'Usuário'}</Text><Text style={styles.role}>{pessoa.tipo==='porteiro'?'Portaria':'Morador'}</Text>{pessoa.tipo==='morador'&&<Text style={styles.meta}>Bloco {pessoa.bloco||'—'} · Ap. {pessoa.apartamento||'—'}</Text>}</View>
        <View style={styles.linked}><View style={styles.dot}/><Text style={styles.linkedText}>Vinculado</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>DADOS ESSENCIAIS</Text>
        <View style={styles.infoRow}><Ionicons name="mail-outline" size={18} color={colors.muted}/><View><Text style={styles.infoLabel}>E-mail</Text><Text style={styles.infoValue}>{dadosPrivados?.email||'Não informado'}</Text></View></View>
        {!!dadosPrivados?.telefone&&<View style={styles.infoRow}><Ionicons name="call-outline" size={18} color={colors.muted}/><View><Text style={styles.infoLabel}>Telefone</Text><Text style={styles.infoValue}>{dadosPrivados.telefone}</Text></View></View>}
        {pessoa.tipo==='morador'&&<View style={styles.infoRow}><Ionicons name="home-outline" size={18} color={colors.muted}/><View><Text style={styles.infoLabel}>Unidade</Text><Text style={styles.infoValue}>Bloco {pessoa.bloco||'—'} · Apartamento {pessoa.apartamento||'—'}</Text></View></View>}
        <Text style={styles.privacy}>Os dados pessoais são carregados somente para a Portaria autorizada do mesmo condomínio. CPF não é exibido nesta tela.</Text>
      </View>

      {pessoa.tipo==='morador'&&<>
        <View style={styles.stats}><View style={styles.stat}><Text style={styles.statNumber}>{pendentes}</Text><Text style={styles.statLabel}>Pendentes</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{retiradas}</Text><Text style={styles.statLabel}>Retiradas</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{encomendas.length}</Text><Text style={styles.statLabel}>Total</Text></View></View>
        <Text style={styles.section}>Histórico de encomendas</Text>
        {loading?<LoadingCards count={3}/>:<FlatList data={encomendas} keyExtractor={e=>e.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="cube-outline" title="Sem encomendas" text="Este morador ainda não possui encomendas registradas."/>} renderItem={({item})=><TouchableOpacity style={styles.packageCard} onPress={()=>navigation.navigate('Detalhes',{encomenda:item})}>
          <View style={{flex:1}}><Text style={styles.packageTitle}>{item.descricao||'Encomenda'}</Text><Text style={styles.packageMeta}>{item.codigoReferencia?`#${item.codigoReferencia} · `:''}{item.recebidaEm?.toDate?.().toLocaleString('pt-BR')||''}</Text></View><View style={[styles.status,item.status==='retirada'?styles.done:styles.pending]}><Text style={item.status==='retirada'?styles.doneText:styles.pendingText}>{item.status==='retirada'?'Retirada':'Pendente'}</Text></View>
        </TouchableOpacity>}/>} 
      </>}
    </View>
  </SafeAreaView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},container:{flex:1,paddingHorizontal:20,paddingTop:22,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:15},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:31,fontWeight:'700'},identity:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,padding:15,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:54,height:54,borderRadius:27,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:23,fontWeight:'700'},name:{fontSize:21,fontWeight:'700'},role:{fontSize:13,fontWeight:'700',color:colors.porter,marginTop:1},meta:{fontSize:13,color:colors.muted,marginTop:2},linked:{flexDirection:'row',alignItems:'center',gap:5},dot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},linkedText:{fontSize:11,fontWeight:'700',color:colors.success},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,padding:16,marginTop:11},cardLabel:{fontSize:11,fontWeight:'700',letterSpacing:1.4,color:colors.muted,marginBottom:4},infoRow:{flexDirection:'row',gap:10,alignItems:'center',paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.border},infoLabel:{fontSize:11,color:colors.muted},infoValue:{fontSize:15,fontWeight:'600',marginTop:1},privacy:{fontSize:12,lineHeight:17,color:colors.muted,marginTop:10},stats:{flexDirection:'row',gap:8,marginTop:11},stat:{flex:1,backgroundColor:colors.porterSoft,borderRadius:radius.medium,padding:11,alignItems:'center'},statNumber:{fontSize:24,fontWeight:'700',color:colors.porter},statLabel:{fontSize:11,color:colors.muted},section:{fontSize:22,fontWeight:'700',marginTop:18,marginBottom:9},list:{paddingBottom:80,flexGrow:1},packageCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:13,marginBottom:8,flexDirection:'row',alignItems:'center',gap:8},packageTitle:{fontSize:16,fontWeight:'700'},packageMeta:{fontSize:12,color:colors.muted,marginTop:3},status:{paddingHorizontal:9,paddingVertical:5,borderRadius:radius.pill},pending:{backgroundColor:colors.surfaceSoft},done:{backgroundColor:colors.surfaceSoft},pendingText:{fontSize:11,fontWeight:'700',color:colors.warning},doneText:{fontSize:11,fontWeight:'700',color:colors.success}
});}
