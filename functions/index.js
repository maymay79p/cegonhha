'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { dividirEmLotes, montarMensagens, tokenExpoValido } = require('./push');
const { deveEnviarLembrete, authRecente, anonimizarHistorico } = require('./maintenance');

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CONTA_REMOVIDA_ID = 'conta_removida';
const CONTA_REMOVIDA_NOME = 'Conta removida';

async function buscarDispositivos(notificacao) {
  let snapshot;
  if (notificacao.destinatarioTipo === 'porteiro') {
    if (!notificacao.condominioId) return [];
    snapshot = await db.collection('pushDispositivos').where('condominioId', '==', notificacao.condominioId).get();
    return snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(item => item.tipo === 'porteiro' && item.ativo !== false && tokenExpoValido(item.token));
  }

  if (!notificacao.moradorId) return [];
  snapshot = await db.collection('pushDispositivos').where('uid', '==', notificacao.moradorId).get();
  return snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .filter(item => item.ativo !== false && tokenExpoValido(item.token));
}

async function enviarLote(mensagens, dispositivos) {
  const resposta = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mensagens),
  });

  if (!resposta.ok) throw new Error(`Expo Push Service respondeu HTTP ${resposta.status}.`);

  const corpo = await resposta.json();
  const tickets = Array.isArray(corpo?.data) ? corpo.data : [corpo?.data].filter(Boolean);
  const exclusoes = [];
  let enviados = 0;

  tickets.forEach((ticket, indice) => {
    if (ticket?.status === 'ok') enviados += 1;
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      const dispositivo = dispositivos[indice];
      if (dispositivo?.id) exclusoes.push(db.collection('pushDispositivos').doc(dispositivo.id).delete());
    }
  });

  if (exclusoes.length) await Promise.allSettled(exclusoes);
  return enviados;
}

exports.enviarPushDaNotificacao = onDocumentCreated({
  document: 'notificacoes/{notificacaoId}',
  retry: true,
  timeoutSeconds: 60,
  memory: '256MiB',
}, async event => {
  if (!event.data) return;

  const notificacaoRef = event.data.ref;
  const atual = await notificacaoRef.get();
  if (!atual.exists) return;

  const notificacao = atual.data() || {};
  if (notificacao.pushStatus === 'enviado' || notificacao.pushStatus === 'sem_dispositivos') return;

  const dispositivos = await buscarDispositivos(notificacao);
  const mensagens = montarMensagens(notificacao, dispositivos, event.params.notificacaoId);

  if (!mensagens.length) {
    await notificacaoRef.update({
      pushStatus: 'sem_dispositivos',
      pushEnviados: 0,
      pushProcessadoEm: FieldValue.serverTimestamp(),
    });
    return;
  }

  const lotesMensagens = dividirEmLotes(mensagens, 100);
  const lotesDispositivos = dividirEmLotes(dispositivos, 100);
  let totalEnviados = 0;

  for (let i = 0; i < lotesMensagens.length; i += 1) {
    totalEnviados += await enviarLote(lotesMensagens[i], lotesDispositivos[i]);
  }

  await notificacaoRef.update({
    pushStatus: 'enviado',
    pushEnviados: totalEnviados,
    pushProcessadoEm: FieldValue.serverTimestamp(),
  });

  logger.info('Push do Cegonha processado.', {
    notificacaoId: event.params.notificacaoId,
    tipo: notificacao.tipo || 'aviso',
    destinatarioTipo: notificacao.destinatarioTipo || 'morador',
    dispositivos: dispositivos.length,
    enviados: totalEnviados,
  });
});

