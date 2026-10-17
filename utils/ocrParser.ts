export type DadosEtiquetaOCR = {
  nome: string | null;
  cpf: string | null;
  bloco: string | null;
  apartamento: string | null;
};

const ALIASES_NOME_DESTINO = [
  'nome do destinatario',
  'nome do recebedor',
  'destinatario',
  'destinataria',
  'dest',
  'recebedor',
  'recebedora',
  'receb',
  'rec',
  'morador',
  'moradora',
  'mor',
  'cliente',
  'consignatario',
  'consignataria',
  'a/c',
  'aos cuidados',
  'nome',
];

const ALIASES_REMETENTE = [
  'nome do remetente',
  'remetente',
  'rem',
];

const ALIASES_CPF = [
  'cpf do destinatario',
  'cpf do recebedor',
  'documento cpf',
  'doc cpf',
  'cpf',
];

const ALIASES_BLOCO = [
  'bloco',
  'blc',
  'bl',
  'torre',
  'edificio',
  'edif',
  'ed',
];

const ALIASES_APARTAMENTO = [
  'apartamento',
  'apart',
  'apto',
  'apt',
  'ap',
  'unidade',
  'unid',
  'und',
];

const PALAVRAS_NAO_NOME = /\b(?:rua|r\.|avenida|av\.|travessa|tv\.|rodovia|estrada|cep|bairro|cidade|estado|brasil|endereco|endere[cç]o|telefone|fone|celular|cpf|cnpj|bloco|bl\.?|torre|apartamento|apto|apt\.?|ap\.?|unidade|pedido|nota|nf|rastreio|tracking|transportadora|correios|sedex|pac|remetente|destinat[aá]ri[oa]|recebedor|recebedora)\b/i;

