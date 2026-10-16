import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Encomenda, HistoricoEvento, OCRMeta } from '../types';

const LIMITE_DESCRICAO = 300;

function agoraISO() {
  return new Date().toISOString();
}

function evento(tipo: HistoricoEvento['tipo'], titulo: string, atorId?: string, atorNome?: string, observacao?: string): HistoricoEvento {
  return { tipo, titulo, data: agoraISO(), atorId, atorNome, observacao };
}

export type ResultadoRegistroChegada = {
  id: string;
  notificacaoCriada: boolean;
  avisos: string[];
};

export async function buscarDuplicada(moradorId: string, condominioId: string) {
  if (!condominioId) return null;
  const snap = await getDocs(query(
    collection(db, 'encomendas'),
    where('moradorId', '==', moradorId),
    where('condominioId', '==', condominioId),
  ));
  const limite = Date.now() - 10 * 60 * 1000;
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .find(item => {
      if (item.status !== 'pendente') return false;
      const data = item.recebidaEm?.toDate?.()?.getTime?.() || 0;
      return data >= limite;
    }) || null;
}

export async function registrarChegada({ perfil, morador, descricao, ocrMeta, previsao }: {
  perfil: any;
  morador: any;
  descricao: string;
  ocrMeta?: OCRMeta;
  previsao?: any;
}): Promise<ResultadoRegistroChegada> {
  const uidAtual = auth.currentUser?.uid || perfil?.id || '';
  const condominioAtual = perfil?.condominioId || '';
  const descricaoLimpa = descricao.trim();

  if (!uidAtual || !condominioAtual) throw new Error('Sua conta de portaria está sem condomínio vinculado. Faça logout e login novamente.');
  if (perfil?.tipo !== 'porteiro') throw new Error('Apenas a portaria pode registrar encomendas.');
  if (!morador?.id) throw new Error('Selecione um morador válido antes de confirmar a chegada.');
  if (morador?.condominioId && morador.condominioId !== condominioAtual) {
    throw new Error('O morador selecionado não pertence ao mesmo condomínio desta portaria. Atualize a lista e selecione novamente.');
  }
  if (descricaoLimpa.length > LIMITE_DESCRICAO) throw new Error(`A descrição deve ter no máximo ${LIMITE_DESCRICAO} caracteres.`);

  const encomendaRef = doc(collection(db, 'encomendas'));
  const notificacaoRef = doc(collection(db, 'notificacoes'));
  const auditoriaRef = doc(collection(db, 'auditoria'));

  const historico: HistoricoEvento[] = [];
  if (previsao) {
    historico.push({
      tipo: 'prevista',
      titulo: 'Prevista pelo morador',
      data: previsao.criadaEm?.toDate?.()?.toISOString?.() || agoraISO(),
      atorId: morador.id,
      atorNome: morador.nome,
      observacao: previsao.descricao || '',
    });
  }
  historico.push(evento('recebida', 'Recebida pela portaria', uidAtual, perfil.nome));
  historico.push(evento('pendente', 'Aguardando retirada', uidAtual, perfil.nome));

  // A foto e o texto bruto do OCR nunca são persistidos. A encomenda guarda
  // somente a origem e a pontuação de correspondência, quando houver OCR.
  await setDoc(encomendaRef, {
    moradorId: morador.id,
    moradorNome: morador.nome,
    bloco: morador.bloco || '',
    apartamento: morador.apartamento || '',
    descricao: descricaoLimpa || previsao?.descricao || '',
    ocrScore: ocrMeta?.topScore || 0,
    origem: ocrMeta ? 'ocr' : 'manual',
    status: 'pendente',
    porteiroId: uidAtual,
    porteiroNome: perfil.nome,
    condominioId: condominioAtual,
    codigoReferencia: encomendaRef.id.slice(0, 8).toUpperCase(),
    previsaoId: previsao?.id || '',
    recebidaEm: serverTimestamp(),
    retiradaEm: null,
    historico,
    lembrete3dEnviado: false,
  });

  const avisos: string[] = [];
  let notificacaoCriada = false;

  try {
    await setDoc(notificacaoRef, {
      destinatarioTipo: 'morador',
      moradorId: morador.id,
      condominioId: condominioAtual,
      encomendaId: encomendaRef.id,
      referenciaId: encomendaRef.id,
      mensagem: `Sua encomenda chegou à portaria${descricaoLimpa ? `: ${descricaoLimpa}` : ''}.`,
      tipo: 'chegada',
      lida: false,
      criadaEm: serverTimestamp(),
    });
    notificacaoCriada = true;
  } catch (erro: any) {
    const codigo = String(erro?.code || '');
    avisos.push(codigo.includes('permission-denied')
      ? 'A encomenda foi registrada, mas o aviso do morador foi bloqueado pelas regras do Firestore. Publique as regras atuais com npm run firebase:deploy.'
      : 'A encomenda foi registrada, mas não foi possível criar o aviso do morador agora.');
  }

  const tarefasAuxiliares: Promise<unknown>[] = [
    setDoc(auditoriaRef, {
      encomendaId: encomendaRef.id,
      condominioId: condominioAtual,
      moradorId: morador.id,
      atorId: uidAtual,
      atorNome: perfil.nome,
      acao: 'chegada_registrada',
      criadoEm: serverTimestamp(),
    }),
  ];

  if (ocrMeta) {
    const leituraRef = doc(collection(db, 'ocrLeituras'));
    tarefasAuxiliares.push(setDoc(leituraRef, {
      condominioId: condominioAtual,
      porteiroId: uidAtual,
      porteiroNome: perfil.nome || '',
      motorOCR: 'ocr-space',
      tipoTexto: ocrMeta.tipoTexto,
      iluminacao: ocrMeta.iluminacao,
      tempoMs: ocrMeta.tempoMs,
      nomeDetectado: ocrMeta.nomeDetectado || '',
      cpfDetectado: ocrMeta.cpfDetectado || '',
      blocoDetectado: ocrMeta.blocoDetectado || '',
      apartamentoDetectado: ocrMeta.apartamentoDetectado || '',
      topCandidatoId: ocrMeta.topCandidatoId || '',
      topScore: ocrMeta.topScore || 0,
      confirmado: true,
      encomendaId: encomendaRef.id,
      moradorConfirmadoId: morador.id,
      moradorConfirmadoNome: morador.nome || '',
      confirmadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
    }));

    const testeRef = doc(collection(db, 'ocrTestes'));
    tarefasAuxiliares.push(setDoc(testeRef, {
      condominioId: condominioAtual,
      porteiroId: uidAtual,
      porteiroNome: perfil.nome || '',
      encomendaId: encomendaRef.id,
      tipoTexto: ocrMeta.tipoTexto,
      iluminacao: ocrMeta.iluminacao,
      tempoMs: ocrMeta.tempoMs,
      topCandidatoId: ocrMeta.topCandidatoId || '',
      topScore: ocrMeta.topScore || 0,
      moradorConfirmadoId: morador.id,
      moradorConfirmadoNome: morador.nome || '',
      acertoTop1: !!ocrMeta.topCandidatoId && ocrMeta.topCandidatoId === morador.id,
      nomeDetectado: ocrMeta.nomeDetectado || '',
      cpfDetectado: ocrMeta.cpfDetectado || '',
      blocoDetectado: ocrMeta.blocoDetectado || '',
      apartamentoDetectado: ocrMeta.apartamentoDetectado || '',
      reconheceuNome: ocrMeta.reconheceuNome,
      reconheceuCpf: ocrMeta.reconheceuCpf,
      reconheceuBloco: ocrMeta.reconheceuBloco,
      reconheceuApartamento: ocrMeta.reconheceuApartamento,
      criadoEm: serverTimestamp(),
    }));
  }

  const resultadosAuxiliares = await Promise.allSettled(tarefasAuxiliares);
  if (resultadosAuxiliares.some(resultado => resultado.status === 'rejected')) {
    avisos.push('A chegada foi salva. Alguns dados auxiliares de auditoria/OCR não puderam ser gravados, mas isso não altera a encomenda.');
  }

  return { id: encomendaRef.id, notificacaoCriada, avisos };
}

