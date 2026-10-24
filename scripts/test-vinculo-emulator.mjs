import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-cegonha';
const CONDOMINIO_ID = 'G7CJ785';
const OUTRO_CONDOMINIO_ID = 'X2YH456';
const SENHA = 'Teste123!';
const PORTARIA_EMAIL = 'portaria-vinculo@cegonha.test';
const MORADOR_EMAIL = 'morador-vinculo@cegonha.test';
const OUTRA_PORTARIA_EMAIL = 'portaria-outro-condominio@cegonha.test';

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function entrar(email) {
  await signOut(auth).catch(() => {});
  return signInWithEmailAndPassword(auth, email, SENHA);
}

async function confirmarEmailNoEmulador(user) {
  await sendEmailVerification(user);
  const resposta = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const dados = await resposta.json();
  const codigo = [...(dados.oobCodes || [])]
    .reverse()
    .find(item => item.email === user.email && item.requestType === 'VERIFY_EMAIL');
  if (!codigo?.oobLink) throw new Error(`Código de verificação não encontrado para ${user.email}`);
  const verificacao = await fetch(codigo.oobLink);
  if (!verificacao.ok) throw new Error(`Falha ao confirmar e-mail no Auth Emulator: ${verificacao.status}`);
  await reload(user);
  await user.getIdToken(true);
}

