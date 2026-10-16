import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { ResultadoOCR } from './types';

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

async function lerTextoMLKit(imagemUri: string) {
  if (!imagemUri) throw new Error('A imagem da etiqueta não foi encontrada.');

  try {
    // expo-ocr-kit usa Google ML Kit no Android, mas é implementado com a
    // Expo Modules API, que é compatível com a Nova Arquitetura do SDK 57.
    const modulo = await import('expo-ocr-kit');
    const resultado = await modulo.recognizeText(imagemUri);
    const texto = String(resultado?.text || '').trim();
    if (!texto) throw new Error('Nenhum texto foi reconhecido. Tente uma foto mais nítida, reta e bem iluminada.');
    return texto;
  } catch (erro: any) {
    const mensagem = String(erro?.message || erro || '');
    if (/native module|cannot find|not found|undefined|not linked|doesn.?t seem to be linked|expo go/i.test(mensagem)) {
      throw new Error('O OCR está instalado, mas esta APK ainda não contém o módulo nativo novo. Rode “npm run rebuild:android” uma vez, instale a APK gerada e depois use apenas “npm start”.');
    }
    throw erro;
  }
}

export async function reconhecerEtiqueta(imagemUri: string, condominioId: string): Promise<ResultadoOCR> {
  if (!condominioId) throw new Error('A conta da portaria ainda não está vinculada a um condomínio.');

  const texto = await lerTextoMLKit(imagemUri);
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

  return { texto, ...dados, candidatos, motor: 'google-ml-kit' };
}