export async function registrarRetirada(encomenda: Encomenda, perfil: any) {
  if (perfil?.tipo !== 'porteiro') throw new Error('Apenas a portaria pode registrar retiradas.');
  if (!perfil?.condominioId || encomenda.condominioId !== perfil.condominioId) throw new Error('Esta encomenda não pertence ao condomínio da portaria.');

  const encomendaRef = doc(db, 'encomendas', encomenda.id);
  const notificacaoRef = doc(collection(db, 'notificacoes'));
  const auditoriaRef = doc(collection(db, 'auditoria'));

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(encomendaRef);
    if (!snap.exists()) throw new Error('Encomenda não encontrada.');
    const atual = { id: snap.id, ...snap.data() } as any;
    if (atual.condominioId !== perfil.condominioId) throw new Error('Esta encomenda não pertence ao condomínio da portaria.');
    if (atual.status !== 'pendente') return false;

    const ev = evento('retirada', 'Retirada registrada', perfil.id, perfil.nome);
    transaction.update(encomendaRef, {
      status: 'retirada',
      retiradaEm: serverTimestamp(),
      retiradaPorId: perfil.id,
      retiradaPorNome: perfil.nome,
      historico: arrayUnion(ev),
    });
    transaction.set(notificacaoRef, {
      destinatarioTipo: 'morador',
      moradorId: atual.moradorId,
      condominioId: atual.condominioId,
      encomendaId: atual.id,
      referenciaId: atual.id,
      mensagem: 'A retirada da sua encomenda foi registrada pela portaria.',
      tipo: 'retirada',
      lida: false,
      criadaEm: serverTimestamp(),
    });
    transaction.set(auditoriaRef, {
      encomendaId: atual.id,
      condominioId: atual.condominioId,
      moradorId: atual.moradorId,
      atorId: perfil.id,
      atorNome: perfil.nome,
      acao: 'retirada_registrada',
      criadoEm: serverTimestamp(),
    });
    return true;
  });
}

