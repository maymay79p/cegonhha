import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
}, 'comunidade-seguranca');
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function entrar(email) {
  await signOut(auth).catch(() => {});
  return signInWithEmailAndPassword(auth, email, SENHA);
}

try {
  const portariaCred = await entrar(PORTARIA_EMAIL);
  const portariaUid = portariaCred.user.uid;
  const moradorUid = (await entrar(MORADOR_EMAIL)).user.uid;

  // 1) Um identificador reservado por uma conta não pode ser tomado por outra.
  await entrar(PORTARIA_EMAIL);
  const identificadorRef = doc(db, 'identificadoresUsuarios', 'cpf_hash_teste_automatizado');
  await setDoc(identificadorRef, {
    uid: portariaUid,
    tipo: 'cpf',
    chave: 'cpf_hash_teste_automatizado',
    atualizadoEm: serverTimestamp(),
  });

  await entrar(MORADOR_EMAIL);
  await assert.rejects(
    setDoc(identificadorRef, {
      uid: moradorUid,
      tipo: 'cpf',
      chave: 'cpf_hash_teste_automatizado',
      atualizadoEm: serverTimestamp(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Outra conta não deve conseguir reutilizar um CPF/telefone já reservado.',
  );

  // 2) O estado público de banimento é visível aos moradores, sem dados internos da moderação.
  await entrar(PORTARIA_EMAIL);
  const banPublicoRef = doc(db, 'muralBanimentosPublicos', `${CONDOMINIO_ID}_${moradorUid}`);
  await setDoc(banPublicoRef, {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: true,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });

  await entrar(MORADOR_EMAIL);
  const banimentosVisiveis = await getDocs(query(
    collection(db, 'muralBanimentosPublicos'),
    where('condominioId', '==', CONDOMINIO_ID),
  ));
  const banPublico = banimentosVisiveis.docs.find(item => item.data().usuarioId === moradorUid)?.data();
  assert.equal(banPublico?.ativo, true, 'Morador deve conseguir enxergar quem está banido no mural.');
  assert.equal('banidoPorId' in (banPublico || {}), false, 'Estado público não deve expor quem aplicou o banimento.');

  await entrar(PORTARIA_EMAIL);
  await setDoc(banPublicoRef, {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: false,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });

  // 3) Responder uma publicação cria uma nova mensagem ligada à original e avisa somente o destinatário.
  const originalRef = doc(collection(db, 'mural'));
  await setDoc(originalRef, {
    condominioId: CONDOMINIO_ID,
    autorId: portariaUid,
    autorNome: 'Portaria Teste',
    autorTipo: 'porteiro',
    texto: 'Mensagem original da Portaria para validar respostas específicas.',
    criadoEm: serverTimestamp(),
    criadoEmCliente: Date.now(),
  });

  await entrar(MORADOR_EMAIL);
  const respostaRef = doc(collection(db, 'mural'));
  const notificacaoRef = doc(collection(db, 'notificacoes'));
  const resposta = writeBatch(db);
  resposta.set(respostaRef, {
    condominioId: CONDOMINIO_ID,
    autorId: moradorUid,
    autorNome: 'Morador Teste',
    autorTipo: 'morador',
    texto: 'Esta resposta é dirigida especificamente à mensagem da Portaria.',
    respostaParaId: originalRef.id,
    respostaParaAutorId: portariaUid,
    respostaParaAutorNome: 'Portaria Teste',
    respostaParaAutorTipo: 'porteiro',
    respostaParaTexto: 'Mensagem original da Portaria para validar respostas específicas.',
    criadoEm: serverTimestamp(),
    criadoEmCliente: Date.now(),
  });
  resposta.set(notificacaoRef, {
    condominioId: CONDOMINIO_ID,
    destinatarioId: portariaUid,
    destinatarioTipo: 'porteiro',
    remetenteId: moradorUid,
    remetenteNome: 'Morador Teste',
    referenciaId: respostaRef.id,
    muralOriginalId: originalRef.id,
    tipo: 'resposta_mural',
    mensagem: 'Morador Teste respondeu sua publicação.',
    lidaPor: [],
    criadaEm: serverTimestamp(),
  });
  await resposta.commit();

  const respostaSalva = await getDoc(respostaRef);
  assert.equal(respostaSalva.data()?.respostaParaId, originalRef.id, 'Resposta deve preservar a referência da mensagem respondida.');

  const respostaForjadaRef = doc(collection(db, 'mural'));
  await assert.rejects(
    setDoc(respostaForjadaRef, {
      condominioId: CONDOMINIO_ID,
      autorId: moradorUid,
      autorNome: 'Morador Teste',
      autorTipo: 'morador',
      texto: 'Tentativa de resposta com autor de destino adulterado.',
      respostaParaId: originalRef.id,
      respostaParaAutorId: moradorUid,
      criadoEm: serverTimestamp(),
      criadoEmCliente: Date.now(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Nao deve ser possivel fabricar uma resposta para um autor diferente do autor da publicacao original.',
  );

  const denunciaForjadaRef = doc(collection(db, 'muralDenuncias'));
  await assert.rejects(
    setDoc(denunciaForjadaRef, {
      condominioId: CONDOMINIO_ID,
      comentarioId: originalRef.id,
      comentarioTexto: 'Texto adulterado',
      autorId: portariaUid,
      autorNome: 'Portaria Teste',
      autorTipo: 'porteiro',
      denuncianteId: moradorUid,
      denuncianteNome: 'Morador Teste',
      motivo: 'Outro motivo',
      detalhes: '',
      criadoEm: serverTimestamp(),
      status: 'pendente',
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'A denuncia precisa refletir a publicacao real e nao pode carregar texto adulterado.',
  );

  await entrar(PORTARIA_EMAIL);
  const avisosPortaria = await getDocs(query(
    collection(db, 'notificacoes'),
    where('condominioId', '==', CONDOMINIO_ID),
    where('destinatarioTipo', '==', 'porteiro'),
  ));
  assert.equal(
    avisosPortaria.docs.some(item => item.data().tipo === 'resposta_mural' && item.data().destinatarioId === portariaUid && item.data().referenciaId === respostaRef.id),
    true,
    'Pessoa respondida deve receber notificação vinculada à resposta.',
  );

  console.log('Unicidade de identificadores, banimentos públicos e respostas específicas do mural validados com sucesso.');
} finally {
  await signOut(auth).catch(() => {});
  await terminate(db).catch(() => {});
  await deleteApp(app).catch(() => {});
}
