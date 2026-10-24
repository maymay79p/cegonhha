'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dividirEmLotes, montarMensagens, tituloParaTipo, tokenExpoValido } = require('../push');

test('reconhece tokens Expo validos', () => {
  assert.equal(tokenExpoValido('ExpoPushToken[abc123]'), true);
  assert.equal(tokenExpoValido('ExponentPushToken[abc123]'), true);
  assert.equal(tokenExpoValido('abc123'), false);
});

test('monta push de chegada com dados de navegacao', () => {
  const mensagens = montarMensagens({
    tipo: 'chegada',
    mensagem: 'Sua encomenda chegou à portaria.',
    referenciaId: 'enc-1',
    encomendaId: 'enc-1',
  }, [{ token: 'ExpoPushToken[teste]', ativo: true }], 'notif-1');

  assert.equal(mensagens.length, 1);
  assert.equal(mensagens[0].title, 'Encomenda chegou 📦');
  assert.equal(mensagens[0].body, 'Sua encomenda chegou à portaria.');
  assert.equal(mensagens[0].channelId, 'cegonha-geral');
  assert.deepEqual(mensagens[0].data, {
    tipo: 'chegada',
    notificacaoId: 'notif-1',
    referenciaId: 'enc-1',
    encomendaId: 'enc-1',
  });
});

test('usa titulos claros para retirada solicitada, contestacao e resposta do mural', () => {
  assert.equal(tituloParaTipo('retirada_solicitada'), 'Morador informou retirada');
  assert.equal(tituloParaTipo('contestacao_encomenda'), 'Encomenda contestada');
  assert.equal(tituloParaTipo('resposta_mural'), 'Nova resposta no mural');
});

test('ignora dispositivo inativo ou token invalido', () => {
  const mensagens = montarMensagens({ tipo: 'denuncia', mensagem: 'Nova denúncia.' }, [
    { token: 'ExpoPushToken[ok]', ativo: false },
    { token: 'invalido', ativo: true },
    { token: 'ExpoPushToken[valido]', ativo: true },
  ], 'notif-2');
  assert.equal(mensagens.length, 1);
  assert.equal(mensagens[0].to, 'ExpoPushToken[valido]');
  assert.equal(tituloParaTipo('denuncia'), 'Nova denúncia no mural');
});

test('divide envios em lotes de ate 100', () => {
  const itens = Array.from({ length: 205 }, (_, i) => i);
  const lotes = dividirEmLotes(itens, 100);
  assert.equal(lotes.length, 3);
  assert.equal(lotes[0].length, 100);
  assert.equal(lotes[1].length, 100);
  assert.equal(lotes[2].length, 5);
});