exports.enviarLembretesTresDias = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'America/Sao_Paulo',
  retryCount: 2,
  timeoutSeconds: 300,
  memory: '256MiB',
}, async () => {
  const pendentes = await db.collection('encomendas').where('status', '==', 'pendente').get();
  let enviados = 0;

  for (const docSnap of pendentes.docs) {
    if (!deveEnviarLembrete(docSnap.data())) continue;

    const notificacaoRef = db.collection('notificacoes').doc();
    const auditoriaRef = db.collection('auditoria').doc();
    const resultado = await db.runTransaction(async transaction => {
      const atualSnap = await transaction.get(docSnap.ref);
      if (!atualSnap.exists) return false;
      const atual = atualSnap.data() || {};
      if (!deveEnviarLembrete(atual)) return false;

      transaction.update(docSnap.ref, {
        lembrete3dEnviado: true,
        historico: FieldValue.arrayUnion({
          tipo: 'lembrete',
          titulo: 'Lembrete de retirada enviado automaticamente',
          data: new Date().toISOString(),
          atorId: 'sistema',
          atorNome: 'Cegonha',
        }),
      });
      transaction.set(notificacaoRef, {
        destinatarioTipo: 'morador',
        moradorId: String(atual.moradorId || ''),
        condominioId: String(atual.condominioId || ''),
        encomendaId: docSnap.id,
        referenciaId: docSnap.id,
        mensagem: 'Sua encomenda está há mais de 3 dias aguardando retirada na portaria.',
        tipo: 'lembrete',
        lida: false,
        criadaEm: FieldValue.serverTimestamp(),
      });
      transaction.set(auditoriaRef, {
        encomendaId: docSnap.id,
        condominioId: String(atual.condominioId || ''),
        moradorId: String(atual.moradorId || ''),
        alvoNome: String(atual.moradorNome || ''),
        atorId: 'sistema',
        atorNome: 'Cegonha',
        acao: 'lembrete_3_dias_automatico',
        detalhe: 'Lembrete automático de retirada enviado ao morador',
        criadoEm: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (resultado) enviados += 1;
  }

  logger.info('Rotina de lembrete de 3 dias concluída.', { pendentes: pendentes.size, enviados });
});

async function documentosPorCampo(nomeColecao, campo, valor) {
  return db.collection(nomeColecao).where(campo, '==', valor).get();
}

async function aplicarEmLotes(documentos, callback, limite = 350) {
  const lista = Array.from(documentos || []);
  for (let inicio = 0; inicio < lista.length; inicio += limite) {
    const batch = db.batch();
    lista.slice(inicio, inicio + limite).forEach(item => callback(batch, item));
    await batch.commit();
  }
}

async function apagarConsulta(nomeColecao, campo, uid) {
  const snap = await documentosPorCampo(nomeColecao, campo, uid);
  await aplicarEmLotes(snap.docs, (batch, item) => batch.delete(item.ref));
  return snap.size;
}

async function atualizarConsulta(nomeColecao, campo, uid, dadosOuFuncao) {
  const snap = await documentosPorCampo(nomeColecao, campo, uid);
  await aplicarEmLotes(snap.docs, (batch, item) => {
    const dados = typeof dadosOuFuncao === 'function' ? dadosOuFuncao(item.data(), item) : dadosOuFuncao;
    batch.update(item.ref, dados);
  });
  return snap.size;
}

async function anonimizarEncomendas(uid) {
  const comoMorador = await documentosPorCampo('encomendas', 'moradorId', uid);
  await aplicarEmLotes(comoMorador.docs, (batch, item) => {
    const dados = item.data() || {};
    batch.update(item.ref, {
      moradorId: CONTA_REMOVIDA_ID,
      moradorNome: CONTA_REMOVIDA_NOME,
      bloco: '',
      apartamento: '',
      retiradaRecebedorNome: dados.retiradaRecebedorNome ? CONTA_REMOVIDA_NOME : '',
      historico: anonimizarHistorico(dados.historico, uid, CONTA_REMOVIDA_NOME),
    });
  });

  const comoPortaria = await documentosPorCampo('encomendas', 'porteiroId', uid);
  await aplicarEmLotes(comoPortaria.docs, (batch, item) => {
    const dados = item.data() || {};
    batch.update(item.ref, {
      porteiroId: CONTA_REMOVIDA_ID,
      porteiroNome: CONTA_REMOVIDA_NOME,
      historico: anonimizarHistorico(dados.historico, uid, CONTA_REMOVIDA_NOME),
    });
  });

  const retiradas = await documentosPorCampo('encomendas', 'retiradaPorId', uid);
  await aplicarEmLotes(retiradas.docs, (batch, item) => {
    const dados = item.data() || {};
    batch.update(item.ref, {
      retiradaPorId: CONTA_REMOVIDA_ID,
      retiradaPorNome: CONTA_REMOVIDA_NOME,
      historico: anonimizarHistorico(dados.historico, uid, CONTA_REMOVIDA_NOME),
    });
  });
}

async function anonimizarInteracoes(uid) {
  const snap = await db.collectionGroup('interacoes').where('moradorId', '==', uid).get();
  await aplicarEmLotes(snap.docs, (batch, item) => batch.update(item.ref, {
    moradorId: CONTA_REMOVIDA_ID,
    moradorNome: CONTA_REMOVIDA_NOME,
  }));
}

async function garantirPortariaSubstituta(perfil, uid) {
  if (perfil?.tipo !== 'porteiro' || !perfil?.condominioId) return null;
  const snap = await db.collection('usuarios').where('condominioId', '==', perfil.condominioId).get();
  const substituta = snap.docs.find(item => item.id !== uid && item.data()?.tipo === 'porteiro');
  if (!substituta) {
    throw new HttpsError('failed-precondition', 'Esta é a última conta da Portaria do condomínio. Vincule outra Portaria antes de excluir esta conta.');
  }
  return substituta;
}

exports.excluirMinhaConta = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Entre novamente para excluir sua conta.');
  if (!authRecente(request.auth?.token?.auth_time)) {
    throw new HttpsError('failed-precondition', 'Por segurança, faça login novamente e repita a exclusão da conta.');
  }

  const usuarioRef = db.collection('usuarios').doc(uid);
  const usuarioSnap = await usuarioRef.get();
  const perfil = usuarioSnap.exists ? (usuarioSnap.data() || {}) : {};
  const portariaSubstituta = await garantirPortariaSubstituta(perfil, uid);

  if (portariaSubstituta && perfil.condominioId) {
    const condominioRef = db.collection('condominios').doc(perfil.condominioId);
    const condominioSnap = await condominioRef.get();
    if (condominioSnap.exists && condominioSnap.data()?.criadoPor === uid) {
      await condominioRef.update({ criadoPor: portariaSubstituta.id, atualizadoEm: FieldValue.serverTimestamp() });
    }
  }

  await Promise.all([
    apagarConsulta('identificadoresUsuarios', 'uid', uid),
    apagarConsulta('pushDispositivos', 'uid', uid),
    apagarConsulta('previsoes', 'moradorId', uid),
    apagarConsulta('solicitacoesCondominio', 'moradorId', uid),
    apagarConsulta('muralBanidos', 'usuarioId', uid),
    apagarConsulta('muralBanimentosPublicos', 'usuarioId', uid),
    apagarConsulta('notificacoes', 'moradorId', uid),
  ]);

  await apagarConsulta('notificacoes', 'destinatarioId', uid);
  await atualizarConsulta('notificacoes', 'remetenteId', uid, {
    remetenteId: CONTA_REMOVIDA_ID,
    remetenteNome: CONTA_REMOVIDA_NOME,
  });

  await atualizarConsulta('mural', 'autorId', uid, {
    autorId: CONTA_REMOVIDA_ID,
    autorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('mural', 'respostaParaAutorId', uid, {
    respostaParaAutorId: CONTA_REMOVIDA_ID,
    respostaParaAutorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('muralDenuncias', 'denuncianteId', uid, {
    denuncianteId: CONTA_REMOVIDA_ID,
    denuncianteNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('muralDenuncias', 'autorId', uid, {
    autorId: CONTA_REMOVIDA_ID,
    autorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('muralDenuncias', 'resolvidoPorId', uid, {
    resolvidoPorId: CONTA_REMOVIDA_ID,
    resolvidoPorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('solicitacoesCondominio', 'decididoPorId', uid, {
    decididoPorId: CONTA_REMOVIDA_ID,
    decididoPorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('muralBanidos', 'banidoPorId', uid, {
    banidoPorId: CONTA_REMOVIDA_ID,
    banidoPorNome: CONTA_REMOVIDA_NOME,
  });
  await atualizarConsulta('muralBanidos', 'desbanidoPorId', uid, {
    desbanidoPorId: CONTA_REMOVIDA_ID,
    desbanidoPorNome: CONTA_REMOVIDA_NOME,
  });

  const lidasPorPortaria = await db.collection('notificacoes').where('lidaPor', 'array-contains', uid).get();
  await aplicarEmLotes(lidasPorPortaria.docs, (batch, item) => batch.update(item.ref, { lidaPor:FieldValue.arrayRemove(uid) }));

  await anonimizarEncomendas(uid);
  await anonimizarInteracoes(uid);

  await atualizarConsulta('auditoria', 'moradorId', uid, { moradorId:CONTA_REMOVIDA_ID, alvoNome:CONTA_REMOVIDA_NOME });
  await atualizarConsulta('auditoria', 'atorId', uid, { atorId:CONTA_REMOVIDA_ID, atorNome:CONTA_REMOVIDA_NOME });
  await atualizarConsulta('ocrLeituras', 'porteiroId', uid, { porteiroId:CONTA_REMOVIDA_ID, porteiroNome:CONTA_REMOVIDA_NOME });
  await atualizarConsulta('ocrLeituras', 'moradorConfirmadoId', uid, { moradorConfirmadoId:CONTA_REMOVIDA_ID, moradorConfirmadoNome:CONTA_REMOVIDA_NOME });
  await atualizarConsulta('ocrTestes', 'porteiroId', uid, { porteiroId:CONTA_REMOVIDA_ID, porteiroNome:CONTA_REMOVIDA_NOME });
  await atualizarConsulta('ocrTestes', 'moradorConfirmadoId', uid, { moradorConfirmadoId:CONTA_REMOVIDA_ID, moradorConfirmadoNome:CONTA_REMOVIDA_NOME });

  await Promise.all([
    db.collection('diretorioUsuarios').doc(uid).delete().catch(() => {}),
    db.collection('fotosPerfil').doc(uid).delete().catch(() => {}),
  ]);
  if (usuarioSnap.exists) await usuarioRef.delete();
  await adminAuth.deleteUser(uid);

  logger.info('Conta excluída e registros operacionais anonimizados.', { uid, tipo:perfil.tipo || 'desconhecido' });
  return { ok:true };
});
