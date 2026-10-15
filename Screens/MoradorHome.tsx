import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AppText as Text } from '../components/AppText';
import { colors, radius, shadow } from '../theme';

export default function MoradorHome({ navigation }: any) {
  const { user, perfil } = useAuth();
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [esperadas, setEsperadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    if (!user) return;
    try {
      setLoading(true);
      const [encomendasSnap, previsoesSnap] = await Promise.all([
        getDocs(query(collection(db, 'encomendas'), where('moradorId', '==', user.uid))),
        getDocs(query(collection(db, 'previsoes'), where('moradorId', '==', user.uid))),
      ]);
      const encomendas = encomendasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      encomendas.sort((a, b) => (b.recebidaEm?.seconds || 0) - (a.recebidaEm?.seconds || 0));
      setPendentes(encomendas.filter(e => e.status === 'pendente'));

      const previsoes = previsoesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      previsoes.sort((a, b) => (b.criadaEm?.seconds || 0) - (a.criadaEm?.seconds || 0));
      setEsperadas(previsoes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    const unsub = navigation.addListener?.('focus', carregar);
    return () => unsub?.();
  }, [user?.uid]);

  const atrasadas = esperadas.filter(item => item.atrasada).length;
  const temCondominio = !!perfil?.condominioId;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>CEGONHA</Text>
      <Text style={styles.hello}>Olá, {perfil?.nome || 'morador'}.</Text>
      <Text style={styles.condo}>{temCondominio ? (perfil?.condominioNome || 'Condomínio') : 'Seu espaço ainda não está vinculado'}</Text>

      {!temCondominio && (
        <TouchableOpacity style={styles.linkBox} onPress={() => navigation.navigate('Perfil')}>
          <View style={styles.linkIcon}><Ionicons name="link-outline" size={19} color={colors.accent} /></View>
          <View style={styles.linkCopy}>
            <Text style={styles.linkTitle}>Vincular condomínio</Text>
            <Text style={styles.linkText}>Adicione o código quando receber da portaria.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.number}>{pendentes.length}</Text><Text style={styles.statLabel}>Na portaria</Text></View>
        <View style={styles.stat}><Text style={styles.number}>{esperadas.length}</Text><Text style={styles.statLabel}>Esperadas</Text></View>
        <View style={styles.stat}><Text style={styles.number}>{atrasadas}</Text><Text style={styles.statLabel}>Atrasadas</Text></View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Previsoes')}>
          <View style={styles.actionIcon}><Ionicons name="time-outline" size={22} color={colors.accent} /></View>
          <Text style={styles.actionTitle}>Estou esperando</Text>
          <Text style={styles.actionText}>Avise sobre uma entrega futura.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Notificacoes')}>
          <View style={styles.actionIcon}><Ionicons name="notifications-outline" size={22} color={colors.accent} /></View>
          <Text style={styles.actionTitle}>Avisos</Text>
          <Text style={styles.actionText}>Veja atualizações da portaria.</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Aguardando retirada</Text>
        <Text style={styles.sectionCount}>{pendentes.length}</Text>
      </View>

      <FlatList
        data={pendentes.slice(0, 5)}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={carregar}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Detalhes', { encomenda: item })}>
            <View style={styles.cardTop}>
              <View style={styles.packageMark}><Ionicons name="cube-outline" size={19} color={colors.accent} /></View>
              <Text style={styles.status}>Na portaria</Text>
            </View>
            <Text style={styles.cardTitle}>{item.descricao || 'Encomenda recebida'}</Text>
            <Text style={styles.muted}>Bloco {item.bloco} · Ap. {item.apartamento}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma encomenda aguardando retirada.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,paddingHorizontal:20,paddingTop:54,paddingBottom:118,backgroundColor:colors.background},
  eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:2,color:colors.accent},
  hello:{fontSize:36,fontWeight:'700',color:colors.text,marginTop:4,letterSpacing:-0.5},
  condo:{fontSize:17,color:colors.muted,marginTop:2,marginBottom:18},
  linkBox:{backgroundColor:colors.surface,borderRadius:radius.large,padding:14,marginBottom:14,flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:colors.border,...shadow},
  linkIcon:{width:38,height:38,borderRadius:19,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},linkCopy:{flex:1},
  linkTitle:{fontSize:17,fontWeight:'700'},linkText:{fontSize:14,color:colors.muted,marginTop:1},
  statsRow:{flexDirection:'row',gap:9},
  stat:{flex:1,backgroundColor:colors.surface,paddingVertical:15,paddingHorizontal:8,borderRadius:radius.medium,alignItems:'center',borderWidth:1,borderColor:colors.border},
  number:{fontSize:28,fontWeight:'700',color:colors.text},statLabel:{fontSize:13,color:colors.muted,marginTop:-1},
  actionsRow:{flexDirection:'row',gap:10,marginTop:12},
  actionCard:{flex:1,backgroundColor:colors.surface,padding:14,borderRadius:radius.large,borderWidth:1,borderColor:colors.border,minHeight:132},
  actionIcon:{width:38,height:38,borderRadius:19,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',marginBottom:10},
  actionTitle:{fontSize:18,fontWeight:'700'},actionText:{fontSize:14,color:colors.muted,lineHeight:18,marginTop:2},
  sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:24,marginBottom:10},
  section:{fontSize:24,fontWeight:'700',color:colors.text},sectionCount:{fontSize:14,color:colors.muted},
  listContent:{paddingBottom:12},
  card:{backgroundColor:colors.surface,padding:16,borderRadius:radius.large,marginBottom:10,borderWidth:1,borderColor:colors.border},
  cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},packageMark:{width:36,height:36,borderRadius:18,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center'},
  status:{fontSize:13,fontWeight:'600',color:colors.accent},cardTitle:{fontSize:19,fontWeight:'700',marginTop:12},muted:{color:colors.muted,fontSize:15,marginTop:3},
  empty:{textAlign:'center',color:colors.muted,marginTop:28,fontSize:16},
});
