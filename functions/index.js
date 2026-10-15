'use strict';

const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { dividirEmLotes, montarMensagens, tokenExpoValido } = require('./push');

initializeApp();
const db = getFirestore();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

  if (!resposta.ok) {
    throw new Error(`Expo Push Service respondeu HTTP ${resposta.status}.`);
  }

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
