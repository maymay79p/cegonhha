import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { correspondeBusca, montarTextoBuscaPessoa } from '../utils/busca';
import { radius, ThemeColors } from '../theme';

type Filtro = 'todos' | 'morador' | 'porteiro';

export default function PessoasCondominio({ navigation }: any) {
  const { user, perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pessoas, setPessoas] = useState<any[]>([]);
  const [pendenciasPorMorador,setPendenciasPorMorador]=useState<Record<string,number>>({});
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [loading, setLoading] = useState(true);
  const ehPortaria=perfil?.tipo==='porteiro';

  useEffect(() => {
    if (!perfil?.condominioId) {
      setPessoas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'usuarios'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      lista.sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo === 'porteiro' ? -1 : 1;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      });
      setPessoas(lista.filter(item => item.tipo === 'morador' || item.tipo === 'porteiro'));
      setLoading(false);
    }, (e: any) => {
      setLoading(false);
      const codigo = String(e?.code || '');
      Alert.alert('Pessoas do condomínio',codigo.includes('permission-denied')?'O Firestore bloqueou a lista de usuários. Publique as regras mais recentes do Cegonha.':'Não foi possível carregar as pessoas vinculadas ao condomínio.');
    });
  }, [perfil?.condominioId]);

  useEffect(()=>{
    if(!ehPortaria||!perfil?.condominioId){setPendenciasPorMorador({});return;}
    const q=query(collection(db,'encomendas'),where('condominioId','==',perfil.condominioId));
    return onSnapshot(q,snap=>{
      const mapa:Record<string,number>={};
      snap.docs.forEach(d=>{const e=d.data();if(e.status==='pendente'&&e.moradorId)mapa[e.moradorId]=(mapa[e.moradorId]||0)+1;});
      setPendenciasPorMorador(mapa);
    },()=>setPendenciasPorMorador({}));
  },[ehPortaria,perfil?.condominioId]);

  const moradores = pessoas.filter(p => p.tipo === 'morador').length;
  const portaria = pessoas.filter(p => p.tipo === 'porteiro').length;

  const exibidas = useMemo(() => {
    return pessoas.filter(item => {
      if (filtro !== 'todos' && item.tipo !== filtro) return false;
      return correspondeBusca(montarTextoBuscaPessoa(item), busca);
    });
  }, [pessoas, busca, filtro]);

  const corDestaque = ehPortaria ? colors.porter : colors.accent;

  if (!perfil?.condominioId) {
    return <SafeAreaView style={styles.safe}><View style={styles.container}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><EmptyState icon="people-outline" title="Sem condomínio" text="Vincule sua conta a um condomínio para visualizar as pessoas participantes." /></View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={[styles.eyebrow,{color:corDestaque}]}>CONDOMÍNIO</Text><Text style={styles.title}>Pessoas</Text><Text style={styles.subtitle}>{ehPortaria?'Consulte os perfis vinculados ao condomínio.':'Contas atualmente vinculadas ao seu condomínio.'}</Text></View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{moradores}</Text><Text style={styles.statLabel}>Moradores</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{portaria}</Text><Text style={styles.statLabel}>Portaria</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{pessoas.length}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>

      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Nome, bloco ou apartamento" value={busca} onChangeText={setBusca}/>{!!busca&&<TouchableOpacity onPress={()=>setBusca('')} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>

      <View style={styles.tabsShell}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{([['todos','Todos'],['morador','Moradores'],['porteiro','Portaria']] as const).map(([valor,label]) => {const ativo=filtro===valor;return <TouchableOpacity key={valor} accessibilityRole="tab" accessibilityState={{selected:ativo}} style={[styles.filter,ativo&&styles.filterActive,{borderBottomColor:ativo?corDestaque:'transparent',backgroundColor:ativo?(ehPortaria?colors.porterSoft:colors.accentSoft):'transparent'}]} onPress={()=>setFiltro(valor)}><Text style={[styles.filterText,ativo&&{color:corDestaque,fontWeight:'700'}]}>{label}</Text></TouchableOpacity>;})}</ScrollView></View>

      {loading ? <LoadingCards count={4}/> : <FlatList
        data={exibidas}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhuma pessoa encontrada" text="Tente buscar por nome, bloco ou apartamento, ou altere a aba de perfil."/>}
        renderItem={({ item }) => {
          const morador = item.tipo === 'morador';
          const inicial = String(item.nome || (morador ? 'M' : 'P')).trim().charAt(0).toUpperCase();
          const souEu = item.id === user?.uid;
          const pendencias=pendenciasPorMorador[item.id]||0;
          const clicavel=ehPortaria&&!souEu;
          return <TouchableOpacity style={styles.card} onPress={()=>clicavel&&navigation.navigate('PessoaDetalhes',{pessoa:item})} disabled={!clicavel} accessibilityLabel={`${item.nome || (morador ? 'Morador' : 'Portaria')}${morador ? `, bloco ${item.bloco || 'não informado'}, apartamento ${item.apartamento || 'não informado'}` : ', portaria'}`}>
            <View style={[styles.avatar,{backgroundColor:morador?colors.accentSoft:colors.porterSoft}]}><Text style={[styles.avatarText,{color:morador?colors.accent:colors.porter}]}>{inicial}</Text></View>
            <View style={styles.personBody}>
              <View style={styles.nameRow}><Text style={styles.name}>{item.nome || (morador ? 'Morador' : 'Portaria')}</Text>{souEu&&<View style={styles.youBadge}><Text style={styles.youText}>Você</Text></View>}</View>
              <Text style={styles.role}>{morador ? 'Morador' : 'Portaria'}</Text>
              {morador && <Text style={styles.address}>Bloco {item.bloco || '—'} · Ap. {item.apartamento || '—'}</Text>}
              {ehPortaria&&morador&&<Text style={[styles.pendingInfo,pendencias>0&&{color:colors.warning}]}>{pendencias>0?`${pendencias} encomenda${pendencias>1?'s':''} aguardando retirada`:'Sem encomendas pendentes'}</Text>}
            </View>
            {clicavel?<Ionicons name="chevron-forward" size={19} color={colors.muted}/>:<View style={styles.activeBadge}><View style={styles.activeDot}/><Text style={styles.activeText}>Vinculado</Text></View>}
          </TouchableOpacity>;
        }}
      />}
    </View>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:{flex:1,backgroundColor:colors.background},container:{flex:1,paddingHorizontal:20,paddingTop:22,backgroundColor:colors.background},header:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7},title:{fontSize:34,fontWeight:'700',color:colors.text,marginTop:1},subtitle:{fontSize:14,color:colors.muted,marginTop:2,lineHeight:19},stats:{flexDirection:'row',gap:8,marginBottom:12},stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,paddingVertical:12,paddingHorizontal:8,alignItems:'center'},statNumber:{fontSize:25,fontWeight:'700'},statLabel:{fontSize:12,color:colors.muted,marginTop:1},searchBox:{minHeight:50,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:13},searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent',paddingHorizontal:0,paddingVertical:0},tabsShell:{marginTop:10,borderBottomWidth:1,borderBottomColor:colors.border},filters:{gap:3},filter:{minHeight:39,paddingHorizontal:12,paddingVertical:8,borderBottomWidth:3},filterText:{fontSize:13,color:colors.muted},filterActive:{},list:{paddingBottom:110,flexGrow:1,paddingTop:7},card:{minHeight:76,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:13,marginBottom:8,flexDirection:'row',alignItems:'center',gap:11},avatar:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:20,fontWeight:'700'},personBody:{flex:1},nameRow:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},name:{fontSize:17,fontWeight:'700',color:colors.text},role:{fontSize:13,fontWeight:'600',color:colors.muted,marginTop:1},address:{fontSize:13,color:colors.muted,marginTop:2},pendingInfo:{fontSize:11,fontWeight:'700',color:colors.success,marginTop:3},youBadge:{paddingHorizontal:7,paddingVertical:2,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft},youText:{fontSize:11,fontWeight:'700',color:colors.muted},activeBadge:{flexDirection:'row',alignItems:'center',gap:5},activeDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},activeText:{fontSize:11,fontWeight:'700',color:colors.success},
  });
}
