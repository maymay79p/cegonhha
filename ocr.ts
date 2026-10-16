import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { ResultadoOCR } from './types';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const OCR_SPACE_DEMO_KEY = 'helloworld';
const OCR_SPACE_TIMEOUT_MS = 25000;
const OCR_SPACE_FREE_LIMIT_BYTES = 980000;

function normalizar(valor = '') {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function somenteDigitos(valor = '') {
  return valor.replace(/\D/g, '');
}

function formatarCpf(valor = '') {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function levenshtein(a: string, b: string) {
  a = normalizar(a);
  b = normalizar(b);
  const matriz = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
  for (let i = 0; i <= b.length; i += 1) matriz[i][0] = i;
  for (let j = 1; j <= a.length; j += 1) matriz[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const custo = b[i - 1] === a[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + custo);
    }
  }
  return matriz[b.length][a.length];
}

function similaridade(a = '', b = '') {
  const aa = normalizar(a);
  const bb = normalizar(b);
  if (!aa || !bb) return 0;
  return Math.max(0, 1 - levenshtein(aa, bb) / Math.max(aa.length, bb.length));
}

function linhaSeguinteAoRotulo(linhas: string[], rotulos: RegExp) {
  const indice = linhas.findIndex(linha => rotulos.test(linha));
  if (indice < 0 || indice + 1 >= linhas.length) return null;
  const proxima = linhas[indice + 1]?.trim() || '';
  return proxima.length >= 3 ? proxima : null;
}

function extrairDados(texto: string) {
  const linhas = texto.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const blocoMatch = texto.match(/\b(?:bloco|bl|torre)\s*[:\-]?\s*([a-z0-9]{1,5})\b/i);
  const apMatch = texto.match(/\b(?:apartamento|apto|apt|ap)\s*[:\-]?\s*(\d{1,6}[a-z]?)\b/i);
  const cpfRotulado = texto.match(/\bcpf\s*[:\-]?\s*([0-9.\-\s]{11,18})/i);
  const cpfSolto = texto.match(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/);
  const nomeRotulado = texto.match(/\b(?:destinat[aá]rio|destino|recebedor|nome)\s*[:\-]\s*([^\n]{3,70})/i);

  let nome = nomeRotulado ? nomeRotulado[1].trim() : null;
  if (!nome) {
    nome = linhaSeguinteAoRotulo(linhas, /^(?:destinat[aá]rio|destino|recebedor|nome)\s*:??\s*$/i);
  }
  if (!nome) {
    nome = linhas.find(linha =>
      /^[A-Za-zÀ-ÿ' -]{5,70}$/.test(linha) &&
      linha.split(/\s+/).length >= 2 &&
      !/rua|avenida|av\.|cep|cpf|bloco|apartamento|apto|pedido|nota|remetente|telefone|transportadora|destinat[aá]rio/i.test(linha)
    ) || null;
  }

  const cpfBruto = cpfRotulado?.[1] || cpfSolto?.[0] || '';
  const cpfDigitos = somenteDigitos(cpfBruto);

  return {
    nome,
    cpf: cpfDigitos.length === 11 ? formatarCpf(cpfDigitos) : null,
    bloco: blocoMatch ? blocoMatch[1].toUpperCase() : null,
    apartamento: apMatch ? apMatch[1].toUpperCase() : null,
  };
}

function calcularScore(dados: any, morador: any) {
  const partes: { valor: number; peso: number }[] = [];
  if (dados.nome) partes.push({ valor: similaridade(dados.nome, morador.nome || ''), peso: 0.35 });
  if (dados.cpf) partes.push({ valor: somenteDigitos(dados.cpf) === somenteDigitos(morador.cpf || '') ? 1 : 0, peso: 0.3 });
  if (dados.bloco) partes.push({ valor: normalizar(dados.bloco) === normalizar(morador.bloco || '') ? 1 : 0, peso: 0.15 });
  if (dados.apartamento) partes.push({ valor: normalizar(dados.apartamento) === normalizar(morador.apartamento || '') ? 1 : 0, peso: 0.2 });
  if (!partes.length) return 0;
  const pesoTotal = partes.reduce((s, p) => s + p.peso, 0);
  return partes.reduce((s, p) => s + p.valor * p.peso, 0) / pesoTotal;
}

function apiKeyOCRSpace() {
  return process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY?.trim() || OCR_SPACE_DEMO_KEY;
}

export function usandoChaveDemoOCRSpace() {
  return apiKeyOCRSpace() === OCR_SPACE_DEMO_KEY;
}

function bytesBase64(dataUri: string) {
  const base64 = dataUri.split(',')[1] || '';
  return Math.ceil(base64.length * 0.75);
}

function mensagemErroApi(valor: unknown) {
  if (Array.isArray(valor)) return valor.filter(Boolean).map(String).join(' ');
  if (typeof valor === 'string') return valor;
  if (valor == null) return '';
  return String(valor);
}

async function lerTextoOCRSpace(imagemBase64: string, tipoTexto: 'impresso' | 'manuscrito') {
  if (!imagemBase64?.startsWith('data:image/')) {
    throw new Error('Não foi possível preparar a imagem para o OCR.Space. Tente fotografar novamente.');
  }

  if (bytesBase64(imagemBase64) > OCR_SPACE_FREE_LIMIT_BYTES) {
    throw new Error('A foto ficou grande demais para o plano gratuito do OCR.Space. Tente outra foto mais próxima da etiqueta.');
  }

  const form = new FormData();
  form.append('base64Image', imagemBase64);
  form.append('language', 'auto');
  form.append('isOverlayRequired', 'false');
  form.append('detectOrientation', 'true');
  form.append('scale', 'true');
  form.append('OCREngine', tipoTexto === 'manuscrito' ? '3' : '2');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_SPACE_TIMEOUT_MS);

  try {
    const response = await fetch(OCR_SPACE_ENDPOINT, {
      method: 'POST',
      headers: { apikey: apiKeyOCRSpace() },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OCR.Space respondeu com HTTP ${response.status}.`);
    }

    const data: any = await response.json();
    const erroGeral = mensagemErroApi(data?.ErrorMessage || data?.ErrorDetails);
    const erroResultado = mensagemErroApi(data?.ParsedResults?.[0]?.ErrorMessage || data?.ParsedResults?.[0]?.ErrorDetails);

    if (data?.IsErroredOnProcessing || erroGeral || erroResultado) {
      const detalhe = erroResultado || erroGeral || 'Falha no processamento da imagem.';
      if (/api.?key|apikey|quota|rate|maximum|limit/i.test(detalhe)) {
        const complemento = usandoChaveDemoOCRSpace()
          ? ' O Cegonha está usando a chave pública de teste. Crie uma chave gratuita do OCR.Space e coloque EXPO_PUBLIC_OCR_SPACE_API_KEY no arquivo .env.local.'
          : '';
        throw new Error(`OCR.Space recusou a leitura: ${detalhe}.${complemento}`);
      }
      throw new Error(`OCR.Space não conseguiu ler a etiqueta: ${detalhe}`);
    }

    const texto = (data?.ParsedResults || [])
      .map((item: any) => String(item?.ParsedText || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!texto) {
      throw new Error('O OCR.Space não encontrou texto legível. Tente uma foto mais próxima, reta e bem iluminada.');
    }

    return texto;
  } catch (erro: any) {
    if (erro?.name === 'AbortError') {
      throw new Error('O OCR.Space demorou demais para responder. Verifique a internet e tente novamente.');
    }
    if (/network request failed|failed to fetch|networkerror/i.test(String(erro?.message || erro))) {
      throw new Error('Não foi possível acessar o OCR.Space. Verifique a conexão com a internet e tente novamente.');
    }
    throw erro;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reconhecerEtiqueta(
  imagemBase64: string,
  condominioId: string,
  tipoTexto: 'impresso' | 'manuscrito' = 'impresso',
): Promise<ResultadoOCR> {
  if (!condominioId) throw new Error('A conta da portaria ainda não está vinculada a um condomínio.');

  const texto = await lerTextoOCRSpace(imagemBase64, tipoTexto);
  const dados = extrairDados(texto);
  const snap = await getDocs(query(collection(db, 'usuarios'), where('condominioId', '==', condominioId)));
  const candidatos = snap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any))
    .filter(m => m.tipo === 'morador')
    .map(m => ({
      id: m.id,
      nome: m.nome || '',
      email: m.email || '',
      telefone: m.telefone || '',
      cpf: m.cpf || '',
      bloco: m.bloco || '',
      apartamento: m.apartamento || '',
      tipo: 'morador' as const,
      condominioId: m.condominioId || '',
      condominioNome: m.condominioNome || '',
      condominioCodigo: m.condominioCodigo || '',
      fotoPerfil: m.fotoPerfil || '',
      score: calcularScore(dados, m),
    }))
    .filter(c => c.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { texto, ...dados, candidatos, motor: 'ocr-space' };
}
