'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TRES_DIAS_MS,
  deveEnviarLembrete,
  authRecente,
  anonimizarHistorico,
} = require('../maintenance');

test('lembrete só é devido após três dias para encomenda pendente', () => {
  const agora = Date.UTC(2026, 9, 24, 12, 0, 0);
  assert.equal(deveEnviarLembrete({ status:'pendente', lembrete3dEnviado:false, recebidaEm:agora - TRES_DIAS_MS }, agora), true);
  assert.equal(deveEnviarLembrete({ status:'pendente', lembrete3dEnviado:false, recebidaEm:agora - TRES_DIAS_MS + 1 }, agora), false);
  assert.equal(deveEnviarLembrete({ status:'retirada', lembrete3dEnviado:false, recebidaEm:agora - TRES_DIAS_MS * 2 }, agora), false);
  assert.equal(deveEnviarLembrete({ status:'pendente', lembrete3dEnviado:true, recebidaEm:agora - TRES_DIAS_MS * 2 }, agora), false);
});

test('exclusão exige autenticação recente', () => {
  const agora = 10_000;
  assert.equal(authRecente(agora - 60, agora), true);
  assert.equal(authRecente(agora - 600, agora), true);
  assert.equal(authRecente(agora - 601, agora), false);
  assert.equal(authRecente(0, agora), false);
});

test('histórico preserva evento e anonimiza somente o ator removido', () => {
  const historico = [
    { tipo:'recebida', atorId:'porteiro-1', atorNome:'Maria' },
    { tipo:'retirada', atorId:'porteiro-2', atorNome:'João' },
  ];
  const resultado = anonimizarHistorico(historico, 'porteiro-1');
  assert.equal(resultado[0].atorId, 'conta_removida');
  assert.equal(resultado[0].atorNome, 'Conta removida');
  assert.deepEqual(resultado[1], historico[1]);
});