export async function enviarLembreteAtrasado(encomenda: Encomenda, perfil: any) {
  if (perfil?.tipo !== 'porteiro' || !perfil?.condominioId) return false;
  const encomendaRef = doc(db, 'encomendas', encomenda.id);
  const notificacaoRef = doc(collection(db, 'notificacoes'));
  const auditoriaRef = doc(collection(db, 'auditoria'));

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(encomendaRef);
    if (!snap.exists()) return false;
    const atual = { id: snap.id, ...snap.data() } as any;
    if (atual.condominioId !== perfil.condominioId) return false;
    if (atual.lembrete3dEnviado || atual.status !== 'pendente') return false;
    const recebidaEm = atual.recebidaEm?.toDate?.()?.getTime?.() || 0;
    if (!recebidaEm || Date.now() - recebidaEm < 3 * 86400000) return false;

    const ev = evento('lembrete', 'Lembrete de retirada enviado', perfil.id, perfil.nome);
    transaction.update(encomendaRef, {
      lembrete3dEnviado: true,
      historico: arrayUnion(ev),
    });
    transaction.set(notificacaoRef, {
      destinatarioTipo: 'morador',
      moradorId: atual.moradorId,
      condominioId: atual.condominioId,
      encomendaId: atual.id,
      referenciaId: atual.id,
      mensagem: 'Sua encomenda está há mais de 3 dias aguardando retirada na portaria.',
      tipo: 'lembrete',
      lida: false,
      criadaEm: serverTimestamp(),
    });
    transaction.set(auditoriaRef, {
      encomendaId: atual.id,
      condominioId: atual.condominioId,
      moradorId: atual.moradorId,
      atorId: perfil.id,
      atorNome: perfil.nome,
      acao: 'lembrete_3_dias',
      criadoEm: serverTimestamp(),
    });
    return true;
  });
}
