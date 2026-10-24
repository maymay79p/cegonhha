'use strict';

const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { dividirEmLotes, montarMensagens, tokenExpoValido } = require('./push');

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const REGIAO = 'southamerica-east1';
const NOME_EXCLUIDO = 'Conta excluída';

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
    headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
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

exports.enviarPushDaNotificacao = onDocumentCreated({ document: 'notificacoes/{notificacaoId}', retry: true, timeoutSeconds: 60, memory: '256MiB' }, async event => {
  if (!event.data) return;
  const notificacaoRef = event.data.ref;
  const atual = await notificacaoRef.get();
  if (!atual.exists) return;
  const notificacao = atual.data() || {};
  if (notificacao.pushStatus === 'enviado' || notificacao.pushStatus === 'sem_dispositivos') return;
  const dispositivos = await buscarDispositivos(notificacao);
  const mensagens = montarMensagens(notificacao, dispositivos, event.params.notificacaoId);
  if (!mensagens.length) {
    await notificacaoRef.update({ pushStatus: 'sem_dispositivos', pushEnviados: 0, pushProcessadoEm: FieldValue.serverTimestamp() });
    return;
  }
  const lotesMensagens = dividirEmLotes(mensagens, 100);
  const lotesDispositivos = dividirEmLotes(dispositivos, 100);
  let totalEnviados = 0;
  for (let i = 0; i < lotesMensagens.length; i += 1) totalEnviados += await enviarLote(lotesMensagens[i], lotesDispositivos[i]);
  await notificacaoRef.update({ pushStatus: 'enviado', pushEnviados: totalEnviados, pushProcessadoEm: FieldValue.serverTimestamp() });
  logger.info('Push do Cegonha processado.', { notificacaoId: event.params.notificacaoId, tipo: notificacao.tipo || 'aviso', destinatarioTipo: notificacao.destinatarioTipo || 'morador', dispositivos: dispositivos.length, enviados: totalEnviados });
});

exports.processarLembretes3Dias = onSchedule({ schedule: '0 9 * * *', timeZone: 'America/Sao_Paulo', region: REGIAO, timeoutSeconds: 300, memory: '256MiB' }, async () => {
  const limite = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const snapshot = await db.collection('encomendas').where('status', '==', 'pendente').get();
  const candidatas = snapshot.docs.filter(docSnap => {
    const dados = docSnap.data() || {};
    const recebidaEm = dados.recebidaEm?.toMillis?.() || 0;
    return dados.lembrete3dEnviado !== true && recebidaEm > 0 && recebidaEm <= limite;
  }).slice(0, 300);
  let enviados = 0;
  for (const docSnap of candidatas) {
    const sucesso = await db.runTransaction(async transaction => {
      const atualSnap = await transaction.get(docSnap.ref);
      if (!atualSnap.exists) return false;
      const atual = atualSnap.data() || {};
      const recebidaEm = atual.recebidaEm?.toMillis?.() || 0;
      if (atual.status !== 'pendente' || atual.lembrete3dEnviado === true || !recebidaEm || recebidaEm > limite) return false;
      const notificacaoRef = db.collection('notificacoes').doc();
      const auditoriaRef = db.collection('auditoria').doc();
      transaction.update(docSnap.ref, {
        lembrete3dEnviado: true,
        historico: FieldValue.arrayUnion({ tipo: 'lembrete', titulo: 'Lembrete de retirada enviado automaticamente', data: new Date().toISOString(), atorId: 'sistema', atorNome: 'Cegonha' }),
      });
      transaction.set(notificacaoRef, { destinatarioTipo: 'morador', moradorId: String(atual.moradorId || ''), condominioId: String(atual.condominioId || ''), encomendaId: docSnap.id, referenciaId: docSnap.id, mensagem: 'Sua encomenda está há mais de 3 dias aguardando retirada na portaria.', tipo: 'lembrete', lida: false, criadaEm: FieldValue.serverTimestamp() });
      transaction.set(auditoriaRef, { encomendaId: docSnap.id, condominioId: String(atual.condominioId || ''), moradorId: String(atual.moradorId || ''), alvoNome: String(atual.moradorNome || ''), atorId: 'sistema', atorNome: 'Cegonha', acao: 'lembrete_3_dias', detalhe: 'Lembrete automático de retirada enviado ao morador', criadoEm: FieldValue.serverTimestamp() });
      return true;
    });
    if (sucesso) enviados += 1;
  }
  logger.info('Lembretes automáticos de 3 dias processados.', { candidatas: candidatas.length, enviados });
});

