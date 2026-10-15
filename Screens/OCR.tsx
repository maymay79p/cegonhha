import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { reconhecerEtiqueta } from '../ocr';
import { useAuth } from '../context/AuthContext';
import { AppText as Text } from '../components/AppText';
import { colors, radius, shadow } from '../theme';

export default function OCR({ navigation }: any) {
  const { perfil } = useAuth();
  const [imagem, setImagem] = useState<string | null>(null);
  const [miniatura, setMiniatura] = useState<string>('');
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [tipoTexto, setTipoTexto] = useState<'impresso'|'manuscrito'>('impresso');
  const [iluminacao, setIluminacao] = useState<'boa'|'media'|'ruim'>('boa');
  const [tempoMs, setTempoMs] = useState(0);

  useEffect(() => {
    if (perfil && perfil.tipo !== 'porteiro') {
      Alert.alert('Acesso restrito', 'O reconhecimento de etiquetas é exclusivo da portaria.');
      navigation.goBack();
    }
  }, [perfil?.tipo]);

  async function prepararEAnalisar(asset: ImagePicker.ImagePickerAsset) {
    try {
      setImagem(asset.uri);
      setResultado(null);
      setCarregando(true);
      const largura = Math.min(asset.width || 1600, 1600);
      const tratada = await ImageManipulator.manipulateAsync(asset.uri,[{ resize: { width: largura } }],{ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      const thumb = await ImageManipulator.manipulateAsync(asset.uri,[{ resize: { width: 640 } }],{ compress: 0.42, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!tratada.base64) throw new Error('Não foi possível preparar a imagem para leitura.');
      if (thumb.base64 && thumb.base64.length < 480000) setMiniatura(`data:image/jpeg;base64,${thumb.base64}`);
      const inicio = Date.now();
      const resposta = await reconhecerEtiqueta(tratada.base64, perfil?.condominioId || '');
      const duracao = Date.now() - inicio;
      setTempoMs(duracao);
      setResultado({ ...resposta, tempoMs: duracao });
    } catch (e: any) {
      Alert.alert('OCR', e?.message || 'Não foi possível ler a etiqueta.');
    } finally { setCarregando(false); }
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o uso da câmera.');
    const foto = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!foto.canceled) await prepararEAnalisar(foto.assets[0]);
  }

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) return Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
    const foto = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!foto.canceled) await prepararEAnalisar(foto.assets[0]);
  }

  function metaOCR() {
    const top = resultado?.candidatos?.[0];
    return {
      tipoTexto,
      iluminacao,
      tempoMs,
      topCandidatoId: top?.id || '',
      topScore: top?.score || 0,
      nomeDetectado: resultado?.nome || '',
      cpfDetectado: resultado?.cpf || '',
      blocoDetectado: resultado?.bloco || '',
      apartamentoDetectado: resultado?.apartamento || '',
      textoOCR: resultado?.texto || '',
      reconheceuNome: !!resultado?.nome,
      reconheceuCpf: !!resultado?.cpf,
      reconheceuBloco: !!resultado?.bloco,
      reconheceuApartamento: !!resultado?.apartamento,
    };
  }

  function selecionar(candidato?: any) {
    navigation.navigate('EncomendaForm', { candidato, textoOCR: resultado?.texto || '', fotoEtiqueta: miniatura, ocrMeta: metaOCR() });
  }

  if (perfil?.tipo !== 'porteiro') return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{flex:1}}><Text style={styles.eyebrow}>LEITURA INTELIGENTE</Text><Text style={styles.title}>Reconhecer etiqueta</Text></View>
        <TouchableOpacity style={styles.historyButton} onPress={()=>navigation.navigate('OCRHistorico')}><Ionicons name="time-outline" size={19} color={colors.porter}/><Text style={styles.historyText}>Histórico</Text></TouchableOpacity>
      </View>
      <Text style={styles.condo}>{perfil.condominioNome || 'Condomínio'}{perfil.condominioCodigo ? ` · ${perfil.condominioCodigo}` : ''}</Text>
      <Text style={styles.help}>Fotografe a etiqueta inteira. O Cegonha tenta identificar nome, CPF, bloco e apartamento e mostra moradores compatíveis para confirmação.</Text>

      <View style={styles.studyCard}>
        <Text style={styles.studyTitle}>Condições da leitura</Text>
        <View style={styles.chips}>{(['impresso','manuscrito'] as const).map(v => <TouchableOpacity key={v} style={[styles.chip,tipoTexto===v&&styles.chipActive]} onPress={()=>setTipoTexto(v)}><Text style={[styles.chipText,tipoTexto===v&&styles.chipTextActive]}>{v === 'impresso' ? 'Impresso' : 'Manuscrito'}</Text></TouchableOpacity>)}</View>
        <View style={[styles.chips,{marginTop:8}]}>{(['boa','media','ruim'] as const).map(v => <TouchableOpacity key={v} style={[styles.chip,iluminacao===v&&styles.chipActive]} onPress={()=>setIluminacao(v)}><Text style={[styles.chipText,iluminacao===v&&styles.chipTextActive]}>{v === 'media' ? 'Média' : v[0].toUpperCase()+v.slice(1)}</Text></TouchableOpacity>)}</View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.mainAction} onPress={tirarFoto} disabled={carregando}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.mainActionTitle}>{carregando ? 'Analisando...' : 'Usar câmera'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.altAction} onPress={escolherFoto} disabled={carregando}><Ionicons name="images-outline" size={24} color={colors.porter} /><Text style={styles.altActionTitle}>Galeria</Text></TouchableOpacity>
      </View>

      {imagem && <Image source={{ uri: imagem }} style={styles.image} />}
      {resultado && <View style={styles.result}>
        <View style={styles.resultHeader}><Text style={styles.resultTitle}>Leitura concluída</Text><Text style={styles.time}>{(tempoMs/1000).toFixed(1)} s</Text></View>
        <View style={styles.dataBox}><Text style={styles.dataLabel}>Nome</Text><Text style={styles.dataValue}>{resultado.nome || 'Não identificado'}</Text></View>
        <View style={styles.dataBox}><Text style={styles.dataLabel}>CPF</Text><Text style={styles.dataValue}>{resultado.cpf || 'Não identificado'}</Text></View>
        <View style={styles.dataGrid}><View style={styles.dataBox}><Text style={styles.dataLabel}>Bloco</Text><Text style={styles.dataValue}>{resultado.bloco || '—'}</Text></View><View style={styles.dataBox}><Text style={styles.dataLabel}>Apartamento</Text><Text style={styles.dataValue}>{resultado.apartamento || '—'}</Text></View></View>
        <Text style={styles.section}>Moradores mais prováveis</Text>
        {resultado.candidatos.map((m:any, index:number) => <TouchableOpacity key={m.id} style={[styles.candidate,index===0&&styles.candidateTop]} onPress={()=>selecionar(m)}><View style={{flex:1}}><Text style={styles.name}>{m.nome}</Text><Text style={styles.meta}>CPF {m.cpf || '—'} · Bloco {m.bloco || '-'} · Ap. {m.apartamento || '-'}</Text></View><Text style={styles.scoreNumber}>{Math.round(m.score*100)}%</Text></TouchableOpacity>)}
        {!resultado.candidatos.length && <Text style={styles.none}>Nenhuma correspondência segura foi encontrada.</Text>}
        <TouchableOpacity style={styles.manual} onPress={()=>selecionar(undefined)}><Ionicons name="search-outline" size={18} color={colors.porter} /><Text style={styles.manualText}>Corrigir ou buscar morador manualmente</Text></TouchableOpacity>
      </View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{padding:22,paddingBottom:130,backgroundColor:colors.background,flexGrow:1},headerRow:{flexDirection:'row',alignItems:'center',gap:10},
  eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:34,fontWeight:'700',color:colors.text,marginTop:4},condo:{color:colors.muted,fontSize:16,marginTop:2},help:{color:colors.muted,fontSize:17,lineHeight:23,marginTop:12,marginBottom:16},
  historyButton:{paddingHorizontal:12,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',gap:6,alignItems:'center'},historyText:{fontWeight:'700',color:colors.porter},
  studyCard:{backgroundColor:colors.surface,borderRadius:radius.medium,padding:15,marginBottom:15,borderWidth:1,borderColor:colors.border},studyTitle:{fontSize:17,fontWeight:'700',marginBottom:9},chips:{flexDirection:'row',gap:7,flexWrap:'wrap'},chip:{paddingHorizontal:13,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.info,borderColor:colors.info},chipText:{fontSize:14},chipTextActive:{color:'#fff',fontWeight:'700'},
  actionsRow:{flexDirection:'row',gap:10},mainAction:{flex:1,backgroundColor:colors.porter,borderRadius:radius.large,padding:16,...shadow},altAction:{width:110,backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border},mainActionTitle:{color:'#fff',fontSize:18,fontWeight:'700',marginTop:12},altActionTitle:{fontSize:17,fontWeight:'700',marginTop:12},image:{width:'100%',height:250,borderRadius:radius.large,marginTop:16},
  result:{backgroundColor:colors.surface,borderRadius:radius.large,padding:17,marginTop:16,borderWidth:1,borderColor:colors.border,...shadow},resultHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},resultTitle:{fontSize:24,fontWeight:'700'},time:{fontSize:14,color:colors.info,fontWeight:'700'},dataGrid:{flexDirection:'row',gap:8},dataBox:{flex:1,backgroundColor:colors.surfaceSoft,padding:10,borderRadius:radius.small,marginTop:9},dataLabel:{fontSize:11,color:colors.muted,textTransform:'uppercase'},dataValue:{fontSize:15,fontWeight:'700',marginTop:3},section:{fontSize:21,fontWeight:'700',marginTop:18,marginBottom:9},candidate:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:13,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:8},candidateTop:{borderColor:'#B9C9BE',backgroundColor:'#F3F8F4'},name:{fontSize:18,fontWeight:'700'},meta:{fontSize:13,color:colors.muted,marginTop:2},scoreNumber:{fontSize:20,fontWeight:'700',color:colors.success},none:{color:colors.muted,fontSize:15,marginBottom:8},manual:{marginTop:6,height:48,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},manualText:{fontWeight:'700',color:colors.porter},
});
