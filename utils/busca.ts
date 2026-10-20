export function normalizarBusca(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function campoComAliases(valor: unknown, aliases: string[]) {
  const texto = String(valor ?? '').trim();
  if (!texto) return [];
  return [texto, ...aliases.map(alias => `${alias} ${texto}`)];
}

export function montarTextoBuscaPessoa(item: any) {
  return normalizarBusca([
    item?.nome,
    item?.moradorNome,
    item?.email,
    item?.cpf,
    item?.tipo === 'porteiro' ? 'portaria porteiro' : item?.tipo === 'morador' ? 'morador' : '',
    ...campoComAliases(item?.bloco, ['bloco', 'bl']),
    ...campoComAliases(item?.apartamento, ['apartamento', 'apto', 'apt', 'ap', 'unidade']),
  ].join(' '));
}

export function montarTextoBuscaEncomenda(item: any) {
  return normalizarBusca([
    item?.moradorNome,
    item?.descricao,
    item?.codigoReferencia,
    item?.codigoRetirada,
    item?.status,
    item?.porteiroNome,
    item?.retiradaRecebedorNome,
    ...campoComAliases(item?.bloco, ['bloco', 'bl']),
    ...campoComAliases(item?.apartamento, ['apartamento', 'apto', 'apt', 'ap', 'unidade']),
  ].join(' '));
}

export function correspondeBusca(textoIndexado: string, termo: unknown) {
  const consulta = normalizarBusca(termo);
  if (!consulta) return true;
  const indexado = normalizarBusca(textoIndexado);
  const palavras = new Set(indexado.split(' ').filter(Boolean));
  const tokens = consulta.split(' ').filter(Boolean);

  if (tokens.length === 1) {
    const token = tokens[0];
    // Números isolados são exatos: pesquisar 203 não deve retornar 1203.
    if (/^\d+$/.test(token)) return palavras.has(token);
    // Para nomes e códigos simples, ainda aceitamos prefixos/trechos.
    return indexado.includes(token);
  }

  return tokens.every(token => {
    // Abreviações, letras isoladas e números precisam coincidir com uma palavra
    // inteira. Assim, "bloco A" não casa com uma letra dentro do nome e
    // "ap 203" não encontra por engano o apartamento 1203.
    if (token.length <= 2 || /^\d+$/.test(token)) return palavras.has(token);
    return indexado.includes(token);
  });
}