function idAnonimo(uid) { return `excluido_${crypto.createHash('sha256').update(uid).digest('hex').slice(0, 20)}`; }
function anonimizarHistorico(historico, uid, anonimoId) {
  if (!Array.isArray(historico)) return historico;
  return historico.map(item => (!item || typeof item !== 'object' || item.atorId !== uid) ? item : { ...item, atorId: anonimoId, atorNome: NOME_EXCLUIDO });
}
async function aplicarEmLotes(documentos, operacao) {
  const itens = Array.from(documentos || []);
  for (let inicio = 0; inicio < itens.length; inicio += 400) {
    const lote = db.batch();
    itens.slice(inicio, inicio + 400).forEach(docSnap => operacao(lote, docSnap));
    await lote.commit();
  }
}
async function consultarPorCampo(colecao, campo, valor) { return db.collection(colecao).where(campo, '==', valor).get(); }
async function apagarPorCampo(colecao, campo, valor) {
  const snap = await consultarPorCampo(colecao, campo, valor);
  await aplicarEmLotes(snap.docs, (lote, docSnap) => lote.delete(docSnap.ref));
  return snap.size;
}
async function anonimizarPorCampo(colecao, campo, valor, criadorAtualizacao) {
  const snap = await consultarPorCampo(colecao, campo, valor);
  await aplicarEmLotes(snap.docs, (lote, docSnap) => lote.update(docSnap.ref, criadorAtualizacao(docSnap.data() || {}, docSnap)));
  return snap.size;
}

