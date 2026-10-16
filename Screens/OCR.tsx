import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { reconhecerEtiqueta, usandoChaveDemoOCRSpace } from '../ocr';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text } from '../components/AppText';
import { radius, shadow, ThemeColors } from '../theme';

const LIMITE_UPLOAD_BYTES = 900000;

function tamanhoBase64(base64: string) {
  return Math.ceil(base64.length * 0.75);
}

async function prepararImagemOCR(asset: ImagePicker.ImagePickerAsset) {
  const larguraOriginal = asset.width || 1400;
  const tentativas = [
    { width: Math.min(larguraOriginal, 1280), compress: 0.58 },
    { width: Math.min(larguraOriginal, 1050), compress: 0.48 },
    { width: Math.min(larguraOriginal, 820), compress: 0.38 },
  ];

  for (const tentativa of tentativas) {
    const tratada = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: tentativa.width } }],
      {
        compress: tentativa.compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    if (tratada.base64 && tamanhoBase64(tratada.base64) <= LIMITE_UPLOAD_BYTES) {
      return {
        uri: tratada.uri,
        base64Image: `data:image/jpeg;base64,${tratada.base64}`,
      };
    }
  }

  throw new Error('A foto ficou grande demais para o OCR.Space. Aproxime a câmera da etiqueta e tente novamente.');
}