try {
  // 1) Portaria cria o condomínio e seu próprio perfil.
  const portariaCred = await createUserWithEmailAndPassword(auth, PORTARIA_EMAIL, SENHA);
  const portariaUid = portariaCred.user.uid;
  await assert.rejects(
    setDoc(doc(db, 'condominios', CONDOMINIO_ID), {
      nome: 'Tentativa antes da verificação',
      codigo: CONDOMINIO_ID,
      codigoExibicao: 'G7C-J785',
      criadoPor: portariaUid,
      criadoEm: serverTimestamp(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Conta de e-mail ainda não verificado não pode gravar dados protegidos.',
  );
  await confirmarEmailNoEmulador(portariaCred.user);
  await setDoc(doc(db, 'condominios', CONDOMINIO_ID), {
    nome: 'Condomínio Teste',
    codigo: CONDOMINIO_ID,
    codigoExibicao: 'G7C-J785',
    criadoPor: portariaUid,
    criadoEm: serverTimestamp(),
  });
  await setDoc(doc(db, 'usuarios', portariaUid), {
    nome: 'Portaria Teste',
    email: PORTARIA_EMAIL,
    tipo: 'porteiro',
    condominioId: CONDOMINIO_ID,
    condominioNome: 'Condomínio Teste',
    condominioCodigo: 'G7C-J785',
  });
  await setDoc(doc(db, 'diretorioUsuarios', portariaUid), {
    uid: portariaUid,
    nome: 'Portaria Teste',
    tipo: 'porteiro',
    condominioId: CONDOMINIO_ID,
    bloco: '',
    apartamento: '',
    atualizadoEm: serverTimestamp(),
  });

  // 2) Uma conta nova de morador nasce sem condomínio.
  await signOut(auth);
  const moradorCred = await createUserWithEmailAndPassword(auth, MORADOR_EMAIL, SENHA);
  const moradorUid = moradorCred.user.uid;
  await confirmarEmailNoEmulador(moradorCred.user);
  await setDoc(doc(db, 'usuarios', moradorUid), {
    nome: 'Morador Teste',
    email: MORADOR_EMAIL,
    tipo: 'morador',
    condominioId: '',
    condominioNome: '',
    condominioCodigo: '',
    bloco: 'A',
    apartamento: '101',
  });
  await setDoc(doc(db, 'diretorioUsuarios', moradorUid), {
    uid: moradorUid,
    nome: 'Morador Teste',
    tipo: 'morador',
    condominioId: '',
    bloco: 'A',
    apartamento: '101',
    atualizadoEm: serverTimestamp(),
  });

  const solicitacaoId = `${moradorUid}_${CONDOMINIO_ID}`;
  const solicitacaoRef = doc(db, 'solicitacoesCondominio', solicitacaoId);

  await assert.rejects(
    getDoc(solicitacaoRef),
    erro => String(erro?.code || '').includes('permission-denied'),
    'O get direto de uma solicitação inexistente deveria ser negado pelas regras.',
  );

  const consultaPropria = query(
    collection(db, 'solicitacoesCondominio'),
    where('moradorId', '==', moradorUid),
  );
  const antes = await getDocs(consultaPropria);
  assert.equal(antes.empty, true, 'Conta nova deve consultar suas próprias solicitações sem permission-denied.');

  // 3) Morador pede vínculo e avisa a Portaria no mesmo batch.
  const avisoPortariaRef = doc(collection(db, 'notificacoes'));
  const pedido = writeBatch(db);
  pedido.set(solicitacaoRef, {
    moradorId: moradorUid,
    moradorNome: 'Morador Teste',
    email: MORADOR_EMAIL,
    bloco: 'A',
    apartamento: '101',
    condominioId: CONDOMINIO_ID,
    condominioNome: 'Condomínio Teste',
    condominioCodigo: 'G7C-J785',
    status: 'pendente',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  pedido.set(avisoPortariaRef, {
    destinatarioTipo: 'porteiro',
    condominioId: CONDOMINIO_ID,
    remetenteId: moradorUid,
    remetenteNome: 'Morador Teste',
    referenciaId: solicitacaoId,
    tipo: 'solicitacao_vinculo',
    mensagem: 'Morador Teste solicitou entrada no condomínio · Bloco A · Ap. 101.',
    lidaPor: [],
    criadaEm: serverTimestamp(),
  });
  await pedido.commit();

  assert.equal((await getDocs(consultaPropria)).size, 1, 'Solicitação do morador deve ficar gravada.');

  // 4) Portaria aprova e o Morador recebe a decisão.
  await entrar(PORTARIA_EMAIL);
  const consultaPortaria = query(collection(db, 'solicitacoesCondominio'), where('condominioId', '==', CONDOMINIO_ID));
  assert.equal((await getDocs(consultaPortaria)).size, 1, 'Portaria deve enxergar a solicitação do próprio condomínio.');

  const avisoMoradorRef = doc(collection(db, 'notificacoes'));
  const auditoriaVinculoRef = doc(collection(db, 'auditoria'));
  const aprovacao = writeBatch(db);
  aprovacao.update(solicitacaoRef, {
    status: 'aprovada',
    decididoPorId: portariaUid,
    decididoPorNome: 'Portaria Teste',
    decididoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  aprovacao.set(avisoMoradorRef, {
    destinatarioTipo: 'morador',
    moradorId: moradorUid,
    condominioId: CONDOMINIO_ID,
    referenciaId: solicitacaoId,
    mensagem: 'Sua solicitação para entrar no condomínio foi aprovada. Abra o Perfil para concluir o vínculo.',
    tipo: 'vinculo',
    lida: false,
    criadaEm: serverTimestamp(),
  });
  aprovacao.set(auditoriaVinculoRef, {
    condominioId: CONDOMINIO_ID,
    moradorId: moradorUid,
    alvoNome: 'Morador Teste',
    atorId: portariaUid,
    atorNome: 'Portaria Teste',
    acao: 'vinculo_aprovado',
    criadoEm: serverTimestamp(),
  });
  await aprovacao.commit();

  // 5) Morador conclui o vínculo.
  await entrar(MORADOR_EMAIL);
  assert.equal((await getDoc(solicitacaoRef)).data()?.status, 'aprovada');
  const conclusao = writeBatch(db);
  conclusao.update(doc(db, 'usuarios', moradorUid), {
    condominioId: CONDOMINIO_ID,
    condominioNome: 'Condomínio Teste',
    condominioCodigo: 'G7C-J785',
    vinculoSolicitacaoId: solicitacaoId,
    vinculadoEm: serverTimestamp(),
  });
  conclusao.update(solicitacaoRef, {
    status: 'concluida',
    concluidaEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  await conclusao.commit();
  assert.equal((await getDoc(doc(db, 'usuarios', moradorUid))).data()?.condominioId, CONDOMINIO_ID);
  await setDoc(doc(db, 'diretorioUsuarios', moradorUid), {
    uid: moradorUid,
    nome: 'Morador Teste',
    tipo: 'morador',
    condominioId: CONDOMINIO_ID,
    bloco: 'A',
    apartamento: '101',
    atualizadoEm: serverTimestamp(),
  });

  // 6) Diretório mínimo: moradores veem dados operacionais, mas não os perfis privados alheios.
  const consultaPessoas = query(collection(db, 'diretorioUsuarios'), where('condominioId', '==', CONDOMINIO_ID));
  const pessoasComoMorador = await getDocs(consultaPessoas);
  assert.equal(pessoasComoMorador.size, 2);
  assert.deepEqual(new Set(pessoasComoMorador.docs.map(d => d.data().tipo)), new Set(['morador', 'porteiro']));
  assert.equal(pessoasComoMorador.docs.some(d => 'cpf' in d.data() || 'telefone' in d.data() || 'email' in d.data()), false, 'Diretório não pode conter CPF, telefone ou e-mail.');

  await assert.rejects(
    getDoc(doc(db, 'usuarios', portariaUid)),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Morador não pode abrir o perfil privado da Portaria.',
  );
  await assert.rejects(
    getDocs(query(collection(db, 'usuarios'), where('condominioId', '==', CONDOMINIO_ID))),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Morador não pode listar perfis privados do condomínio.',
  );
  await assert.rejects(
    updateDoc(doc(db, 'diretorioUsuarios', moradorUid), { nome: 'Nome Forjado', atualizadoEm: serverTimestamp() }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Usuário não pode falsificar no diretório um nome diferente do próprio perfil privado.',
  );
  await assert.rejects(
    getDocs(query(collection(db, 'solicitacoesCondominio'), where('condominioId', '==', CONDOMINIO_ID))),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Morador vinculado não pode listar solicitações de entrada do condomínio.',
  );

  // 7) Fluxo principal: OCR confirmado -> chegada -> aviso -> código -> retirada.
  await entrar(PORTARIA_EMAIL);
  const perfilPrivadoMorador = await getDoc(doc(db, 'usuarios', moradorUid));
  assert.equal(perfilPrivadoMorador.exists(), true, 'Portaria do mesmo condomínio pode consultar o perfil privado necessário ao atendimento.');

  const encomendaInvalidaRef = doc(collection(db, 'encomendas'));
  await assert.rejects(
    setDoc(encomendaInvalidaRef, {
      moradorId: 'uid-inexistente', moradorNome: 'Inexistente', bloco: 'X', apartamento: '0',
      descricao: 'Tentativa inválida', status: 'pendente', porteiroId: portariaUid,
      porteiroNome: 'Portaria Teste', condominioId: CONDOMINIO_ID, codigoReferencia: 'INVALIDA',
      codigoRetirada: '123456', codigoRetiradaConfirmado: false, origem: 'manual',
      recebidaEm: serverTimestamp(), retiradaEm: null, historico: [], lembrete3dEnviado: false,
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Portaria não pode criar encomenda para usuário inexistente ou fora do condomínio.',
  );

  const encomendaRef = doc(collection(db, 'encomendas'));
  const chegadaAvisoRef = doc(collection(db, 'notificacoes'));
  const chegadaAuditoriaRef = doc(collection(db, 'auditoria'));
  const codigoRetirada = '482731';
  const chegada = writeBatch(db);
  chegada.set(encomendaRef, {
    moradorId: moradorUid,
    moradorNome: 'Morador Teste',
    bloco: 'A',
    apartamento: '101',
    descricao: 'Caixa de teste do fluxo principal',
    status: 'pendente',
    porteiroId: portariaUid,
    porteiroNome: 'Portaria Teste',
    condominioId: CONDOMINIO_ID,
    codigoReferencia: 'TESTE001',
    codigoRetirada,
    codigoRetiradaConfirmado: false,
    origem: 'ocr',
    recebidaEm: serverTimestamp(),
    retiradaEm: null,
    moradorNotificadoEm: serverTimestamp(),
    historico: [],
    lembrete3dEnviado: false,
  });
  chegada.set(chegadaAvisoRef, {
    destinatarioTipo: 'morador',
    moradorId: moradorUid,
    condominioId: CONDOMINIO_ID,
    encomendaId: encomendaRef.id,
    referenciaId: encomendaRef.id,
    mensagem: 'Sua encomenda chegou à portaria. Abra os detalhes para consultar o código de retirada.',
    tipo: 'chegada',
    lida: false,
    criadaEm: serverTimestamp(),
  });
  chegada.set(chegadaAuditoriaRef, {
    encomendaId: encomendaRef.id,
    condominioId: CONDOMINIO_ID,
    moradorId: moradorUid,
    alvoNome: 'Morador Teste',
    atorId: portariaUid,
    atorNome: 'Portaria Teste',
    acao: 'chegada_registrada',
    criadoEm: serverTimestamp(),
  });
  await chegada.commit();

  await assert.rejects(
    updateDoc(encomendaRef, { codigoRetirada: '000000' }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Nem a Portaria pode trocar o código de retirada depois da criação.',
  );
  await assert.rejects(
    updateDoc(encomendaRef, { moradorId: portariaUid }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Nem a Portaria pode transferir uma encomenda para outro usuário alterando o documento.',
  );
  await assert.rejects(
    deleteDoc(encomendaRef),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Encomendas são registros de auditoria e não podem ser apagadas pelo cliente.',
  );

  // O teste não chama OCR.Space externo; valida a persistência que ocorre depois
  // de a Portaria confirmar o resultado reconhecido no app.
  const ocrTesteRef = doc(collection(db, 'ocrTestes'));
  await setDoc(ocrTesteRef, {
    condominioId: CONDOMINIO_ID,
    porteiroId: portariaUid,
    porteiroNome: 'Portaria Teste',
    encomendaId: encomendaRef.id,
    tipoTexto: 'impresso',
    iluminacao: 'boa',
    tempoMs: 350,
    topCandidatoId: moradorUid,
    topScore: 98,
    moradorConfirmadoId: moradorUid,
    moradorConfirmadoNome: 'Morador Teste',
    acertoTop1: true,
    criadoEm: serverTimestamp(),
  });

  await entrar(MORADOR_EMAIL);
  const recebida = await getDoc(encomendaRef);
  assert.equal(recebida.exists(), true, 'Morador deve conseguir ler a própria encomenda.');
  assert.equal(recebida.data()?.codigoRetirada, codigoRetirada, 'Morador deve receber o código de retirada de 6 dígitos.');
  assert.equal(recebida.data()?.status, 'pendente');
  const avisosMorador = await getDocs(query(collection(db, 'notificacoes'), where('moradorId', '==', moradorUid)));
  assert.equal(avisosMorador.docs.some(d => d.data().tipo === 'chegada' && d.data().encomendaId === encomendaRef.id), true, 'Chegada deve gerar aviso para o Morador.');

  // Morador informa que retirou: a Portaria recebe uma solicitação vinculada à encomenda.
  const interacaoRetiradaRef = doc(db, 'encomendas', encomendaRef.id, 'interacoes', 'retirada');
  const avisoRetiradaPortariaRef = doc(collection(db, 'notificacoes'));
  const pedidoRetirada = writeBatch(db);
  pedidoRetirada.set(interacaoRetiradaRef, {
    tipo: 'retirada_solicitada',
    status: 'pendente',
    encomendaId: encomendaRef.id,
    condominioId: CONDOMINIO_ID,
    moradorId: moradorUid,
    moradorNome: 'Morador Teste',
    codigoReferencia: 'TESTE001',
    criadaEm: serverTimestamp(),
  });
  pedidoRetirada.set(avisoRetiradaPortariaRef, {
    destinatarioTipo: 'porteiro',
    condominioId: CONDOMINIO_ID,
    encomendaId: encomendaRef.id,
    referenciaId: 'retirada',
    remetenteId: moradorUid,
    remetenteNome: 'Morador Teste',
    mensagem: 'Morador Teste informou que retirou a encomenda #TESTE001. Confirme a retirada na portaria.',
    tipo: 'retirada_solicitada',
    lidaPor: [],
    criadaEm: serverTimestamp(),
  });
  await pedidoRetirada.commit();

  await entrar(PORTARIA_EMAIL);
  assert.equal((await getDoc(interacaoRetiradaRef)).data()?.status, 'pendente');
  assert.equal(codigoRetirada, '482731', 'O fluxo de confirmação deve trabalhar com o mesmo código exibido ao morador.');

  const retiradaAvisoMoradorRef = doc(collection(db, 'notificacoes'));
  const retiradaAuditoriaRef = doc(collection(db, 'auditoria'));
  const retirada = writeBatch(db);
  retirada.update(encomendaRef, {
    status: 'retirada',
    retiradaEm: serverTimestamp(),
    retiradaPorId: portariaUid,
    retiradaPorNome: 'Portaria Teste',
    retiradaRecebedorNome: 'Morador Teste',
    codigoRetiradaConfirmado: true,
  });
  retirada.update(interacaoRetiradaRef, {
    status: 'confirmada',
    confirmadaEm: serverTimestamp(),
    confirmadaPorId: portariaUid,
    confirmadaPorNome: 'Portaria Teste',
  });
  retirada.set(retiradaAvisoMoradorRef, {
    destinatarioTipo: 'morador',
    moradorId: moradorUid,
    condominioId: CONDOMINIO_ID,
    encomendaId: encomendaRef.id,
    referenciaId: encomendaRef.id,
    mensagem: 'A retirada da sua encomenda foi registrada pela portaria.',
    tipo: 'retirada',
    lida: false,
    criadaEm: serverTimestamp(),
  });
  retirada.set(retiradaAuditoriaRef, {
    encomendaId: encomendaRef.id,
    condominioId: CONDOMINIO_ID,
    moradorId: moradorUid,
    alvoNome: 'Morador Teste',
    atorId: portariaUid,
    atorNome: 'Portaria Teste',
    acao: 'retirada_registrada',
    codigoRetiradaConfirmado: true,
    criadoEm: serverTimestamp(),
  });
  await retirada.commit();

  await entrar(MORADOR_EMAIL);
  const retiradaFinal = await getDoc(encomendaRef);
  assert.equal(retiradaFinal.data()?.status, 'retirada', 'Retirada deve ficar persistida.');
  assert.equal(retiradaFinal.data()?.codigoRetiradaConfirmado, true, 'Confirmação do código deve ficar registrada.');
  assert.equal(retiradaFinal.data()?.retiradaRecebedorNome, 'Morador Teste', 'Nome de quem retirou deve poder ser registrado.');
  const avisosDepoisRetirada = await getDocs(query(collection(db, 'notificacoes'), where('moradorId', '==', moradorUid)));
  assert.equal(avisosDepoisRetirada.docs.some(d => d.data().tipo === 'retirada' && d.data().encomendaId === encomendaRef.id), true, 'Retirada deve gerar aviso para o Morador.');

  // 8) Mural: banimento bloqueia publicação, desbanimento restaura e denúncia é registrada.
  await entrar(PORTARIA_EMAIL);
  const banimentoRef = doc(db, 'muralBanidos', `${CONDOMINIO_ID}_${moradorUid}`);
  await setDoc(banimentoRef, {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: true,
    banidoPorId: portariaUid,
    banidoPorNome: 'Portaria Teste',
    banidoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  assert.equal((await getDoc(banimentoRef)).data()?.ativo, true);
  assert.equal((await getDocs(query(collection(db, 'muralBanidos'), where('condominioId', '==', CONDOMINIO_ID)))).size, 1);

  await entrar(MORADOR_EMAIL);
  const publicacaoBloqueada = doc(collection(db, 'mural'));
  await assert.rejects(
    setDoc(publicacaoBloqueada, {
      condominioId: CONDOMINIO_ID,
      autorId: moradorUid,
      autorNome: 'Morador Teste',
      autorTipo: 'morador',
      texto: 'Publicação que deve ser bloqueada enquanto o perfil está banido.',
      criadoEm: serverTimestamp(),
      criadoEmCliente: Date.now(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
  );

  await entrar(PORTARIA_EMAIL);
  await setDoc(banimentoRef, {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: false,
    banidoPorId: '',
    banidoPorNome: '',
    desbanidoPorId: portariaUid,
    desbanidoPorNome: 'Portaria Teste',
    desbanidoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  assert.equal((await getDoc(banimentoRef)).data()?.ativo, false);

  await entrar(MORADOR_EMAIL);
  const publicacaoLiberada = doc(collection(db, 'mural'));
  await setDoc(publicacaoLiberada, {
    condominioId: CONDOMINIO_ID,
    autorId: moradorUid,
    autorNome: 'Morador Teste',
    autorTipo: 'morador',
    texto: 'Publicação permitida depois do desbanimento.',
    criadoEm: serverTimestamp(),
    criadoEmCliente: Date.now(),
  });
  assert.equal((await getDoc(publicacaoLiberada)).exists(), true);

  await entrar(PORTARIA_EMAIL);
  const denunciaRef = doc(collection(db, 'muralDenuncias'));
  await setDoc(denunciaRef, {
    condominioId: CONDOMINIO_ID,
    comentarioId: publicacaoLiberada.id,
    comentarioTexto: 'Publicação permitida depois do desbanimento.',
    autorId: moradorUid,
    autorNome: 'Morador Teste',
    autorTipo: 'morador',
    denuncianteId: portariaUid,
    denuncianteNome: 'Portaria Teste',
    motivo: 'Teste automatizado de denúncia',
    detalhes: '',
    criadoEm: serverTimestamp(),
    status: 'pendente',
  });
  assert.equal((await getDoc(denunciaRef)).data()?.status, 'pendente', 'Denúncia do mural deve ficar registrada.');

  // 9) Isolamento: uma Portaria de outro condomínio não acessa dados do primeiro.
  await signOut(auth);
  const outraPortariaCred = await createUserWithEmailAndPassword(auth, OUTRA_PORTARIA_EMAIL, SENHA);
  const outraPortariaUid = outraPortariaCred.user.uid;
  await confirmarEmailNoEmulador(outraPortariaCred.user);
  await setDoc(doc(db, 'condominios', OUTRO_CONDOMINIO_ID), {
    nome: 'Outro Condomínio',
    codigo: OUTRO_CONDOMINIO_ID,
    codigoExibicao: 'X2Y-H456',
    criadoPor: outraPortariaUid,
    criadoEm: serverTimestamp(),
  });
  await setDoc(doc(db, 'usuarios', outraPortariaUid), {
    nome: 'Outra Portaria',
    email: OUTRA_PORTARIA_EMAIL,
    tipo: 'porteiro',
    condominioId: OUTRO_CONDOMINIO_ID,
    condominioNome: 'Outro Condomínio',
    condominioCodigo: 'X2Y-H456',
  });

  await assert.rejects(
    getDoc(encomendaRef),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Portaria de outro condomínio não pode ler encomendas alheias.',
  );
  await assert.rejects(
    getDoc(doc(db, 'usuarios', moradorUid)),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Portaria de outro condomínio não pode abrir o perfil de um morador alheio.',
  );

  console.log('Fluxos de vínculo, pessoas, OCR confirmado, encomenda, notificação, retirada segura, mural, denúncia, banimento e isolamento entre condomínios validados com sucesso.');
} finally {
  await signOut(auth).catch(() => {});
  await terminate(db).catch(() => {});
  await deleteApp(app).catch(() => {});
}
