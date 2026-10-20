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
  const tokens = consulta.split(' ').filter(Boolean);
  return tokens.every(token => textoIndexado.includes(token));
}