export default function OCR({ navigation }: any) {
  const { perfil } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [imagem, setImagem] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [tipoTexto, setTipoTexto] = useState<'impresso'|'manuscrito'>('impresso');
  const [iluminacao, setIluminacao] = useState<'boa'|'media'|'ruim'>('boa');
  const [tempoMs, setTempoMs] = useState(0);
  const chaveDemo = usandoChaveDemoOCRSpace();

  useEffect(() => {
    if (perfil && perfil.tipo !== 'porteiro') {
      Alert.alert('Acesso restrito', 'O reconhecimento de etiquetas é exclusivo da portaria.');
      navigation.goBack();
    }
  }, [perfil?.tipo]);

  function limparLeitura() {
    setImagem(null);
    setResultado(null);
    setTempoMs(0);
  }

  function removerSomenteFoto() {
    setImagem(null);
  }

  function confirmarDescarte() {
    Alert.alert(
      'Descartar leitura?',
      'A foto temporária e os dados reconhecidos desta tentativa serão removidos da tela. Nada desta tentativa é salvo no Firestore antes da confirmação da encomenda.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: limparLeitura },
      ],
    );
  }

  async function prepararEAnalisar(asset: ImagePicker.ImagePickerAsset) {
    try {
      limparLeitura();
      setCarregando(true);

      const preparada = await prepararImagemOCR(asset);
      setImagem(preparada.uri);

      const inicio = Date.now();
      const resposta = await reconhecerEtiqueta(
        preparada.base64Image,
        perfil?.condominioId || '',
        tipoTexto,
      );
      const duracao = Date.now() - inicio;
      setTempoMs(duracao);
      setResultado({ ...resposta, tempoMs: duracao });
    } catch (e: any) {
      Alert.alert('OCR.Space', e?.message || 'Não foi possível ler a etiqueta.');
    } finally {
      setCarregando(false);
    }
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
      reconheceuNome: !!resultado?.nome,
      reconheceuCpf: !!resultado?.cpf,
      reconheceuBloco: !!resultado?.bloco,
      reconheceuApartamento: !!resultado?.apartamento,
    };
  }

  function selecionar(candidato?: any) {
    const ocrMeta = metaOCR();
    setImagem(null);
    navigation.navigate('EncomendaForm', { candidato, ocrMeta });
  }

  if (perfil?.tipo !== 'porteiro') return null;

  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.headerRow}>
      <View style={{flex:1}}>
        <Text style={styles.eyebrow}>OCR.SPACE</Text>
        <Text style={styles.title}>Reconhecer etiqueta</Text>
      </View>
      <TouchableOpacity style={styles.historyButton} onPress={()=>navigation.navigate('OCRHistorico')}>
        <Ionicons name="time-outline" size={19} color={colors.porter}/>
        <Text style={styles.historyText}>Histórico</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.condo}>{perfil.condominioNome || 'Condomínio'}{perfil.condominioCodigo ? ` · ${perfil.condominioCodigo}` : ''}</Text>
    <Text style={styles.help}>Fotografe a etiqueta inteira. O Cegonha envia uma versão comprimida ao OCR.Space, recebe o texto e cruza nome, CPF, bloco e apartamento com os moradores do condomínio.</Text>

    <View style={styles.privacyCard}>
      <Ionicons name="shield-checkmark-outline" size={19} color={colors.success}/>
      <Text style={styles.privacyText}>A foto não é salva no Firestore nem anexada à encomenda. Ela fica apenas temporariamente nesta tela e pode ser removida logo após a leitura. O texto bruto também não é persistido.</Text>
    </View>

    {chaveDemo && <View style={styles.demoCard}>
      <Ionicons name="flask-outline" size={18} color={colors.warning}/>
      <Text style={styles.demoText}>Modo de teste: usando a chave pública “helloworld” do OCR.Space. Funciona sem configuração, mas tem limite baixo. Para uso mais estável, coloque sua chave gratuita em EXPO_PUBLIC_OCR_SPACE_API_KEY no arquivo .env.local.</Text>
    </View>}

    <View style={styles.studyCard}>
      <Text style={styles.studyTitle}>Condições da leitura</Text>
      <View style={styles.chips}>{(['impresso','manuscrito'] as const).map(v => <TouchableOpacity key={v} style={[styles.chip,tipoTexto===v&&styles.chipActive]} onPress={()=>setTipoTexto(v)}><Text style={[styles.chipText,tipoTexto===v&&styles.chipTextActive]}>{v === 'impresso' ? 'Impresso' : 'Manuscrito'}</Text></TouchableOpacity>)}</View>
      <View style={[styles.chips,{marginTop:8}]}>{(['boa','media','ruim'] as const).map(v => <TouchableOpacity key={v} style={[styles.chip,iluminacao===v&&styles.chipActive]} onPress={()=>setIluminacao(v)}><Text style={[styles.chipText,iluminacao===v&&styles.chipTextActive]}>{v === 'media' ? 'Média' : v[0].toUpperCase()+v.slice(1)}</Text></TouchableOpacity>)}</View>
    </View>

    <View style={styles.actionsRow}>
      <TouchableOpacity style={styles.mainAction} onPress={tirarFoto} disabled={carregando}><Ionicons name="camera-outline" size={24} color="#fff" /><Text style={styles.mainActionTitle}>{carregando ? 'Analisando...' : 'Usar câmera'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.altAction} onPress={escolherFoto} disabled={carregando}><Ionicons name="images-outline" size={24} color={colors.porter} /><Text style={styles.altActionTitle}>Galeria</Text></TouchableOpacity>
    </View>

    {imagem && <View style={styles.previewBox}>
      <Image source={{ uri: imagem }} style={styles.image} />
      <Text style={styles.previewNote}>Prévia temporária · não é salva pelo Cegonha.</Text>
      {!!resultado && <TouchableOpacity style={styles.removePhoto} onPress={removerSomenteFoto}><Ionicons name="image-outline" size={17} color={colors.porter}/><Text style={styles.removePhotoText}>Remover foto e manter os dados reconhecidos</Text></TouchableOpacity>}
    </View>}

    {resultado && <View style={styles.result}>
      <View style={styles.resultHeader}><Text style={styles.resultTitle}>Leitura concluída</Text><Text style={styles.time}>{(tempoMs/1000).toFixed(1)} s</Text></View>
      <View style={styles.dataBox}><Text style={styles.dataLabel}>Nome</Text><Text style={styles.dataValue}>{resultado.nome || 'Não identificado'}</Text></View>
      <View style={styles.dataBox}><Text style={styles.dataLabel}>CPF</Text><Text style={styles.dataValue}>{resultado.cpf || 'Não identificado'}</Text></View>
      <View style={styles.dataGrid}><View style={styles.dataBox}><Text style={styles.dataLabel}>Bloco</Text><Text style={styles.dataValue}>{resultado.bloco || '—'}</Text></View><View style={styles.dataBox}><Text style={styles.dataLabel}>Apartamento</Text><Text style={styles.dataValue}>{resultado.apartamento || '—'}</Text></View></View>
      <Text style={styles.section}>Moradores mais prováveis</Text>
      {resultado.candidatos.map((m:any,index:number)=><TouchableOpacity key={m.id} style={[styles.candidate,index===0&&styles.candidateTop]} onPress={()=>selecionar(m)}><View style={{flex:1}}><Text style={styles.name}>{m.nome}</Text><Text style={styles.meta}>CPF {m.cpf || '—'} · Bloco {m.bloco || '-'} · Ap. {m.apartamento || '-'}</Text></View><Text style={styles.scoreNumber}>{Math.round(m.score*100)}%</Text></TouchableOpacity>)}
      {!resultado.candidatos.length && <Text style={styles.none}>Nenhuma correspondência segura foi encontrada.</Text>}
      <TouchableOpacity style={styles.manual} onPress={()=>selecionar(undefined)}><Ionicons name="search-outline" size={18} color={colors.porter}/><Text style={styles.manualText}>Corrigir ou buscar morador manualmente</Text></TouchableOpacity>
      <TouchableOpacity style={styles.discard} onPress={confirmarDescarte}><Ionicons name="trash-outline" size={18} color={colors.danger}/><Text style={styles.discardText}>Descartar leitura inteira</Text></TouchableOpacity>
    </View>}
  </ScrollView>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{padding:22,paddingBottom:130,backgroundColor:colors.background,flexGrow:1},headerRow:{flexDirection:'row',alignItems:'center',gap:10},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:1.8,color:colors.porter},title:{fontSize:34,fontWeight:'700',color:colors.text,marginTop:4},condo:{color:colors.muted,fontSize:16,marginTop:2},help:{color:colors.muted,fontSize:17,lineHeight:23,marginTop:12,marginBottom:12},privacyCard:{backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:12,marginBottom:10,borderWidth:1,borderColor:colors.border,flexDirection:'row',gap:9,alignItems:'center'},privacyText:{flex:1,fontSize:14,lineHeight:19,color:colors.muted},demoCard:{backgroundColor:colors.surface,borderRadius:radius.medium,padding:12,marginBottom:14,borderWidth:1,borderColor:colors.border,flexDirection:'row',gap:9,alignItems:'flex-start'},demoText:{flex:1,fontSize:13,lineHeight:18,color:colors.muted},historyButton:{paddingHorizontal:12,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',gap:6,alignItems:'center'},historyText:{fontWeight:'700',color:colors.porter},studyCard:{backgroundColor:colors.surface,borderRadius:radius.medium,padding:15,marginBottom:15,borderWidth:1,borderColor:colors.border},studyTitle:{fontSize:17,fontWeight:'700',marginBottom:9},chips:{flexDirection:'row',gap:7,flexWrap:'wrap'},chip:{paddingHorizontal:13,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.info,borderColor:colors.info},chipText:{fontSize:14},chipTextActive:{color:'#fff',fontWeight:'700'},actionsRow:{flexDirection:'row',gap:10},mainAction:{flex:1,backgroundColor:colors.porter,borderRadius:radius.large,padding:16,...shadow},altAction:{width:110,backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border},mainActionTitle:{color:'#fff',fontSize:18,fontWeight:'700',marginTop:12},altActionTitle:{fontSize:17,fontWeight:'700',marginTop:12},previewBox:{marginTop:16},image:{width:'100%',height:250,borderRadius:radius.large},previewNote:{fontSize:12,color:colors.muted,marginTop:6,textAlign:'center'},removePhoto:{marginTop:8,minHeight:42,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:12},removePhotoText:{fontWeight:'700',fontSize:13,color:colors.porter},result:{backgroundColor:colors.surface,borderRadius:radius.large,padding:17,marginTop:16,borderWidth:1,borderColor:colors.border,...shadow},resultHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},resultTitle:{fontSize:24,fontWeight:'700'},time:{fontSize:14,color:colors.info,fontWeight:'700'},dataGrid:{flexDirection:'row',gap:8},dataBox:{flex:1,backgroundColor:colors.surfaceSoft,padding:10,borderRadius:radius.small,marginTop:9},dataLabel:{fontSize:11,color:colors.muted,textTransform:'uppercase'},dataValue:{fontSize:15,fontWeight:'700',marginTop:3},section:{fontSize:21,fontWeight:'700',marginTop:18,marginBottom:9},candidate:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:13,borderRadius:radius.medium,borderWidth:1,borderColor:colors.border,marginBottom:8},candidateTop:{borderColor:colors.success,backgroundColor:colors.surfaceSoft},name:{fontSize:18,fontWeight:'700'},meta:{fontSize:13,color:colors.muted,marginTop:2},scoreNumber:{fontSize:20,fontWeight:'700',color:colors.success},none:{color:colors.muted,fontSize:15,marginBottom:8},manual:{marginTop:6,height:48,borderRadius:radius.pill,backgroundColor:colors.porterSoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},manualText:{fontWeight:'700',color:colors.porter},discard:{marginTop:10,height:48,borderRadius:radius.pill,borderWidth:1,borderColor:colors.danger,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},discardText:{fontWeight:'700',color:colors.danger}
});}
