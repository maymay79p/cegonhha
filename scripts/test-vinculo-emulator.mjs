import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  where,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-cegonha';
const CONDOMINIO_ID = 'G7CJ785';
const SENHA = 'Teste123!';
const PORTARIA_EMAIL = 'portaria-vinculo@cegonha.test';
const MORADOR_EMAIL = 'morador-vinculo@cegonha.test';

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

try {
  // 1) Portaria cria o condomínio e seu próprio perfil.
  const portariaCred = await createUserWithEmailAndPassword(auth, PORTARIA_EMAIL, SENHA);
  const portariaUid = portariaCred.user.uid;
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

  // 2) Uma conta nova de morador nasce sem condomínio.
  await signOut(auth);
  const moradorCred = await createUserWithEmailAndPassword(auth, MORADOR_EMAIL, SENHA);
  const moradorUid = moradorCred.user.uid;
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

  const solicitacaoId = `${moradorUid}_${CONDOMINIO_ID}`;
  const solicitacaoRef = doc(db, 'solicitacoesCondominio', solicitacaoId);

  // Este era o bug: getDoc() no ID ainda inexistente não consegue provar
  // ownership pelas regras e deve ser bloqueado. O aplicativo não pode depender dele.
  await assert.rejects(
    getDoc(solicitacaoRef),
    erro => String(erro?.code || '').includes('permission-denied'),
    'O get direto de uma solicitação inexistente deveria ser negado pelas regras.',
  );

  // A forma correta para a primeira tentativa é consultar apenas documentos do
  // próprio morador. A consulta vazia precisa ser permitida.
  const consultaPropria = query(
    collection(db, 'solicitacoesCondominio'),
    where('moradorId', '==', moradorUid),
  );
  const antes = await getDocs(consultaPropria);
  assert.equal(antes.empty, true, 'Conta nova deve conseguir consultar suas próprias solicitações sem permission-denied.');

  // 3) Morador envia a solicitação e, no mesmo batch, avisa a Portaria.
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

  const depois = await getDocs(consultaPropria);
  assert.equal(depois.size, 1, 'Solicitação do morador deve ficar gravada.');
  assert.equal(depois.docs[0].data().status, 'pendente');

  // 4) Portaria enxerga e aprova a solicitação, notificando o morador.
  await entrar(PORTARIA_EMAIL);
  const consultaPortaria = query(
    collection(db, 'solicitacoesCondominio'),
    where('condominioId', '==', CONDOMINIO_ID),
  );
  const recebidas = await getDocs(consultaPortaria);
  assert.equal(recebidas.size, 1, 'Portaria deve enxergar a solicitação do próprio condomínio.');

  const avisoMoradorRef = doc(collection(db, 'notificacoes'));
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
  await aprovacao.commit();

  // 5) Morador conclui o vínculo; perfil e solicitação mudam juntos.
  await entrar(MORADOR_EMAIL);
  const aprovada = await getDoc(solicitacaoRef);
  assert.equal(aprovada.data()?.status, 'aprovada');

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

  const perfilFinal = await getDoc(doc(db, 'usuarios', moradorUid));
  const solicitacaoFinal = await getDoc(solicitacaoRef);
  assert.equal(perfilFinal.data()?.condominioId, CONDOMINIO_ID, 'Perfil do morador deve ficar vinculado ao condomínio.');
  assert.equal(solicitacaoFinal.data()?.status, 'concluida', 'Solicitação deve terminar como concluída.');

  // 6) A nova tela Pessoas usa exatamente esta consulta: somente usuários do
  // condomínio atual. Morador e Portaria devem conseguir ler a mesma lista.
  const consultaPessoas = query(
    collection(db, 'usuarios'),
    where('condominioId', '==', CONDOMINIO_ID),
  );
  const pessoasComoMorador = await getDocs(consultaPessoas);
  assert.equal(pessoasComoMorador.size, 2, 'Morador vinculado deve enxergar moradores e portaria do próprio condomínio.');
  assert.deepEqual(
    new Set(pessoasComoMorador.docs.map(d => d.data().tipo)),
    new Set(['morador', 'porteiro']),
    'Lista do condomínio deve conter os dois perfis ativos vinculados.',
  );

  await entrar(PORTARIA_EMAIL);
  const pessoasComoPortaria = await getDocs(consultaPessoas);
  assert.equal(pessoasComoPortaria.size, 2, 'Portaria deve enxergar a lista de usuários do próprio condomínio.');

  console.log('Fluxo de vínculo e lista de pessoas Morador ↔ Portaria validados com sucesso no Firestore Emulator.');
} finally {
  await signOut(auth).catch(() => {});
  await terminate(db).catch(() => {});
  await deleteApp(app).catch(() => {});
}
