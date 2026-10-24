import React, { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, deleteUser, reload, sendEmailVerification, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { buscarCondominioPorCodigo, Condominio, prepararNovoCondominio } from '../services/condominios';
import { salvarCadastroComIdentificadores } from '../services/identificadoresUsuarios';
import { solicitarVinculoPorCodigo } from '../services/vinculo';
import { PerfilUsuario, useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useTheme } from '../context/ThemeContext';
import { GOOGLE_ROLE_STORAGE_KEY } from '../components/GoogleSignInButton';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { formatarCPF, formatarTelefoneBR, somenteDigitos, validarCPF, validarTelefoneBR } from '../utils/validacao';
import { radius, shadow, ThemeColors } from '../theme';

type CadastroPendente = {
  version: 1;
  tipo: 'morador' | 'porteiro';
  modoPorteiro: 'criar' | 'entrar';
  nome: string;
  cpf: string;
  email: string;
  codigoCondominio: string;
  nomeCondominio: string;
  bloco: string;
  apartamento: string;
  telefone: string;
  condominioPorteiro: Condominio | null;
};

const PENDING_PREFIX = '@cegonha/cadastro-pendente:';
function pendingKey(uid: string) { return `${PENDING_PREFIX}${uid}`; }

export default function Register({ route, navigation }: any) {
  const { aplicarPerfilLocal } = useAuth();
  const { colors } = useTheme();
  const feedback = useFeedback();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const usuarioAutenticado = auth.currentUser;
  const cadastroAutenticado = !!usuarioAutenticado;
  const contaGoogle = !!usuarioAutenticado?.providerData?.some(p => p.providerId === 'google.com');

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
  const [aguardandoEmail, setAguardandoEmail] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [finalizandoEmail, setFinalizandoEmail] = useState(false);
  const [erroFormulario, setErroFormulario] = useState('');

  function aplicarPendenteNoFormulario(pendente: CadastroPendente) {
    setTipo(pendente.tipo);
    setModoPorteiro(pendente.modoPorteiro);
    setNome(pendente.nome);
    setCpf(formatarCPF(pendente.cpf));
    setEmail(pendente.email);
    setCodigoCondominio(pendente.codigoCondominio);
    setNomeCondominio(pendente.nomeCondominio);
    setBloco(pendente.bloco);
    setApartamento(pendente.apartamento);
    setTelefone(formatarTelefoneBR(pendente.telefone));
    if (pendente.condominioPorteiro?.nome) setCondominioConfirmado(pendente.condominioPorteiro.nome);
  }

  async function lerPendente(user: User): Promise<CadastroPendente | null> {
    try {
      const raw = await AsyncStorage.getItem(pendingKey(user.uid));
      if (!raw) return null;
      const dados = JSON.parse(raw) as CadastroPendente;
      return dados?.version === 1 && dados?.tipo ? dados : null;
    } catch { return null; }
  }

  useEffect(() => {
    if (!usuarioAutenticado) return;
    setNome(v => v || usuarioAutenticado.displayName || '');
    setEmail(v => v || usuarioAutenticado.email || '');

    let ativo = true;
    Promise.all([
      AsyncStorage.getItem(GOOGLE_ROLE_STORAGE_KEY).catch(() => null),
      lerPendente(usuarioAutenticado),
    ]).then(([papel, pendente]) => {
      if (!ativo) return;
      if (papel === 'morador' || papel === 'porteiro') setTipo(papel);
      if (pendente) aplicarPendenteNoFormulario(pendente);
      if (!usuarioAutenticado.emailVerified && !contaGoogle) setAguardandoEmail(!!pendente);
    });
    return () => { ativo = false; };
  }, [usuarioAutenticado?.uid]);

  useEffect(() => {
    if (!aguardandoEmail) return;
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') confirmarEmail(true).catch(() => {});
    });
    return () => sub.remove();
  }, [aguardandoEmail, finalizandoEmail]);

  const precisaCodigoPorteiro = tipo === 'porteiro' && modoPorteiro === 'entrar';
  const temCodigoMorador = tipo === 'morador' && !!codigoCondominio.trim();
  const corAtiva = tipo === 'porteiro' ? colors.porter : colors.accent;
  const ocupado = loading || verificando || finalizandoEmail || reenviando;

  async function verificarCondominio() {
    setErroFormulario('');
    if (!codigoCondominio.trim()) {
      if (tipo === 'morador') return setCondominioConfirmado(null);
      return setErroFormulario('Informe o código do condomínio.');
    }
    try {
      setVerificando(true);
      setCondominioConfirmado(null);
      const condominio = await buscarCondominioPorCodigo(codigoCondominio);
      if (!condominio) return setErroFormulario('Nenhum condomínio foi encontrado com esse código.');
      setCondominioConfirmado(condominio.nome);
    } catch (e:any) {
      setErroFormulario(e?.message || 'Não foi possível verificar o condomínio.');
    } finally { setVerificando(false); }
  }

  function validarDadosBase() {
    setErroFormulario('');
    if (!nome.trim()) return setErroFormulario('Informe seu nome completo.'), false;
    if (!validarCPF(cpf)) return setErroFormulario('Informe um CPF válido no formato 000.000.000-00.'), false;
    if (!validarTelefoneBR(telefone)) return setErroFormulario('Informe um telefone brasileiro válido com DDD.'), false;
    if (!cadastroAutenticado && (!email.trim() || !senha)) return setErroFormulario('Informe e-mail e senha.'), false;
    if (!cadastroAutenticado && senha.length < 6) return setErroFormulario('A senha deve ter pelo menos 6 caracteres.'), false;
    if (tipo === 'morador' && (!bloco.trim() || !apartamento.trim())) return setErroFormulario('Informe bloco e apartamento.'), false;
    if (tipo === 'porteiro' && modoPorteiro === 'criar' && nomeCondominio.trim().length < 3) return setErroFormulario('Informe o nome do condomínio.'), false;
    if (precisaCodigoPorteiro && !codigoCondominio.trim()) return setErroFormulario('Informe o código do condomínio em que você trabalha.'), false;
    return true;
  }

  async function validarCondominioExistente(): Promise<Condominio | null> {
    let condominioPorteiro: Condominio | null = null;
    if (precisaCodigoPorteiro) {
      condominioPorteiro = await buscarCondominioPorCodigo(codigoCondominio);
      if (!condominioPorteiro) throw new Error('Código de condomínio inválido. Confira o código informado.');
    }
    if (temCodigoMorador) {
      const condominioMorador = await buscarCondominioPorCodigo(codigoCondominio);
      if (!condominioMorador) throw new Error('Código de condomínio inválido. Confira o código informado.');
    }
    return condominioPorteiro;
  }

  function montarPendente(user: User, condominioExistente: Condominio | null): CadastroPendente {
    const condominioPorteiro = tipo === 'porteiro' && modoPorteiro === 'criar'
      ? prepararNovoCondominio(nomeCondominio, user.uid)
      : condominioExistente;
    return {
      version: 1,
      tipo,
      modoPorteiro,
      nome: (nome || user.displayName || 'Usuário').trim(),
      cpf: somenteDigitos(cpf),
      email: (user.email || email).trim().toLowerCase(),
      codigoCondominio: codigoCondominio.trim().toUpperCase(),
      nomeCondominio: nomeCondominio.trim(),
      bloco: tipo === 'morador' ? bloco.trim().toUpperCase() : '',
      apartamento: tipo === 'morador' ? apartamento.trim() : '',
      telefone: formatarTelefoneBR(telefone),
      condominioPorteiro,
    };
  }

  function montarPerfil(user: User, pendente: CadastroPendente): PerfilUsuario {
    return {
      id: user.uid,
      nome: pendente.nome,
      cpf: pendente.cpf,
      email: pendente.email,
      tipo: pendente.tipo,
      condominioId: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.id || '') : '',
      condominioNome: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.nome || '') : '',
      condominioCodigo: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' ? (pendente.condominioPorteiro?.codigoExibicao || '') : '',
      bloco: pendente.bloco,
      apartamento: pendente.apartamento,
      telefone: pendente.telefone,
      fotoPerfil: '',
      mostrarCodigoCondominio: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar',
    };
  }

  async function criarSolicitacaoMorador(perfilCriado: PerfilUsuario, pendente: CadastroPendente) {
    const precisaSolicitar = !!pendente.codigoCondominio.trim() && (
      pendente.tipo === 'morador' ||
      (pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'entrar')
    );
    if (!precisaSolicitar) return null;
    return solicitarVinculoPorCodigo({
      moradorId: perfilCriado.id,
      moradorNome: perfilCriado.nome,
      email: perfilCriado.email,
      bloco: perfilCriado.bloco,
      apartamento: perfilCriado.apartamento,
      codigo: pendente.codigoCondominio,
      solicitanteTipo: pendente.tipo,
    });
  }

  async function salvarPerfilVerificado(user: User, pendente: CadastroPendente) {
    if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) {
      throw new Error('Confirme o e-mail antes de concluir o cadastro.');
    }

    const existente = await getDoc(doc(db, 'usuarios', user.uid));
    if (existente.exists()) {
      const dados = { id: existente.id, ...existente.data() } as PerfilUsuario;
      if (dados.tipo !== pendente.tipo) throw new Error('Esta conta já está cadastrada em outro tipo de acesso.');
      await aplicarPerfilLocal(dados);
      return { perfil:dados, solicitacaoErro:'' };
    }

    const perfilCriado = montarPerfil(user, pendente);
    const { id, ...dadosFirestore } = perfilCriado;
    const dadosUsuario = {
      ...dadosFirestore,
      emailVerificado:true,
      emailVerificadoEm:serverTimestamp(),
      criadoEm:serverTimestamp(),
    };

    await salvarCadastroComIdentificadores({
      uid:user.uid,
      cpf:pendente.cpf,
      telefone:pendente.telefone,
      dadosUsuario,
      condominio: pendente.tipo === 'porteiro' && pendente.modoPorteiro === 'criar' && pendente.condominioPorteiro
        ? {
            id:pendente.condominioPorteiro.id,
            nome:pendente.condominioPorteiro.nome,
            codigoExibicao:pendente.condominioPorteiro.codigoExibicao,
          }
        : null,
    });

    let solicitacaoErro = '';
    try { await criarSolicitacaoMorador(perfilCriado, pendente); }
    catch (e:any) { solicitacaoErro = e?.message || 'Não foi possível enviar a solicitação de vínculo agora.'; }
    await aplicarPerfilLocal(perfilCriado);
    return { perfil:perfilCriado, solicitacaoErro };
  }

  function mensagemConclusao(pendente: CadastroPendente, solicitacaoErro: string) {
    if (pendente.tipo === 'morador' && pendente.codigoCondominio.trim()) {
      return solicitacaoErro
        ? 'Conta confirmada. O vínculo com o condomínio não foi enviado; você pode tentar novamente pelo Perfil.'
        : 'E-mail confirmado, conta criada e solicitação de entrada enviada para a portaria.';
    }
    if (pendente.tipo === 'morador') return 'E-mail confirmado e conta criada. Você pode vincular o condomínio depois pelo Perfil.';
    if (pendente.modoPorteiro === 'entrar') return solicitacaoErro
      ? 'E-mail confirmado. Não foi possível enviar o pedido de acesso à portaria; tente novamente pelo Perfil.'
      : 'E-mail confirmado. Seu pedido para entrar como Portaria foi enviado e aguarda aprovação de uma conta da portaria já vinculada.';
    return 'E-mail confirmado, cadastro da portaria concluído e condomínio criado.';
  }

  async function finalizarCadastro(user: User, pendente?: CadastroPendente | null) {
    if (finalizandoEmail) return;
    setFinalizandoEmail(true);
    try {
      await reload(user);
      if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) return false;
      const dados = pendente || await lerPendente(user);
      if (!dados) {
        setAguardandoEmail(false);
        setErroFormulario('O e-mail foi confirmado. Complete os dados abaixo para finalizar o cadastro neste dispositivo.');
        return false;
      }
      const resultado = await salvarPerfilVerificado(user, dados);
      await AsyncStorage.multiRemove([pendingKey(user.uid), GOOGLE_ROLE_STORAGE_KEY]).catch(() => {});
      setAguardandoEmail(false);
      feedback.notify(mensagemConclusao(dados, resultado.solicitacaoErro), { title:'Cadastro confirmado', tone: resultado.solicitacaoErro ? 'warning' : 'success', durationMs:5200 });
      return true;
    } catch (e:any) {
      feedback.alert('Não foi possível concluir o cadastro', e?.message || 'Tente novamente em instantes.', undefined, 'danger');
      return false;
    } finally {
      setFinalizandoEmail(false);
    }
  }

  async function confirmarEmail(silencioso = false) {
    const user = auth.currentUser;
    if (!user || finalizandoEmail) return;
    const concluiu = await finalizarCadastro(user);
    if (!concluiu && !silencioso && !user.emailVerified) {
      setErroFormulario('O e-mail ainda não aparece como confirmado. Abra a mensagem recebida, toque no link de verificação e volte ao Cegonha.');
    }
  }

  async function reenviarEmail() {
    const user = auth.currentUser;
    if (!user || user.emailVerified || reenviando) return;
    try {
      setReenviando(true);
      await sendEmailVerification(user);
      feedback.notify('Enviamos uma nova mensagem de verificação.', { title:'E-mail reenviado', tone:'info' });
    } catch (e:any) {
      feedback.alert('Não foi possível reenviar', e?.message || 'Aguarde um pouco e tente novamente.', undefined, 'warning');
    } finally { setReenviando(false); }
  }

  async function cadastrar() {
    if (!validarDadosBase()) return;
    let usuarioCriado: User | null = null;
    let pendenteSalvo = false;
    try {
      setLoading(true);
      const condominioExistente = await validarCondominioExistente();

      if (usuarioAutenticado) {
        const pendente = montarPendente(usuarioAutenticado, condominioExistente);
        await AsyncStorage.setItem(pendingKey(usuarioAutenticado.uid), JSON.stringify(pendente));
        pendenteSalvo = true;
        if (usuarioAutenticado.emailVerified || contaGoogle) {
          await finalizarCadastro(usuarioAutenticado, pendente);
          return;
        }
        try { await sendEmailVerification(usuarioAutenticado); }
        catch (e:any) { feedback.alert('Verificação de e-mail', e?.message || 'Não foi possível enviar agora. Use “Reenviar e-mail” para tentar novamente.', undefined, 'warning'); }
        setAguardandoEmail(true);
        setErroFormulario('');
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
      usuarioCriado = cred.user;
      const pendente = montarPendente(cred.user, condominioExistente);
      await AsyncStorage.setItem(pendingKey(cred.user.uid), JSON.stringify(pendente));
      pendenteSalvo = true;
      try {
        await sendEmailVerification(cred.user);
        feedback.notify('Abra sua caixa de entrada e confirme o endereço para concluir o cadastro.', { title:'E-mail de confirmação enviado', tone:'info', durationMs:5000 });
      } catch (e:any) {
        feedback.alert('Conta criada, confirmação pendente', e?.message || 'Não foi possível enviar o e-mail agora. Use o botão de reenvio.', undefined, 'warning');
      }
      setAguardandoEmail(true);
      setErroFormulario('');
    } catch (e:any) {
      if (usuarioCriado && !pendenteSalvo) { try { await deleteUser(usuarioCriado); } catch {} }
      const codigo = String(e?.code || '');
      if (codigo.includes('email-already-in-use')) feedback.alert('Conta existente', 'Este e-mail já possui uma conta. Volte ao login e entre com ela.', undefined, 'warning');
      else if (codigo.includes('permission-denied')) feedback.alert('Acesso ao banco bloqueado', 'As regras atuais do Firestore impediram a operação.', undefined, 'danger');
      else feedback.alert('Não foi possível criar a conta', e?.message || 'Revise os dados e tente novamente.', undefined, 'danger');
    } finally { setLoading(false); }
  }

  async function voltar() {
    if (cadastroAutenticado) {
      await AsyncStorage.removeItem(GOOGLE_ROLE_STORAGE_KEY).catch(() => {});
      await signOut(auth);
      return;
    }
    navigation?.goBack?.();
  }

  if (aguardandoEmail && usuarioAutenticado && !contaGoogle) {
    return <KeyboardScreen contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={voltar} accessibilityLabel="Sair e confirmar o e-mail depois"><Ionicons name="log-out-outline" size={20} color={colors.text}/></TouchableOpacity>
      <View style={styles.verifyEmailCard}>
        <View style={styles.mailIcon}><Ionicons name="mail-unread-outline" size={34} color={colors.accent}/></View>
        <Text style={styles.verifyEmailEyebrow}>ÚLTIMA ETAPA</Text>
        <Text style={styles.verifyEmailTitle}>Confirme seu e-mail</Text>
        <Text style={styles.verifyEmailText}>O cadastro ainda não foi concluído. Enviamos um link para:</Text>
        <Text style={styles.verifyEmailAddress}>{usuarioAutenticado.email || email}</Text>
        <View style={styles.steps}>
          <View style={styles.step}><Text style={styles.stepNumber}>1</Text><Text style={styles.stepText}>Abra o e-mail enviado pelo Firebase.</Text></View>
          <View style={styles.step}><Text style={styles.stepNumber}>2</Text><Text style={styles.stepText}>Toque no link para confirmar o endereço.</Text></View>
          <View style={styles.step}><Text style={styles.stepNumber}>3</Text><Text style={styles.stepText}>Volte ao Cegonha. A confirmação será verificada automaticamente ou pelo botão abaixo.</Text></View>
        </View>
        {!!erroFormulario && <View style={styles.inlineError}><Ionicons name="information-circle-outline" size={18} color={colors.warning}/><Text style={styles.inlineErrorText}>{erroFormulario}</Text></View>}
        <TouchableOpacity style={[styles.button,{backgroundColor:colors.accent},ocupado&&styles.disabled]} onPress={()=>confirmarEmail(false)} disabled={ocupado}><Ionicons name="checkmark-circle-outline" size={19} color="#fff"/><Text style={styles.buttonText}>{finalizandoEmail?'Verificando...':'Já confirmei meu e-mail'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.resendButton} onPress={reenviarEmail} disabled={ocupado}><Ionicons name="refresh-outline" size={17} color={colors.accent}/><Text style={styles.resendText}>{reenviando?'Reenviando...':'Reenviar e-mail'}</Text></TouchableOpacity>
        <Text style={styles.verifyNote}>Se não encontrar a mensagem, confira também a pasta de spam ou lixo eletrônico.</Text>
      </View>
    </KeyboardScreen>;
  }

  return <KeyboardScreen contentContainerStyle={styles.container}>
    <TouchableOpacity style={styles.backButton} onPress={voltar}><Ionicons name={cadastroAutenticado ? 'log-out-outline' : 'arrow-back'} size={20} color={colors.text}/></TouchableOpacity>
    <Text style={styles.title}>{cadastroAutenticado ? 'Concluir cadastro' : 'Criar conta'}</Text>
    <Text style={styles.help}>{cadastroAutenticado ? 'Complete os dados abaixo. Contas por e-mail só são ativadas depois da confirmação do endereço.' : 'Escolha seu tipo de acesso e complete o cadastro.'}</Text>

    {contaGoogle && <View style={styles.googleConnected}><Ionicons name="logo-google" size={18} color={colors.text}/><View style={{flex:1}}><Text style={styles.googleTitle}>Conta Google conectada</Text><Text style={styles.googleEmail}>{usuarioAutenticado?.email || ''}</Text></View></View>}

    <View style={styles.roleRow}>
      <TouchableOpacity style={[styles.roleButton,tipo==='morador'&&{backgroundColor:colors.accent,borderColor:colors.accent}]} onPress={()=>{setTipo('morador');setCondominioConfirmado(null);setErroFormulario('');}} disabled={ocupado}><Ionicons name="home-outline" size={19} color={tipo==='morador'?'#fff':colors.text}/><Text style={[styles.roleText,tipo==='morador'&&styles.roleTextActive]}>Morador</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.roleButton,tipo==='porteiro'&&{backgroundColor:colors.porter,borderColor:colors.porter}]} onPress={()=>{setTipo('porteiro');setCondominioConfirmado(null);setErroFormulario('');}} disabled={ocupado}><Ionicons name="cube-outline" size={19} color={tipo==='porteiro'?'#fff':colors.text}/><Text style={[styles.roleText,tipo==='porteiro'&&styles.roleTextActive]}>Portaria</Text></TouchableOpacity>
    </View>

    {tipo==='porteiro'&&<View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>Condomínio da portaria</Text>
      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segment,modoPorteiro==='criar'&&{backgroundColor:colors.porter}]} onPress={()=>{setModoPorteiro('criar');setErroFormulario('');}}><Text style={[styles.segmentText,modoPorteiro==='criar'&&styles.roleTextActive]}>Criar novo</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segment,modoPorteiro==='entrar'&&{backgroundColor:colors.porter}]} onPress={()=>{setModoPorteiro('entrar');setErroFormulario('');}}><Text style={[styles.segmentText,modoPorteiro==='entrar'&&styles.roleTextActive]}>Já tenho código</Text></TouchableOpacity>
      </View>
      {modoPorteiro==='criar'&&<TextInput style={styles.input} placeholder="Nome do condomínio" value={nomeCondominio} onChangeText={v=>{setNomeCondominio(v);setErroFormulario('');}}/>}
    </View>}

    <View style={styles.formCard}>
      <TextInput style={styles.input} placeholder="Nome completo" value={nome} onChangeText={v=>{setNome(v);setErroFormulario('');}}/>
      <TextInput style={styles.input} placeholder="CPF · 000.000.000-00" keyboardType="numeric" value={cpf} onChangeText={valor=>{setCpf(formatarCPF(valor));setErroFormulario('');}} maxLength={14}/>
      <Text style={styles.fieldHint}>CPF obrigatório, validado e exclusivo por conta.</Text>
      {(tipo==='morador'||precisaCodigoPorteiro)&&<>
        <TextInput style={styles.input} placeholder={tipo==='morador'?'Código do condomínio (opcional)':'Código do condomínio'} autoCapitalize="characters" autoCorrect={false} value={codigoCondominio} onChangeText={valor=>{setCodigoCondominio(valor.toUpperCase());setCondominioConfirmado(null);setErroFormulario('');}}/>
        {tipo==='morador'&&!codigoCondominio.trim()&&<Text style={styles.optionalInfo}>Você pode criar a conta sem código e fazer o vínculo depois.</Text>}
        {!!codigoCondominio.trim()&&<TouchableOpacity style={styles.verify} onPress={verificarCondominio} disabled={verificando}><Ionicons name="search-outline" size={16} color={corAtiva}/><Text style={[styles.verifyText,{color:corAtiva}]}>{verificando?'Verificando...':'Verificar código'}</Text></TouchableOpacity>}
        {!!condominioConfirmado&&<View style={styles.confirmedRow}><Ionicons name="checkmark-circle" size={17} color={colors.success}/><Text style={styles.confirmed}>{condominioConfirmado}</Text></View>}
      </>}
      {tipo==='morador'&&<View style={styles.twoCols}><TextInput style={[styles.input,styles.half]} placeholder="Bloco" autoCapitalize="characters" value={bloco} onChangeText={v=>{setBloco(v);setErroFormulario('');}}/><TextInput style={[styles.input,styles.half]} placeholder="Apartamento" value={apartamento} onChangeText={v=>{setApartamento(v);setErroFormulario('');}}/></View>}
      <TextInput style={styles.input} placeholder="Telefone · (00) 00000-0000" keyboardType="phone-pad" value={telefone} onChangeText={valor=>{setTelefone(formatarTelefoneBR(valor));setErroFormulario('');}} maxLength={15}/>
      <Text style={styles.fieldHint}>Telefone obrigatório com DDD e exclusivo por conta. São aceitos números fixos ou celulares brasileiros.</Text>
      <TextInput style={[styles.input,cadastroAutenticado&&styles.readonly]} placeholder="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={v=>{setEmail(v);setErroFormulario('');}} editable={!cadastroAutenticado}/>
      {!cadastroAutenticado&&<TextInput style={styles.input} placeholder="Senha" secureTextEntry value={senha} onChangeText={v=>{setSenha(v);setErroFormulario('');}} onSubmitEditing={cadastrar}/>} 
      {!!erroFormulario && <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={18} color={colors.danger}/><Text style={[styles.inlineErrorText,{color:colors.danger}]}>{erroFormulario}</Text></View>}
      {!contaGoogle && <View style={styles.emailInfo}><Ionicons name="mail-outline" size={18} color={colors.info}/><Text style={styles.emailInfoText}>Depois de tocar em “Criar conta”, enviaremos um e-mail. O cadastro só será concluído após você abrir a mensagem e confirmar o endereço.</Text></View>}
      <TouchableOpacity style={[styles.button,{backgroundColor:corAtiva},ocupado&&styles.disabled]} onPress={cadastrar} disabled={ocupado}><Text style={styles.buttonText}>{loading?'Preparando...':cadastroAutenticado?'Concluir cadastro':'Criar conta'}</Text><Ionicons name="arrow-forward" size={18} color="#fff"/></TouchableOpacity>
    </View>
  </KeyboardScreen>;
}

