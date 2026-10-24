'use strict';

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
const JANELA_REAUTENTICACAO_SEGUNDOS = 10 * 60;

function millisData(valor) {
  if (!valor) return 0;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  return 0;
}

function deveEnviarLembrete(dados, agoraMs = Date.now()) {
  if (!dados || dados.status !== 'pendente' || dados.lembrete3dEnviado === true) return false;
  const recebidaEm = millisData(dados.recebidaEm);
  return recebidaEm > 0 && agoraMs - recebidaEm >= TRES_DIAS_MS;
}

function authRecente(authTimeSegundos, agoraSegundos = Math.floor(Date.now() / 1000)) {
  const authTime = Number(authTimeSegundos || 0);
  return authTime > 0 && agoraSegundos - authTime <= JANELA_REAUTENTICACAO_SEGUNDOS;
}

function anonimizarHistorico(historico, uid, rotulo = 'Conta removida') {
  if (!Array.isArray(historico)) return [];
  return historico.map(item => {
    if (!item || typeof item !== 'object' || item.atorId !== uid) return item;
    return { ...item, atorId: 'conta_removida', atorNome: rotulo };
  });
}

module.exports = {
  TRES_DIAS_MS,
  JANELA_REAUTENTICACAO_SEGUNDOS,
  millisData,
  deveEnviarLembrete,
  authRecente,
  anonimizarHistorico,
};
