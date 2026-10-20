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
  // Este teste roda logo depois de test-vinculo-emulator.mjs no mesmo emulador,
  // reaproveitando os perfis e o condomínio já criados por aquele fluxo.
  const portaria = await entrar(PORTARIA_EMAIL);
  const portariaUid = portaria.user.uid;
  const pessoasSnap = await getDocs(query(collection(db, 'usuarios'), where('condominioId', '==', CONDOMINIO_ID)));
  const moradorDoc = pessoasSnap.docs.find(item => item.data()?.tipo === 'morador');
  assert.ok(moradorDoc, 'O fluxo base precisa deixar um morador vinculado ao condomínio.');
  const moradorUid = moradorDoc.id;

  // 1) Banimento: dados privados continuam restritos, mas o status público pode
  // ser consultado pelos moradores do mesmo condomínio.
  const banId = `${CONDOMINIO_ID}_${moradorUid}`;
  const banBatch = writeBatch(db);
  banBatch.set(doc(db, 'muralBanidos', banId), {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: true,
    banidoPorId: portariaUid,
    banidoPorNome: 'Portaria Teste',
    atualizadoEm: serverTimestamp(),
    banidoEm: serverTimestamp(),
  }, { merge: true });
  banBatch.set(doc(db, 'muralBanimentosPublicos', banId), {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: true,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  await banBatch.commit();

  await entrar(MORADOR_EMAIL);
  const banPublico = await getDoc(doc(db, 'muralBanimentosPublicos', banId));
  assert.equal(banPublico.exists(), true, 'Morador deve conseguir ver o status público de banimento.');
  assert.equal(banPublico.data()?.ativo, true);
  assert.equal(banPublico.data()?.banidoPorId, undefined, 'Status público não deve expor o moderador responsável.');
  await assert.rejects(
    getDocs(query(collection(db, 'muralBanidos'), where('condominioId', '==', CONDOMINIO_ID))),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Morador não deve listar documentos privados de moderação.',
  );

  // Reabilita o morador para validar o fluxo de resposta no mural.
  await entrar(PORTARIA_EMAIL);
  const unban = writeBatch(db);
  unban.set(doc(db, 'muralBanidos', banId), {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: false,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  unban.set(doc(db, 'muralBanimentosPublicos', banId), {
    usuarioId: moradorUid,
    usuarioNome: 'Morador Teste',
    condominioId: CONDOMINIO_ID,
    ativo: false,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  await unban.commit();

  // 2) Resposta específica: o comentário de resposta e a notificação destinada
  // ao autor original precisam ser aceitos no mesmo batch.
  await entrar(MORADOR_EMAIL);
  const originalRef = doc(collection(db, 'mural'));
  await setDoc(originalRef, {
    condominioId: CONDOMINIO_ID,
    autorId: moradorUid,
    autorNome: 'Morador Teste',
    autorTipo: 'morador',
    texto: 'Alguém recebeu uma encomenda da Loja Exemplo?',
    criadoEm: serverTimestamp(),
    criadoEmCliente: Date.now(),
  });

  await entrar(PORTARIA_EMAIL);
  const respostaRef = doc(collection(db, 'mural'));
  const avisoRespostaRef = doc(collection(db, 'notificacoes'));
  const resposta = writeBatch(db);
  resposta.set(respostaRef, {
    condominioId: CONDOMINIO_ID,
    autorId: portariaUid,
    autorNome: 'Portaria Teste',
    autorTipo: 'porteiro',
    texto: 'Sim. Há uma encomenda aguardando retirada.',
    respostaParaId: originalRef.id,
    respostaParaAutorId: moradorUid,
    respostaParaAutorNome: 'Morador Teste',
    respostaParaAutorTipo: 'morador',
    respostaParaTexto: 'Alguém recebeu uma encomenda da Loja Exemplo?',
    criadoEm: serverTimestamp(),
    criadoEmCliente: Date.now(),
  });
  resposta.set(avisoRespostaRef, {
    condominioId: CONDOMINIO_ID,
    destinatarioId: moradorUid,
    destinatarioTipo: 'morador',
    moradorId: moradorUid,
    lida: false,
    remetenteId: portariaUid,
    remetenteNome: 'Portaria Teste',
    referenciaId: respostaRef.id,
    muralOriginalId: originalRef.id,
    tipo: 'resposta_mural',
    mensagem: 'Portaria Teste respondeu sua publicação no mural.',
    criadaEm: serverTimestamp(),
  });
  await resposta.commit();

  await entrar(MORADOR_EMAIL);
  const respostaSalva = await getDoc(respostaRef);
  assert.equal(respostaSalva.data()?.respostaParaId, originalRef.id);
  const respostasRecebidas = await getDocs(query(collection(db, 'notificacoes'), where('moradorId', '==', moradorUid)));
  assert.equal(
    respostasRecebidas.docs.some(item => item.id === avisoRespostaRef.id && item.data()?.tipo === 'resposta_mural'),
    true,
    'Autor original deve receber uma notificação específica da resposta.',
  );

  // 3) Unicidade: uma reserva de CPF/telefone não pode ser tomada por outra conta.
  // O identificador real é um hash SHA-256; aqui usamos uma chave sintética para
  // testar a garantia das regras sem registrar dado pessoal no fixture.
  const cpfKey = 'cpf_teste_unicidade_regra';
  const telefoneKey = 'telefone_teste_unicidade_regra';
  await setDoc(doc(db, 'identificadoresUsuarios', cpfKey), {
    uid: moradorUid,
    tipo: 'cpf',
    chave: cpfKey,
    atualizadoEm: serverTimestamp(),
  });
  await setDoc(doc(db, 'identificadoresUsuarios', telefoneKey), {
    uid: moradorUid,
    tipo: 'telefone',
    chave: telefoneKey,
    atualizadoEm: serverTimestamp(),
  });

  await entrar(PORTARIA_EMAIL);
  await assert.rejects(
    setDoc(doc(db, 'identificadoresUsuarios', cpfKey), {
      uid: portariaUid,
      tipo: 'cpf',
      chave: cpfKey,
      atualizadoEm: serverTimestamp(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Outra conta não pode reutilizar uma reserva de CPF.',
  );
  await assert.rejects(
    setDoc(doc(db, 'identificadoresUsuarios', telefoneKey), {
      uid: portariaUid,
      tipo: 'telefone',
      chave: telefoneKey,
      atualizadoEm: serverTimestamp(),
    }),
    erro => String(erro?.code || '').includes('permission-denied'),
    'Outra conta não pode reutilizar uma reserva de telefone.',
  );

  // 4) Firebase Auth mantém e-mail único globalmente.
  await assert.rejects(
    createUserWithEmailAndPassword(auth, MORADOR_EMAIL, SENHA),
    erro => String(erro?.code || '').includes('email-already-in-use'),
    'Firebase Auth deve rejeitar um segundo cadastro com o mesmo e-mail.',
  );

  console.log('Respostas do mural, notificação direcionada, banimentos públicos e unicidade de cadastro validados com sucesso.');
} finally {
  await signOut(auth).catch(() => {});
  await terminate(db).catch(() => {});
  await deleteApp(app).catch(() => {});
}