function semAcento(valor = '') {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarOCR(valor = '') {
  return semAcento(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function somenteDigitosOCR(valor = '') {
  return valor.replace(/\D/g, '');
}

function canon(valor = '') {
  return semAcento(valor).toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatarCpf(valor = '') {
  const d = somenteDigitosOCR(valor).slice(0, 11);
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function limparInicioValor(valor = '') {
  return valor
    .replace(/^\s*(?:[:#=\-–—.]\s*)+/g, '')
    .replace(/^\s*n(?:[º°o]|ro)?\.?\s*/i, '')
    .trim();
}

function detectarRotulo(linha: string, aliases: string[]) {
  const original = linha.trim();
  const normalizada = canon(original);
  const ordenados = [...aliases].sort((a, b) => b.length - a.length);

  for (const alias of ordenados) {
    const chave = canon(alias);
    if (normalizada === chave) return { encontrou: true, valor: '' };
    if (!normalizada.startsWith(chave)) continue;
    const restoCanon = normalizada.slice(chave.length);
    if (!/^(?:\s|[:#=\.\-–—/])/.test(restoCanon)) continue;

    const qtdPalavras = chave.split(/\s+/).length;
    const tokens = original.split(/\s+/);
    let resto = tokens.slice(qtdPalavras).join(' ');

    if (qtdPalavras === 1) {
      const primeiro = tokens[0] || '';
      const sobraPrimeiro = primeiro.replace(/^[^:#=\-–—/]*[:#=\.\-–—/]+/, '');
      if (sobraPrimeiro && sobraPrimeiro !== primeiro) {
        resto = [sobraPrimeiro, ...tokens.slice(1)].join(' ');
      }
    }

    return { encontrou: true, valor: limparInicioValor(resto) };
  }

  return { encontrou: false, valor: '' };
}

function ehRotuloConhecido(linha: string) {
  return [ALIASES_NOME_DESTINO, ALIASES_REMETENTE, ALIASES_CPF, ALIASES_BLOCO, ALIASES_APARTAMENTO]
    .some(lista => detectarRotulo(linha, lista).encontrou);
}

function limparNome(valor = '') {
  let nome = valor
    .replace(/[|_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  nome = nome.split(/\s+(?=(?:cpf|doc(?:umento)?|bloco|bl\.?|torre|apartamento|apto|apt\.?|ap\.?|unidade|cep|endere[cç]o|telefone|fone|celular)\b)/i)[0].trim();
  nome = nome.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ'’\- ]+$/g, '').trim();
  return nome;
}

function pareceNome(valor = '') {
  const nome = limparNome(valor);
  if (!nome || nome.length < 4 || nome.length > 80) return false;
  if (/\d/.test(nome) || PALAVRAS_NAO_NOME.test(nome)) return false;
  const palavras = nome.split(/\s+/).filter(Boolean);
  const significativas = palavras.filter(p => semAcento(p).replace(/[^A-Za-z]/g, '').length >= 2);
  return palavras.length >= 2 && significativas.length >= 2;
}

function valorNasProximasLinhas(
  linhas: string[],
  indice: number,
  aliases: string[],
  validar: (valor: string) => string | null,
) {
  for (let deslocamento = 1; deslocamento <= 3; deslocamento += 1) {
    const linha = linhas[indice + deslocamento];
    if (!linha) break;

    const mesmoRotulo = detectarRotulo(linha, aliases);
    if (mesmoRotulo.encontrou && mesmoRotulo.valor) {
      const validado = validar(mesmoRotulo.valor);
      if (validado) return validado;
    }

    const validadoDireto = validar(linha);
    if (validadoDireto) return validadoDireto;

    if (ehRotuloConhecido(linha)) break;
  }
  return null;
}

function extrairNomePorRotulo(linhas: string[], aliases: string[]) {
  for (let i = 0; i < linhas.length; i += 1) {
    const achou = detectarRotulo(linhas[i], aliases);
    if (!achou.encontrou) continue;
    if (achou.valor && pareceNome(achou.valor)) return limparNome(achou.valor);

    const seguinte = valorNasProximasLinhas(linhas, i, aliases, valor => {
      const rotulado = detectarRotulo(valor, ALIASES_NOME_DESTINO);
      const candidato = rotulado.encontrou && rotulado.valor ? rotulado.valor : valor;
      return pareceNome(candidato) ? limparNome(candidato) : null;
    });
    if (seguinte) return seguinte;
  }
  return null;
}

function normalizarNumeroOCR(valor = '') {
  return valor
    .replace(/[OoQq]/g, '0')
    .replace(/[Il|]/g, '1');
}

function cpfDeTrecho(valor = '') {
  const corrigido = normalizarNumeroOCR(valor);
  const grupos = corrigido.match(/[0-9.\-\s]{11,22}/g) || [];
  for (const grupo of grupos) {
    const digitos = somenteDigitosOCR(grupo);
    if (digitos.length === 11) return formatarCpf(digitos);
  }
  const digitos = somenteDigitosOCR(corrigido);
  return digitos.length === 11 ? formatarCpf(digitos) : null;
}

function extrairCpf(linhas: string[], texto: string) {
  for (let i = 0; i < linhas.length; i += 1) {
    const achou = detectarRotulo(linhas[i], ALIASES_CPF);
    if (!achou.encontrou) continue;
    const inline = cpfDeTrecho(achou.valor);
    if (inline) return inline;
    const seguinte = valorNasProximasLinhas(linhas, i, ALIASES_CPF, cpfDeTrecho);
    if (seguinte) return seguinte;
  }

  const padrao = texto.match(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/);
  if (padrao) return formatarCpf(padrao[0]);

  const tolerante = normalizarNumeroOCR(texto).match(/\b[0-9]{3}[.\s]?[0-9]{3}[.\s]?[0-9]{3}[-\s]?[0-9]{2}\b/);
  return tolerante ? formatarCpf(tolerante[0]) : null;
}

function blocoDeTrecho(valor = '') {
  const limpo = limparInicioValor(valor).toUpperCase();
  const match = limpo.match(/\b([A-Z0-9]{1,5})\b/);
  if (!match) return null;
  const candidato = match[1];
  if (/^(?:AP|APT|APTO|BL|BLC|TORRE)$/i.test(candidato)) return null;
  return candidato;
}

function apartamentoDeTrecho(valor = '') {
  const limpo = normalizarNumeroOCR(limparInicioValor(valor)).toUpperCase();
  const match = limpo.match(/\b(\d{1,6}[A-Z]?)\b/);
  return match ? match[1] : null;
}

function extrairCampoPorRotulo(
  linhas: string[],
  aliases: string[],
  parser: (valor: string) => string | null,
) {
  for (let i = 0; i < linhas.length; i += 1) {
    const achou = detectarRotulo(linhas[i], aliases);
    if (!achou.encontrou) continue;
    const inline = parser(achou.valor);
    if (inline) return inline;
    const seguinte = valorNasProximasLinhas(linhas, i, aliases, parser);
    if (seguinte) return seguinte;
  }
  return null;
}

function extrairBlocoApartamento(linhas: string[], texto: string) {
  const combinado = semAcento(texto).match(/\b(?:bloco|blc|bl|torre)\.?\s*\/\s*(?:apartamento|apart|apto|apt|ap|unidade|unid|und)\.?\s*[:#=\-]?\s*([a-z0-9]{1,5})\s*[\/\-]\s*(\d{1,6}[a-z]?)\b/i);
  let bloco = combinado?.[1]?.toUpperCase() || null;
  let apartamento = combinado?.[2]?.toUpperCase() || null;

  if (!bloco) bloco = extrairCampoPorRotulo(linhas, ALIASES_BLOCO, blocoDeTrecho);
  if (!apartamento) apartamento = extrairCampoPorRotulo(linhas, ALIASES_APARTAMENTO, apartamentoDeTrecho);

  if (!bloco) {
    const match = semAcento(texto).match(/(?:^|[\s,;|])(?:bloco|blc|bl|torre|edificio|edif|ed)\.?\s*(?:n(?:[oº°]|ro)?\.?)?\s*[:#=\-]?\s*([a-z0-9]{1,5})\b/im);
    if (match) bloco = match[1].toUpperCase();
  }
  if (!apartamento) {
    const match = semAcento(texto).match(/(?:^|[\s,;|])(?:apartamento|apart|apto|apt|ap|unidade|unid|und)\.?\s*(?:n(?:[oº°]|ro)?\.?)?\s*[:#=\-]?\s*(\d{1,6}[a-z]?)\b/im);
    if (match) apartamento = match[1].toUpperCase();
  }

  return { bloco, apartamento };
}

function nomeFallback(linhas: string[]) {
  return linhas.find(linha => pareceNome(linha) && !ehRotuloConhecido(linha)) ?
    limparNome(linhas.find(linha => pareceNome(linha) && !ehRotuloConhecido(linha)) || '') : null;
}

export function extrairDadosEtiqueta(texto: string): DadosEtiquetaOCR {
  const linhas = texto.split(/\r?\n/).map(v => v.trim()).filter(Boolean);

  // Prioriza sempre destinatário/recebedor/morador. Se a etiqueta só trouxer
  // "Remetente", ainda entende que a linha logo abaixo é um nome; se os dois
  // papéis existirem, o remetente nunca substitui o destinatário.
  let nome = extrairNomePorRotulo(linhas, ALIASES_NOME_DESTINO);
  if (!nome) nome = extrairNomePorRotulo(linhas, ALIASES_REMETENTE);
  if (!nome) nome = nomeFallback(linhas);

  const cpf = extrairCpf(linhas, texto);
  const { bloco, apartamento } = extrairBlocoApartamento(linhas, texto);

  return { nome, cpf, bloco, apartamento };
}

function levenshtein(a: string, b: string) {
  const aa = normalizarOCR(a);
  const bb = normalizarOCR(b);
  const matriz = Array.from({ length: bb.length + 1 }, () => Array(aa.length + 1).fill(0));
  for (let i = 0; i <= bb.length; i += 1) matriz[i][0] = i;
  for (let j = 1; j <= aa.length; j += 1) matriz[0][j] = j;
  for (let i = 1; i <= bb.length; i += 1) {
    for (let j = 1; j <= aa.length; j += 1) {
      const custo = bb[i - 1] === aa[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + custo);
    }
  }
  return matriz[bb.length][aa.length];
}

export function similaridadeNomeOCR(a = '', b = '') {
  const aa = normalizarOCR(a);
  const bb = normalizarOCR(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const base = Math.max(0, 1 - levenshtein(a, b) / Math.max(aa.length, bb.length));

  const tokensA = canon(a).split(/[^a-z0-9]+/).filter(t => t.length >= 2);
  const tokensB = canon(b).split(/[^a-z0-9]+/).filter(t => t.length >= 2);
  const comuns = tokensA.filter(t => tokensB.includes(t)).length;
  const cobertura = Math.min(tokensA.length, tokensB.length) ? comuns / Math.min(tokensA.length, tokensB.length) : 0;
  return Math.max(base, cobertura * 0.92);
}

function nomeNoTexto(nome = '', texto = '') {
  const nomeNormalizado = normalizarOCR(nome);
  const textoNormalizado = normalizarOCR(texto);
  if (!nomeNormalizado || !textoNormalizado) return 0;
  if (textoNormalizado.includes(nomeNormalizado)) return 1;

  const tokensNome = canon(nome).split(/[^a-z0-9]+/).filter(t => t.length >= 3);
  const tokensTexto = new Set(canon(texto).split(/[^a-z0-9]+/).filter(Boolean));
  if (tokensNome.length < 2) return 0;
  const encontrados = tokensNome.filter(t => tokensTexto.has(t)).length;
  const cobertura = encontrados / tokensNome.length;
  return cobertura >= 0.75 ? cobertura * 0.9 : 0;
}

export function calcularCompatibilidadeOCR(dados: DadosEtiquetaOCR, morador: any, textoBruto = '') {
  const partes: { valor: number; peso: number }[] = [];
  const nomeExtraido = dados.nome ? similaridadeNomeOCR(dados.nome, morador.nome || '') : 0;
  const nomeContexto = nomeNoTexto(morador.nome || '', textoBruto);
  const nomeScore = Math.max(nomeExtraido, nomeContexto);
  if (nomeScore > 0) partes.push({ valor: nomeScore, peso: 0.4 });
  if (dados.cpf) partes.push({ valor: somenteDigitosOCR(dados.cpf) === somenteDigitosOCR(morador.cpf || '') ? 1 : 0, peso: 0.3 });
  if (dados.bloco) partes.push({ valor: normalizarOCR(dados.bloco) === normalizarOCR(morador.bloco || '') ? 1 : 0, peso: 0.15 });
  if (dados.apartamento) partes.push({ valor: normalizarOCR(dados.apartamento) === normalizarOCR(morador.apartamento || '') ? 1 : 0, peso: 0.15 });
  if (!partes.length) return 0;
  const pesoTotal = partes.reduce((s, p) => s + p.peso, 0);
  return partes.reduce((s, p) => s + p.valor * p.peso, 0) / pesoTotal;
}
