import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, deleteUser, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { buscarCondominioPorCodigo, Condominio, prepararNovoCondominio } from '../services/condominios';
import { solicitarVinculoPorCodigo } from '../services/vinculo';
import { PerfilUsuario, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { radius, shadow, ThemeColors } from '../theme';

export default function Register({ route, navigation }: any) {
  const { aplicarPerfilLocal } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tipo, setTipo] = useState<'morador' | 'porteiro'>(route?.params?.tipoInicial || 'morador');
  const [modoPorteiro, setModoPorteiro] = useState<'criar' | 'entrar'>('criar');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigoCondominio, setCodigoCondominio] = useState('');
  const [nomeCondominio, setNomeCondominio] = useState('');
  const [condominioConfirmado, setCondominioConfirmado] = useState<string | null>(null);
  const [bloco, setBloco] = useState('');
  const [apartamento, setApartamento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const precisaCodigoPorteiro = tipo === 'porteiro' && modoPorteiro === 'entrar';
  const temCodigoMorador = tipo === 'morador' && !!codigoCondominio.trim();
  const corAtiva = tipo === 'porteiro' ? colors.porter : colors.accent;
  const ocupado = loading || verificando;

  async function verificarCondominio() {
    if (!codigoCondominio.trim()) {
      if (tipo === 'morador') return Alert.alert('Código opcional', 'Você pode criar a conta agora e vincular o condomínio depois pelo Perfil.');
      return Alert.alert('Código', 'Informe o código do condomínio.');
    }
    try {
      setVerificando(true);
      setCondominioConfirmado(null);
      const condominio = await buscarCondominioPorCodigo(codigoCondominio);
      if (!condominio) return Alert.alert('Código inválido', 'Nenhum condomínio foi encontrado com esse código.');
      setCondominioConfirmado(condominio.nome);
    } catch (e:any) {
      Alert.alert('Erro', e?.message || 'Não foi possível verificar o condomínio.');
    } finally { setVerificando(false); }
  }

  function validarDadosBase() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe seu nome completo.'), false;
    if (!email.trim() || !senha) return Alert.alert('Atenção', 'Informe e-mail e senha.'), false;
    if (senha.length < 6) return Alert.alert('Senha', 'A senha deve ter pelo menos 6 caracteres.'), false;
    const cpfDigitos = cpf.replace(/\D/g, '');
    if (cpfDigitos && cpfDigitos.length !== 11) return Alert.alert('CPF', 'Informe os 11 dígitos do CPF ou deixe o campo vazio.'), false;
    if (tipo === 'morador' && (!bloco.trim() || !apartamento.trim())) return Alert.alert('Atenção', 'Informe bloco e apartamento.'), false;
    if (tipo === 'porteiro' && modoPorteiro === 'criar' && nomeCondominio.trim().length < 3) return Alert.alert('Atenção', 'Informe o nome do condomínio.'), false;
    if (precisaCodigoPorteiro && !codigoCondominio.trim()) return Alert.alert('Atenção', 'Informe o código do condomínio em que você trabalha.'), false;
    return true;
  }

  async function resolverCondominioPorteiro(uid: string, preCarregado?: Condominio | null): Promise<Condominio | null> {
    if (tipo !== 'porteiro') return null;
    if (preCarregado) return preCarregado;
    if (modoPorteiro === 'criar') return prepararNovoCondominio(nomeCondominio, uid);
    const existente = await buscarCondominioPorCodigo(codigoCondominio);
    if (!existente) throw new Error('Código de condomínio inválido. Verifique o código informado.');
    return existente;
  }

  function montarPerfil(user: User, condominio: Condominio | null): PerfilUsuario {
    return {
      id: user.uid,
      nome: (nome || user.displayName || 'Usuário').trim(),
      cpf: cpf.replace(/\D/g, '').slice(0,11),
      email: (user.email || email).trim().toLowerCase(),
      tipo,
      condominioId: tipo === 'porteiro' ? (condominio?.id || '') : '',
      condominioNome: tipo === 'porteiro' ? (condominio?.nome || '') : '',
      condominioCodigo: tipo === 'porteiro' ? (condominio?.codigoExibicao || '') : '',
      bloco: tipo === 'morador' ? bloco.trim().toUpperCase() : '',
      apartamento: tipo === 'morador' ? apartamento.trim() : '',
      telefone: telefone.trim(),
      fotoPerfil: '',
      mostrarCodigoCondominio: tipo === 'porteiro' && modoPorteiro === 'criar',
    };
  }

  async function criarSolicitacaoMorador(perfilCriado: PerfilUsuario) {
    if (tipo !== 'morador' || !codigoCondominio.trim()) return null;
    return solicitarVinculoPorCodigo({
      moradorId: perfilCriado.id,
      moradorNome: perfilCriado.nome,
      email: perfilCriado.email,
      bloco: perfilCriado.bloco,
      apartamento: perfilCriado.apartamento,
      codigo: codigoCondominio,
    });
  }

  async function salvarPerfil(user: User, condominioPreCarregado?: Condominio | null) {
    const existente = await getDoc(doc(db, 'usuarios', user.uid));
    if (existente.exists()) {
      const dados = { id: existente.id, ...existente.data() } as PerfilUsuario;
      if (dados.tipo !== tipo) throw new Error('Esta conta já está cadastrada em outro tipo de acesso.');
      await aplicarPerfilLocal(dados);
      return { perfil:dados, solicitacaoErro:'' };
    }

    const condominio = await resolverCondominioPorteiro(user.uid, condominioPreCarregado);
    const perfilCriado = montarPerfil(user, condominio);
    const { id, ...dadosFirestore } = perfilCriado;

    if (tipo === 'porteiro' && modoPorteiro === 'criar' && condominio) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'condominios', condominio.id), {
        nome: condominio.nome,
        codigo: condominio.id,
        codigoExibicao: condominio.codigoExibicao,
        criadoPor: user.uid,
        criadoEm: serverTimestamp(),
      });
      batch.set(doc(db, 'usuarios', user.uid), { ...dadosFirestore, criadoEm: serverTimestamp() });
      await batch.commit();
    } else {
      await setDoc(doc(db, 'usuarios', user.uid), { ...dadosFirestore, criadoEm: serverTimestamp() });
    }

    let solicitacaoErro = '';
    try { await criarSolicitacaoMorador(perfilCriado); }
    catch (e:any) { solicitacaoErro = e?.message || 'Não foi possível enviar a solicitação de vínculo agora.'; }
    await aplicarPerfilLocal(perfilCriado);
    return { perfil:perfilCriado, solicitacaoErro };
  }

  async function cadastrarEmail() {
    if (!validarDadosBase()) return;
    let usuarioCriado: User | null = null;
    try {
      setLoading(true);
      let condominioPorteiro: Condominio | null = null;
      if (precisaCodigoPorteiro) {
        condominioPorteiro = await buscarCondominioPorCodigo(codigoCondominio);
        if (!condominioPorteiro) throw new Error('Código de condomínio inválido. Confira o código informado.');
      }
      if (temCodigoMorador) {
        const condominioMorador = await buscarCondominioPorCodigo(codigoCondominio);
        if (!condominioMorador) throw new Error('Código de condomínio inválido. Confira o código informado.');
      }
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
      usuarioCriado = cred.user;
      const resultado = await salvarPerfil(cred.user, condominioPorteiro);
      if (tipo === 'morador' && codigoCondominio.trim()) {
        Alert.alert('Cadastro concluído', resultado.solicitacaoErro ? 'Sua conta foi criada, mas o vínculo não foi enviado. Abra o Perfil e tente novamente.' : 'Sua conta foi criada e a solicitação de entrada foi enviada para a portaria.');
      } else if (tipo === 'morador') {
        Alert.alert('Cadastro concluído', 'Sua conta foi criada. Você pode vincular o condomínio depois pelo Perfil.');
      } else if (modoPorteiro === 'entrar') {
        Alert.alert('Pronto', 'Cadastro de portaria realizado.');
      }
    } catch (e:any) {
      if (usuarioCriado) { try { await deleteUser(usuarioCriado); } catch {} }
      const codigo = String(e?.code || '');
      if (codigo.includes('email-already-in-use')) Alert.alert('Conta existente', 'Este e-mail já possui uma conta. Volte ao login e entre com ela.');
      else if (codigo.includes('permission-denied')) Alert.alert('Firebase', 'As regras atuais do Firestore precisam ser publicadas.');
      else Alert.alert('Erro', e?.message || 'Não foi possível realizar o cadastro.');
    } finally { setLoading(false); }
  }

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}><Ionicons name="arrow-back" size={20} color={colors.text}/></TouchableOpacity>
    <Text style={styles.title}>Criar conta</Text><Text style={styles.help}>Escolha seu tipo de acesso e complete o cadastro.</Text>

    <View style={styles.roleRow}>
      <TouchableOpacity style={[styles.roleButton,tipo==='morador'&&{backgroundColor:colors.accent,borderColor:colors.accent}]} onPress={()=>{setTipo('morador');setCondominioConfirmado(null);}} disabled={ocupado}><Ionicons name="home-outline" size={19} color={tipo==='morador'?'#fff':colors.text}/><Text style={[styles.roleText,tipo==='morador'&&styles.roleTextActive]}>Morador</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.roleButton,tipo==='porteiro'&&{backgroundColor:colors.porter,borderColor:colors.porter}]} onPress={()=>{setTipo('porteiro');setCondominioConfirmado(null);}} disabled={ocupado}><Ionicons name="cube-outline" size={19} color={tipo==='porteiro'?'#fff':colors.text}/><Text style={[styles.roleText,tipo==='porteiro'&&styles.roleTextActive]}>Portaria</Text></TouchableOpacity>
    </View>

    {tipo==='porteiro'&&<View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>Condomínio da portaria</Text>
      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segment,modoPorteiro==='criar'&&{backgroundColor:colors.porter}]} onPress={()=>setModoPorteiro('criar')}><Text style={[styles.segmentText,modoPorteiro==='criar'&&styles.roleTextActive]}>Criar novo</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segment,modoPorteiro==='entrar'&&{backgroundColor:colors.porter}]} onPress={()=>setModoPorteiro('entrar')}><Text style={[styles.segmentText,modoPorteiro==='entrar'&&styles.roleTextActive]}>Já tenho código</Text></TouchableOpacity>
      </View>
      {modoPorteiro==='criar'&&<TextInput style={styles.input} placeholder="Nome do condomínio" value={nomeCondominio} onChangeText={setNomeCondominio}/>} 
    </View>}

    <View style={styles.formCard}>
      <TextInput style={styles.input} placeholder="Nome completo" value={nome} onChangeText={setNome}/>
      <TextInput style={styles.input} placeholder="CPF (11 dígitos)" keyboardType="numeric" value={cpf} onChangeText={setCpf} maxLength={14}/>
      {(tipo==='morador'||precisaCodigoPorteiro)&&<>
        <TextInput style={styles.input} placeholder={tipo==='morador'?'Código do condomínio (opcional)':'Código do condomínio'} autoCapitalize="characters" autoCorrect={false} value={codigoCondominio} onChangeText={valor=>{setCodigoCondominio(valor.toUpperCase());setCondominioConfirmado(null);}}/>
        {tipo==='morador'&&!codigoCondominio.trim()&&<Text style={styles.optionalInfo}>Você pode criar a conta sem código e fazer o vínculo depois.</Text>}
        {!!codigoCondominio.trim()&&<TouchableOpacity style={styles.verify} onPress={verificarCondominio} disabled={verificando}><Ionicons name="search-outline" size={16} color={corAtiva}/><Text style={[styles.verifyText,{color:corAtiva}]}>{verificando?'Verificando...':'Verificar código'}</Text></TouchableOpacity>}
        {!!condominioConfirmado&&<View style={styles.confirmedRow}><Ionicons name="checkmark-circle" size={17} color={colors.success}/><Text style={styles.confirmed}>{condominioConfirmado}</Text></View>}
      </>}
      {tipo==='morador'&&<View style={styles.twoCols}><TextInput style={[styles.input,styles.half]} placeholder="Bloco" autoCapitalize="characters" value={bloco} onChangeText={setBloco}/><TextInput style={[styles.input,styles.half]} placeholder="Apartamento" value={apartamento} onChangeText={setApartamento}/></View>}
      <TextInput style={styles.input} placeholder="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone}/>
      <TextInput style={styles.input} placeholder="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail}/>
      <TextInput style={styles.input} placeholder="Senha" secureTextEntry value={senha} onChangeText={setSenha} onSubmitEditing={cadastrarEmail}/>
      <TouchableOpacity style={[styles.button,{backgroundColor:corAtiva},ocupado&&styles.disabled]} onPress={cadastrarEmail} disabled={ocupado}><Text style={styles.buttonText}>{loading?'Cadastrando...':'Criar conta'}</Text><Ionicons name="arrow-forward" size={18} color="#fff"/></TouchableOpacity>
    </View>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{paddingHorizontal:22,paddingTop:48,paddingBottom:90,backgroundColor:colors.background},backButton:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginBottom:22},title:{fontSize:42,fontWeight:'700',color:colors.text,letterSpacing:-0.7},help:{fontSize:18,color:colors.muted,marginTop:2,marginBottom:22},roleRow:{flexDirection:'row',gap:10,marginBottom:14},roleButton:{flex:1,paddingVertical:13,paddingHorizontal:14,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},roleText:{fontSize:16,fontWeight:'600',color:colors.text},roleTextActive:{color:'#fff'},sectionCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:15,borderWidth:1,borderColor:colors.border,marginBottom:12},sectionLabel:{fontSize:18,fontWeight:'700',marginBottom:10},segmentRow:{flexDirection:'row',gap:8,marginBottom:10},segment:{flex:1,padding:10,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,alignItems:'center'},segmentText:{fontWeight:'600',color:colors.text},formCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border,...shadow},input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:15,paddingVertical:13,marginBottom:10},optionalInfo:{fontSize:14,color:colors.muted,marginTop:-2,marginBottom:10},verify:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,marginTop:-3,marginBottom:8},verifyText:{fontWeight:'600'},confirmedRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10},confirmed:{color:colors.success,fontWeight:'600'},twoCols:{flexDirection:'row',gap:10},half:{flex:1},button:{paddingVertical:15,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:2},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},disabled:{opacity:0.55}
});}
