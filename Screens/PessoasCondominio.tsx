import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { EmptyState, LoadingCards } from '../components/States';
import { radius, ThemeColors } from '../theme';

type Filtro = 'todos' | 'morador' | 'porteiro';

function normalizar(valor: unknown) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function PessoasCondominio({ navigation }: any) {
  const { user, perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pessoas, setPessoas] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [loading, setLoading] = useState(true);

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
        if (a.tipo !== b.tipo) return a.tipo === 'morador' ? -1 : 1;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      });
      setPessoas(lista.filter(item => item.tipo === 'morador' || item.tipo === 'porteiro'));
      setLoading(false);
    }, (e: any) => {
      setLoading(false);
      const codigo = String(e?.code || '');
      Alert.alert(
        'Pessoas do condomínio',
        codigo.includes('permission-denied')
          ? 'O Firestore bloqueou a lista de usuários. Publique as regras mais recentes do Cegonha.'
          : 'Não foi possível carregar as pessoas vinculadas ao condomínio.',
      );
    });
  }, [perfil?.condominioId]);

  const moradores = pessoas.filter(p => p.tipo === 'morador').length;
  const portaria = pessoas.filter(p => p.tipo === 'porteiro').length;

  const exibidas = useMemo(() => {
    const termo = normalizar(busca);
    return pessoas.filter(item => {
      if (filtro !== 'todos' && item.tipo !== filtro) return false;
      if (!termo) return true;
      const texto = normalizar([
        item.nome,
        item.tipo === 'morador' ? 'morador' : 'portaria',
        item.bloco,
        item.apartamento,
      ].join(' '));
      return texto.includes(termo);
    });
  }, [pessoas, busca, filtro]);

  const corDestaque = perfil?.tipo === 'porteiro' ? colors.porter : colors.accent;

  if (!perfil?.condominioId) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity>
        <EmptyState icon="people-outline" title="Sem condomínio" text="Vincule sua conta a um condomínio para visualizar as pessoas participantes." />
      </View>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={[styles.eyebrow,{color:corDestaque}]}>CONDOMÍNIO</Text><Text style={styles.title}>Pessoas</Text><Text style={styles.subtitle}>Contas atualmente vinculadas a {perfil.condominioNome || 'este condomínio'}.</Text></View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{moradores}</Text><Text style={styles.statLabel}>Moradores</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{portaria}</Text><Text style={styles.statLabel}>Portaria</Text></View>
        <View style={styles.stat}><Text style={[styles.statNumber,{color:corDestaque}]}>{pessoas.length}</Text><Text style={styles.statLabel}>Total</Text></View>
      </View>

      <View style={styles.searchBox}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Buscar por nome, bloco ou apartamento" value={busca} onChangeText={setBusca}/>{!!busca&&<TouchableOpacity onPress={()=>setBusca('')}><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>

      <View style={styles.filters}>
        {([['todos','Todos'],['morador','Moradores'],['porteiro','Portaria']] as const).map(([valor,label]) => {
          const ativo = filtro === valor;
          return <TouchableOpacity key={valor} style={[styles.filter,ativo&&{backgroundColor:corDestaque,borderColor:corDestaque}]} onPress={()=>setFiltro(valor)}><Text style={[styles.filterText,ativo&&styles.filterTextActive]}>{label}</Text></TouchableOpacity>;
        })}
      </View>

      {loading ? <LoadingCards count={4}/> : <FlatList
        data={exibidas}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhuma pessoa encontrada" text={busca ? 'Tente outro nome, bloco ou apartamento.' : 'Ainda não há contas vinculadas nesta categoria.'}/>} 
        renderItem={({ item }) => {
          const morador = item.tipo === 'morador';
          const inicial = String(item.nome || (morador ? 'M' : 'P')).trim().charAt(0).toUpperCase();
          const souEu = item.id === user?.uid;
          return <View style={styles.card}>
            <View style={[styles.avatar,{backgroundColor:morador?colors.accentSoft:colors.porterSoft}]}><Text style={[styles.avatarText,{color:morador?colors.accent:colors.porter}]}>{inicial}</Text></View>
            <View style={styles.personBody}>
              <View style={styles.nameRow}><Text style={styles.name}>{item.nome || (morador ? 'Morador' : 'Portaria')}</Text>{souEu&&<View style={styles.youBadge}><Text style={styles.youText}>Você</Text></View>}</View>
              <Text style={styles.role}>{morador ? 'Morador' : 'Portaria'}</Text>
              {morador && <Text style={styles.address}>Bloco {item.bloco || '—'} · Ap. {item.apartamento || '—'}</Text>}
            </View>
            <View style={styles.activeBadge}><View style={styles.activeDot}/><Text style={styles.activeText}>Vinculado</Text></View>
          </View>;
        }}
      />}
    </View>
  </SafeAreaView>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:{flex:1,backgroundColor:colors.background},
    container:{flex:1,paddingHorizontal:20,paddingTop:8,backgroundColor:colors.background},
    header:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},
    back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},
    eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7},
    title:{fontSize:34,fontWeight:'700',color:colors.text,marginTop:1},
    subtitle:{fontSize:14,color:colors.muted,marginTop:2,lineHeight:19},
    stats:{flexDirection:'row',gap:8,marginBottom:12},
    stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,paddingVertical:12,paddingHorizontal:8,alignItems:'center'},
    statNumber:{fontSize:25,fontWeight:'700'},
    statLabel:{fontSize:12,color:colors.muted,marginTop:1},
    searchBox:{height:50,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center,gap:8,paddingHorizontal:13},
    searchInput:{flex:1,borderWidth:0,backgroundColor:'transparent',paddingHorizontal:0,paddingVertical:0},
    filters:{flexDirection:'row',gap:7,marginVertical:11},
    filter:{paddingHorizontal:13,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
    filterText:{fontSize:14,color:colors.text},
    filterTextActive:{color:'#fff',fontWeight:'700'},
    list:{paddingBottom:110,flexGrow:1},
    card:{minHeight:76,backgroundColor:colors.surface,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,padding:13,marginBottom:8,flexDirection:'row',alignItems:'center',gap:11},
    avatar:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},
    avatarText:{fontSize:20,fontWeight:'700'},
    personBody:{flex:1},
    nameRow:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},
    name:{fontSize:17,fontWeight:'700',color:colors.text},
    role:{fontSize:13,fontWeight:'600',color:colors.muted,marginTop:1},
    address:{fontSize:13,color:colors.muted,marginTop:2},
    youBadge:{paddingHorizontal:7,paddingVertical:2,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft},
    youText:{fontSize:11,fontWeight:'700',color:colors.muted},
    activeBadge:{flexDirection:'row',alignItems:'center',gap:5},
    activeDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.success},
    activeText:{fontSize:11,fontWeight:'700',color:colors.success},
  });
}
