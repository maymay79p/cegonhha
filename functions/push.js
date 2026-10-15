'use strict';

const TITULOS = {
  chegada: 'Encomenda chegou 📦',
  retirada: 'Retirada registrada',
  lembrete: 'Encomenda aguardando retirada',
  vinculo: 'Atualização do condomínio',
  solicitacao_vinculo: 'Nova solicitação de morador',
  previsao: 'Nova entrega prevista',
  denuncia: 'Nova denúncia no mural',
};

function tokenExpoValido(token) {
  return typeof token === 'string' && /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token);
}

function tituloParaTipo(tipo) {
  return TITULOS[tipo] || 'Cegonha';
}

function montarMensagens(notificacao, dispositivos, notificacaoId) {
  const body = String(notificacao?.mensagem || '').trim();
  if (!body) return [];

  return dispositivos
    .filter(item => item && item.ativo !== false && tokenExpoValido(item.token))
    .map(item => ({
      to: item.token,
      sound: 'default',
      title: tituloParaTipo(notificacao.tipo),
      body,
      priority: 'high',
      channelId: 'cegonha-geral',
      data: {
        tipo: notificacao.tipo || 'aviso',
        notificacaoId,
        referenciaId: notificacao.referenciaId || '',
        encomendaId: notificacao.encomendaId || '',
      },
    }));
}

function dividirEmLotes(itens, tamanho = 100) {
  const lotes = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

module.exports = { dividirEmLotes, montarMensagens, tituloParaTipo, tokenExpoValido };
