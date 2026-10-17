import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { ResultadoOCR } from './types';
import { calcularCompatibilidadeOCR, extrairDadosEtiqueta } from './utils/ocrParser';

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const OCR_SPACE_DEMO_KEY = 'helloworld';
const OCR_SPACE_TIMEOUT_MS = 25000;
const OCR_SPACE_FREE_LIMIT_BYTES = 980000;

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
  const dados = extrairDadosEtiqueta(texto);
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
      score: calcularCompatibilidadeOCR(dados, m, texto),
    }))
    .filter(c => c.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { texto, ...dados, candidatos, motor: 'ocr-space' };
}