exports.excluirMinhaConta = onCall({ region: REGIAO, timeoutSeconds: 300, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre novamente na sua conta para continuar.');
  if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Confirme seu e-mail antes de excluir a conta.');
  if (request.data?.confirmacao !== 'EXCLUIR') throw new HttpsError('invalid-argument', 'Digite EXCLUIR para confirmar a exclusão.');
  const authTime = Number(request.auth.token.auth_time || 0) * 1000;
  if (!authTime || Date.now() - authTime > 10 * 60 * 1000) throw new HttpsError('failed-precondition', 'Por segurança, saia da conta, entre novamente e repita a exclusão em até 10 minutos.');

  const uid = request.auth.uid;
  const usuarioRef = db.collection('usuarios').doc(uid);
  const usuarioSnap = await usuarioRef.get();
  if (!usuarioSnap.exists) {
    await authAdmin.deleteUser(uid).catch(() => {});
    return { ok: true };
  }
  const usuario = usuarioSnap.data() || {};
  const condominioId = String(usuario.condominioId || '');
  const anonimoId = idAnonimo(uid);

  if (usuario.tipo === 'porteiro' && condominioId) {
    const usuariosCondominio = await db.collection('usuarios').where('condominioId', '==', condominioId).get();
    const outrasPortarias = usuariosCondominio.docs.filter(docSnap => docSnap.id !== uid && docSnap.data()?.tipo === 'porteiro');
    if (!outrasPortarias.length) throw new HttpsError('failed-precondition', 'Este condomínio ficaria sem Portaria. Vincule outra conta de Portaria antes de excluir esta conta.');
    const condominioRef = db.collection('condominios').doc(condominioId);
    const condominioSnap = await condominioRef.get();
    if (condominioSnap.exists && condominioSnap.data()?.criadoPor === uid) await condominioRef.update({ criadoPor: outrasPortarias[0].id, atualizadoEm: FieldValue.serverTimestamp() });
  }

  await apagarPorCampo('identificadoresUsuarios', 'uid', uid);
  await apagarPorCampo('pushDispositivos', 'uid', uid);
  await apagarPorCampo('notificacoes', 'moradorId', uid);
  await apagarPorCampo('notificacoes', 'destinatarioId', uid);
  await anonimizarPorCampo('notificacoes', 'remetenteId', uid, () => ({ remetenteId: anonimoId, remetenteNome: NOME_EXCLUIDO }));
  await apagarPorCampo('previsoes', 'moradorId', uid);
  await apagarPorCampo('solicitacoesCondominio', 'moradorId', uid);

  const encomendasMorador = await consultarPorCampo('encomendas', 'moradorId', uid);
  for (const encomendaDoc of encomendasMorador.docs) {
    const interacoes = await encomendaDoc.ref.collection('interacoes').get();
    await aplicarEmLotes(interacoes.docs, (lote, interacaoDoc) => lote.update(interacaoDoc.ref, { moradorId: anonimoId, moradorNome: NOME_EXCLUIDO }));
  }
  await aplicarEmLotes(encomendasMorador.docs, (lote, docSnap) => {
    const dados = docSnap.data() || {};
    lote.update(docSnap.ref, { moradorId: anonimoId, moradorNome: NOME_EXCLUIDO, bloco: '', apartamento: '', descricao: 'Dados pessoais removidos após exclusão da conta.', historico: anonimizarHistorico(dados.historico, uid, anonimoId) });
  });
  await anonimizarPorCampo('encomendas', 'porteiroId', uid, dados => ({ porteiroId: anonimoId, porteiroNome: NOME_EXCLUIDO, historico: anonimizarHistorico(dados.historico, uid, anonimoId) }));
  await anonimizarPorCampo('encomendas', 'retiradaPorId', uid, dados => ({ retiradaPorId: anonimoId, retiradaPorNome: NOME_EXCLUIDO, historico: anonimizarHistorico(dados.historico, uid, anonimoId) }));
  await anonimizarPorCampo('mural', 'autorId', uid, () => ({ autorId: anonimoId, autorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('mural', 'respostaParaAutorId', uid, () => ({ respostaParaAutorId: anonimoId, respostaParaAutorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('muralDenuncias', 'denuncianteId', uid, () => ({ denuncianteId: anonimoId, denuncianteNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('muralDenuncias', 'autorId', uid, () => ({ autorId: anonimoId, autorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('ocrLeituras', 'moradorConfirmadoId', uid, dados => ({ moradorConfirmadoId: anonimoId, moradorConfirmadoNome: NOME_EXCLUIDO, nomeDetectado: '', topCandidatoId: dados.topCandidatoId === uid ? anonimoId : String(dados.topCandidatoId || '') }));
  await anonimizarPorCampo('ocrTestes', 'moradorConfirmadoId', uid, dados => ({ moradorConfirmadoId: anonimoId, moradorConfirmadoNome: NOME_EXCLUIDO, nomeDetectado: '', topCandidatoId: dados.topCandidatoId === uid ? anonimoId : String(dados.topCandidatoId || '') }));
  await anonimizarPorCampo('auditoria', 'moradorId', uid, () => ({ moradorId: anonimoId, alvoNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('auditoria', 'atorId', uid, () => ({ atorId: anonimoId, atorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('ocrLeituras', 'porteiroId', uid, () => ({ porteiroId: anonimoId, porteiroNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('ocrTestes', 'porteiroId', uid, () => ({ porteiroId: anonimoId, porteiroNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('solicitacoesCondominio', 'decididoPorId', uid, () => ({ decididoPorId: anonimoId, decididoPorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('muralDenuncias', 'resolvidoPorId', uid, () => ({ resolvidoPorId: anonimoId, resolvidoPorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('muralBanidos', 'banidoPorId', uid, () => ({ banidoPorId: anonimoId, banidoPorNome: NOME_EXCLUIDO }));
  await anonimizarPorCampo('muralBanidos', 'desbanidoPorId', uid, () => ({ desbanidoPorId: anonimoId, desbanidoPorNome: NOME_EXCLUIDO }));

  if (condominioId) {
    await db.collection('muralBanidos').doc(`${condominioId}_${uid}`).delete().catch(() => {});
    await db.collection('muralBanimentosPublicos').doc(`${condominioId}_${uid}`).delete().catch(() => {});
  }
  await db.collection('fotosPerfil').doc(uid).delete().catch(() => {});
  await db.collection('diretorioUsuarios').doc(uid).delete().catch(() => {});
  await usuarioRef.delete();
  await authAdmin.deleteUser(uid);
  logger.info('Conta excluída e histórico anonimizado.', { uidAnonimizado: anonimoId, tipo: usuario.tipo || 'desconhecido' });
  return { ok: true };
});
