import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { EmptyState } from '../components/States';
import { buscarDuplicada, registrarChegada } from '../services/encomendas';
import { correspondeBusca, montarTextoBuscaPessoa } from '../utils/busca';
import { radius, ThemeColors } from '../theme';

const LIMITE_DESCRICAO = 300;

export default function EncomendaForm({ navigation, route }: any) {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const moradorInicial = route?.params?.candidato || route?.params?.morador || null;
  const ocrMeta = route?.params?.ocrMeta;

  const [moradores, setMoradores] = useState<any[]>([]);
  const [previsoes, setPrevisoes] = useState<any[]>([]);
  const [previsaoSelecionada, setPrevisaoSelecionada] = useState<any>(null);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<any>(moradorInicial);
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!perfil || perfil.tipo !== 'porteiro' || !perfil.condominioId) {
      setMoradores([]);
      return;
    }
    const q = query(collection(db, 'usuarios'), where('condominioId', '==', perfil.condominioId));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((m:any) => m.tipo === 'morador') as any[];
      lista.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
      setMoradores(lista);
      if (selecionado?.id) {
        const atualizado = lista.find(m => m.id === selecionado.id);
        if (atualizado) setSelecionado(atualizado);
      }
    }, () => setMoradores([]));
  }, [perfil?.condominioId, perfil?.tipo, selecionado?.id]);

  useEffect(() => {
    if (!selecionado?.id || !perfil?.condominioId) {
      setPrevisoes([]);
      setPrevisaoSelecionada(null);
      return;
    }
    const q = query(
      collection(db,'previsoes'),
      where('moradorId','==',selecionado.id),
      where('condominioId','==',perfil.condominioId),
    );
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d=>({id:d.id,...d.data()})) as any[];
      lista.sort((a,b)=>(b.criadaEm?.seconds||0)-(a.criadaEm?.seconds||0));
      const visiveis = lista.slice(0,3);
      setPrevisoes(visiveis);
      setPrevisaoSelecionada(atual => atual ? (visiveis.find(p=>p.id===atual.id) || null) : null);
    }, () => setPrevisoes([]));
  },[selecionado?.id,perfil?.condominioId]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return moradores.slice(0,30);
    return moradores
      .filter(m => correspondeBusca(montarTextoBuscaPessoa(m), busca))
      .slice(0,30);
  }, [moradores,busca]);

  function voltarParaHome() {
    navigation.navigate('Home');
  }

  async function salvar(ignorarDuplicidade = false) {
    if (perfil?.tipo !== 'porteiro') return Alert.alert('Acesso', 'Apenas a portaria pode registrar chegadas.');
    if (!selecionado) return Alert.alert('Atenção', 'Selecione um morador.');
    if (descricao.trim().length > LIMITE_DESCRICAO) return Alert.alert('Descrição muito longa', `Use no máximo ${LIMITE_DESCRICAO} caracteres.`);
    try {
      setLoading(true);
      if (!ignorarDuplicidade) {
        const duplicada = await buscarDuplicada(selecionado.id, perfil.condominioId);
        if (duplicada) {
          setLoading(false);
          return Alert.alert('Possível duplicidade','Já existe uma encomenda registrada para este morador nos últimos 10 minutos. Deseja registrar mesmo assim?',[{text:'Cancelar',style:'cancel'},{text:'Registrar mesmo assim',onPress:()=>salvar(true)}]);
        }
      }

      const resultado = await registrarChegada({
        perfil,
        morador: selecionado,
        descricao,
        ocrMeta,
        previsao: previsaoSelecionada,
      });

      if (resultado.avisos.length > 0) {
        const cabecalho = resultado.notificacaoCriada
          ? 'A encomenda foi registrada e o aviso do morador foi criado.'
          : 'A encomenda foi registrada com sucesso.';
        Alert.alert(
          'Chegada registrada',
          `${cabecalho}\n\n${resultado.avisos.join('\n')}`,
          [{ text: 'OK', onPress: voltarParaHome }],
        );
        return;
      }

      Alert.alert(
        'Chegada registrada',
        'A encomenda foi registrada e o aviso do morador já está disponível na conta dele.',
        [{ text: 'OK', onPress: voltarParaHome }],
      );
    } catch (e:any) {
      const codigo = String(e?.code || '');
      const mensagem = codigo.includes('permission-denied')
        ? 'A Portaria não tem permissão para criar a encomenda. Atualize as regras do Firestore com “npm run firebase:deploy”, confirme que a Portaria e o morador estão no mesmo condomínio e tente novamente.'
        : e?.message || 'Não foi possível registrar a encomenda.';
      Alert.alert('Erro ao registrar chegada', mensagem);
    } finally {
      setLoading(false);
    }
  }

  if (perfil?.tipo !== 'porteiro') return null;

  return <KeyboardScreen contentContainerStyle={styles.screen}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()} accessibilityLabel="Voltar"><Ionicons name="arrow-back" size={22} color={colors.text}/></TouchableOpacity><View><Text style={styles.eyebrow}>PORTARIA</Text><Text style={styles.title}>Registrar chegada</Text></View></View>
    {!!ocrMeta && <View style={styles.ocrBadge}><Ionicons name="scan-outline" size={17} color={colors.info}/><Text style={styles.ocrText}>Dados originados do OCR. A foto da etiqueta não é salva; confirme o morador antes de registrar.</Text></View>}

    {selecionado ? <View style={styles.selected}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(selecionado.nome||'M')[0].toUpperCase()}</Text></View>
      <View style={{flex:1}}><Text style={styles.name}>{selecionado.nome}</Text><Text style={styles.meta}>CPF {selecionado.cpf||'não informado'} · Bloco {selecionado.bloco||'-'} · Ap. {selecionado.apartamento||'-'}</Text></View>
      <TouchableOpacity onPress={()=>{setSelecionado(null);setPrevisaoSelecionada(null);}}><Text style={styles.change}>Trocar</Text></TouchableOpacity>
    </View> : <>
      <View style={styles.searchRow}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput style={styles.searchInput} placeholder="Nome, CPF, bloco, apartamento ou e-mail" value={busca} onChangeText={setBusca} returnKeyType="search"/>{!!busca&&<TouchableOpacity onPress={()=>setBusca('')} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color={colors.muted}/></TouchableOpacity>}</View>
      {!filtrados.length ? <EmptyState icon="search-outline" title="Nenhum morador encontrado" text="Tente nome, CPF, “bloco A”, “apto 203” ou confira se o morador está vinculado ao condomínio."/> : <View style={styles.peopleList}>{filtrados.map(item=><TouchableOpacity key={item.id} style={styles.item} onPress={()=>setSelecionado(item)} accessibilityLabel={`${item.nome}, bloco ${item.bloco || 'não informado'}, apartamento ${item.apartamento || 'não informado'}`}><Text style={styles.name}>{item.nome}</Text><Text style={styles.meta}>CPF {item.cpf||'—'} · Bloco {item.bloco||'-'} · Ap. {item.apartamento||'-'}</Text></TouchableOpacity>)}</View>}
    </>}

    {!!selecionado && previsoes.length>0 && <View style={styles.forecastBox}>
      <Text style={styles.forecastTitle}>Esta entrega já era esperada?</Text><Text style={styles.forecastHelp}>Vincule uma previsão para completar a linha do tempo desde “Prevista”.</Text>
      {previsoes.map(p=><TouchableOpacity key={p.id} style={[styles.forecastItem,previsaoSelecionada?.id===p.id&&styles.forecastActive]} onPress={()=>setPrevisaoSelecionada(previsaoSelecionada?.id===p.id?null:p)}><Ionicons name={previsaoSelecionada?.id===p.id?'radio-button-on':'radio-button-off'} size={19} color={previsaoSelecionada?.id===p.id?colors.success:colors.muted}/><View style={{flex:1}}><Text style={styles.forecastName}>{p.descricao}</Text><Text style={styles.meta}>{p.previsao||p.transportadora||'Previsão cadastrada pelo morador'}</Text></View></TouchableOpacity>)}
    </View>}

    <TextInput style={[styles.input,{marginTop:12}]} placeholder="Descrição opcional da encomenda" value={descricao} onChangeText={setDescricao} returnKeyType="done" onSubmitEditing={()=>salvar()} maxLength={LIMITE_DESCRICAO}/>
    <TouchableOpacity style={[styles.button,loading&&{opacity:.55}]} onPress={()=>salvar()} disabled={loading}><Text style={styles.buttonText}>{loading?'Salvando...':'Confirmar chegada'}</Text><Ionicons name="checkmark" size={19} color="#fff"/></TouchableOpacity>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  screen:{padding:20,paddingTop:16,paddingBottom:100,backgroundColor:colors.background},header:{paddingTop:8,flexDirection:'row',alignItems:'center',gap:12,marginBottom:16},back:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.7,color:colors.porter},title:{fontSize:30,fontWeight:'700'},ocrBadge:{flexDirection:'row',gap:8,backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:13,marginBottom:13},ocrText:{flex:1,fontSize:14,color:colors.info,lineHeight:19},selected:{flexDirection:'row',alignItems:'center',backgroundColor:colors.surface,borderRadius:radius.large,padding:15,borderWidth:1,borderColor:colors.border},avatar:{width:44,height:44,borderRadius:22,backgroundColor:colors.porterSoft,alignItems:'center',justifyContent:'center',marginRight:10},avatarText:{fontSize:20,fontWeight:'700',color:colors.porter},name:{fontSize:18,fontWeight:'700'},meta:{fontSize:14,color:colors.muted,marginTop:2},change:{fontWeight:'700',color:colors.porter},input:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,paddingHorizontal:15,paddingVertical:13},searchRow:{minHeight:50,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:8},searchInput:{flex:1,borderWidth:0,paddingVertical:9},peopleList:{marginTop:8},item:{backgroundColor:colors.surface,padding:14,borderRadius:radius.medium,marginBottom:8,borderWidth:1,borderColor:colors.border},forecastBox:{backgroundColor:colors.surface,borderRadius:radius.medium,padding:14,borderWidth:1,borderColor:colors.border,marginTop:12},forecastTitle:{fontSize:17,fontWeight:'700'},forecastHelp:{fontSize:13,color:colors.muted,lineHeight:18,marginTop:2,marginBottom:8},forecastItem:{flexDirection:'row',alignItems:'center',gap:9,padding:10,borderRadius:radius.small,marginTop:5,backgroundColor:colors.surfaceSoft},forecastActive:{borderWidth:1,borderColor:colors.success},forecastName:{fontSize:15,fontWeight:'700'},button:{minHeight:52,borderRadius:radius.pill,backgroundColor:colors.porter,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:14},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'}
});}
