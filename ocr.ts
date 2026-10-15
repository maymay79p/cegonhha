import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { ResultadoOCR } from './types';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const OCR_SPACE_KEY = process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY?.trim();

function normalizar(valor = '') {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string) {
  a = normalizar(a);
  b = normalizar(b);
  const matriz = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
  for (let i = 0; i <= b.length; i += 1) matriz[i][0] = i;
  for (let j = 0; j <= a.length; j += 1) matriz[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const custo = b[i - 1] === a[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + custo
      );
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

function extrairDados(texto: string) {
  const linhas = texto.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const blocoMatch = texto.match(/\b(?:bloco|bl|torre)\s*[:\-]?\s*([a-z0-9]{1,5})\b/i);
  const apMatch = texto.match(/\b(?:apartamento|apto|apt|ap)\s*[:\-]?\s*(\d{1,6}[a-z]?)\b/i);
  const nomeRotulado = texto.match(/\b(?:destinat[aá]rio|destino|recebedor|nome)\s*[:\-]\s*([^\n]{3,70})/i);

  let nome = nomeRotulado ? nomeRotulado[1].trim() : null;
  if (!nome) {
    nome = linhas.find(linha =>
      /^[A-Za-zÀ-ÿ' -]{5,70}$/.test(linha) &&
      linha.split(/\s+/).length >= 2 &&
      !/rua|avenida|av\.|cep|bloco|apartamento|apto|pedido|nota|remetente|telefone|transportadora/i.test(linha)
    ) || null;
  }

  return {
    nome,
    bloco: blocoMatch ? blocoMatch[1].toUpperCase() : null,
    apartamento: apMatch ? apMatch[1].toUpperCase() : null,
  };
}

function calcularScore(dados: any, morador: any) {
  const partes: { valor: number; peso: number }[] = [];
  if (dados.nome) partes.push({ valor: similaridade(dados.nome, morador.nome || ''), peso: 0.5 });
  if (dados.bloco) partes.push({ valor: normalizar(dados.bloco) === normalizar(morador.bloco || '') ? 1 : 0, peso: 0.2 });
  if (dados.apartamento) partes.push({ valor: normalizar(dados.apartamento) === normalizar(morador.apartamento || '') ? 1 : 0, peso: 0.3 });
  if (!partes.length) return 0;
  const pesoTotal = partes.reduce((s, p) => s + p.peso, 0);
  return partes.reduce((s, p) => s + p.valor * p.peso, 0) / pesoTotal;
}

async function lerTextoOCRSpace(base64: string) {
  if (!OCR_SPACE_KEY) {
    throw new Error('Falta a chave do OCR.Space. Crie um arquivo .env com EXPO_PUBLIC_OCR_SPACE_API_KEY e reinicie o app.');
  }

  const form = new FormData();
  const conteudo = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  form.append('base64Image', conteudo);
  form.append('OCREngine', '3');
  form.append('language', 'auto');
  form.append('isOverlayRequired', 'false');
  form.append('detectOrientation', 'true');
  form.append('scale', 'true');

  const resposta = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: { apikey: OCR_SPACE_KEY },
    body: form,
  });

  if (!resposta.ok) {
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('A chave do OCR.Space está inválida ou expirou. Atualize EXPO_PUBLIC_OCR_SPACE_API_KEY no .env e reinicie o app.');
    }
    throw new Error(`O serviço OCR respondeu com erro ${resposta.status}. Tente novamente em alguns instantes.`);
  }

  const json: any = await resposta.json();
  if (json?.IsErroredOnProcessing) {
    const mensagens = Array.isArray(json?.ErrorMessage) ? json.ErrorMessage.join(' ') : json?.ErrorMessage;
    throw new Error(mensagens || 'O OCR gratuito não conseguiu processar a imagem.');
  }

  const texto = (json?.ParsedResults || [])
    .map((item: any) => item?.ParsedText || '')
    .join('\n')
    .trim();

  if (!texto) throw new Error('Nenhum texto foi reconhecido. Tente uma foto mais nítida e bem iluminada.');
  return texto;
}

export async function reconhecerEtiqueta(base64: string, condominioId: string): Promise<ResultadoOCR> {
  if (!condominioId) throw new Error('A conta da portaria ainda não está vinculada a um condomínio.');

  const texto = await lerTextoOCRSpace(base64);
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

  return { texto, ...dados, candidatos };
}

export async function uriParaBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const valor = String(reader.result || '');
      resolve(valor.includes(',') ? valor.split(',')[1] : valor);
    };
    reader.readAsDataURL(blob);
  });
}