function makeStyles(colors:ThemeColors){return StyleSheet.create({
  container:{paddingHorizontal:22,paddingTop:48,paddingBottom:90,backgroundColor:colors.background},backButton:{width:42,height:42,borderRadius:21,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginBottom:22},title:{fontSize:42,fontWeight:'700',color:colors.text,letterSpacing:-0.7},help:{fontSize:18,color:colors.muted,marginTop:2,marginBottom:22},googleConnected:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.medium,padding:13,marginBottom:14},googleTitle:{fontSize:15,fontWeight:'700'},googleEmail:{fontSize:13,color:colors.muted,marginTop:1},roleRow:{flexDirection:'row',gap:10,marginBottom:14},roleButton:{flex:1,paddingVertical:13,paddingHorizontal:14,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},roleText:{fontSize:16,fontWeight:'600',color:colors.text},roleTextActive:{color:'#fff'},sectionCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:15,borderWidth:1,borderColor:colors.border,marginBottom:12},sectionLabel:{fontSize:18,fontWeight:'700',marginBottom:10},segmentRow:{flexDirection:'row',gap:8,marginBottom:10},segment:{flex:1,padding:10,borderRadius:radius.pill,backgroundColor:colors.surfaceSoft,alignItems:'center'},segmentText:{fontWeight:'600',color:colors.text},formCard:{backgroundColor:colors.surface,borderRadius:radius.large,padding:16,borderWidth:1,borderColor:colors.border,...shadow},input:{backgroundColor:colors.surfaceSoft,borderWidth:0,borderRadius:radius.medium,paddingHorizontal:15,paddingVertical:13,marginBottom:10},readonly:{opacity:.7},fieldHint:{fontSize:12,color:colors.muted,lineHeight:17,marginTop:-6,marginBottom:10},optionalInfo:{fontSize:14,color:colors.muted,marginTop:-2,marginBottom:10},verify:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6,marginTop:-3,marginBottom:8},verifyText:{fontWeight:'600'},confirmedRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10},confirmed:{color:colors.success,fontWeight:'600'},twoCols:{flexDirection:'row',gap:10},half:{flex:1},button:{paddingVertical:15,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:2},buttonText:{color:'#fff',fontSize:17,fontWeight:'700'},disabled:{opacity:0.55},inlineError:{flexDirection:'row',gap:7,alignItems:'flex-start',backgroundColor:`${colors.danger}12`,borderRadius:radius.medium,padding:10,marginBottom:10},inlineErrorText:{flex:1,fontSize:13,lineHeight:18,fontWeight:'600'},emailInfo:{flexDirection:'row',gap:8,alignItems:'flex-start',backgroundColor:colors.surfaceSoft,borderRadius:radius.medium,padding:11,marginBottom:10},emailInfoText:{flex:1,fontSize:13,lineHeight:18,color:colors.muted},verifyEmailCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.large,padding:22,...shadow},mailIcon:{width:64,height:64,borderRadius:32,backgroundColor:colors.accentSoft,alignItems:'center',justifyContent:'center',marginBottom:16},verifyEmailEyebrow:{fontSize:11,fontWeight:'700',letterSpacing:1.5,color:colors.accent},verifyEmailTitle:{fontSize:34,fontWeight:'700',marginTop:3},verifyEmailText:{fontSize:16,lineHeight:22,color:colors.muted,marginTop:8},verifyEmailAddress:{fontSize:17,fontWeight:'700',color:colors.text,marginTop:5},steps:{marginVertical:18,gap:10},step:{flexDirection:'row',gap:10,alignItems:'flex-start'},stepNumber:{width:26,height:26,borderRadius:13,textAlign:'center',lineHeight:26,fontWeight:'700',backgroundColor:colors.accentSoft,color:colors.accent},stepText:{flex:1,fontSize:15,lineHeight:20,color:colors.muted,paddingTop:2},resendButton:{height:46,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,marginTop:9,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},resendText:{fontSize:15,fontWeight:'700',color:colors.accent},verifyNote:{fontSize:12,lineHeight:17,color:colors.muted,textAlign:'center',marginTop:12}
});}
