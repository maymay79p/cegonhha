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

function textoSeguro(valor: unknown) {
  return typeof valor === 'string' ? valor : valor == null ? '' : String(valor);
}

function evento(
  tipo: HistoricoEvento['tipo'],
  titulo: string,
  atorId?: string,
  atorNome?: string,
  observacao?: string,
): HistoricoEvento {
  const item: HistoricoEvento = {
    tipo,
    titulo,
    data: agoraISO(),
  };

  // Firestore rejeita `undefined`, inclusive dentro de objetos em arrays.
  // Só adicionamos os campos opcionais quando eles realmente possuem valor.
  if (atorId) item.atorId = atorId;
  if (atorNome) item.atorNome = atorNome;
  if (observacao) item.observacao = observacao;
  return item;
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
  const uidAtual = textoSeguro(auth.currentUser?.uid || perfil?.id).trim();
  const condominioAtual = textoSeguro(perfil?.condominioId).trim();
  const nomePorteiro = textoSeguro(perfil?.nome).trim();
  const nomeMorador = textoSeguro(morador?.nome).trim();
  const descricaoLimpa = textoSeguro(descricao).trim();

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
      atorId: textoSeguro(morador.id),
      atorNome: nomeMorador,
      observacao: textoSeguro(previsao.descricao),
    });
  }
  historico.push(evento('recebida', 'Recebida pela portaria', uidAtual, nomePorteiro));
  historico.push(evento('pendente', 'Aguardando retirada', uidAtual, nomePorteiro));

  // A foto e o texto bruto do OCR nunca são persistidos. A encomenda guarda
  // somente a origem e a pontuação de correspondência, quando houver OCR.
  await setDoc(encomendaRef, {
    moradorId: textoSeguro(morador.id),
    moradorNome: nomeMorador,
    bloco: textoSeguro(morador.bloco),
    apartamento: textoSeguro(morador.apartamento),
    descricao: descricaoLimpa || textoSeguro(previsao?.descricao),
    ocrScore: Number(ocrMeta?.topScore || 0),
    origem: ocrMeta ? 'ocr' : 'manual',
    status: 'pendente',
    porteiroId: uidAtual,
    porteiroNome: nomePorteiro,
    condominioId: condominioAtual,
    codigoReferencia: encomendaRef.id.slice(0, 8).toUpperCase(),
    previsaoId: textoSeguro(previsao?.id),
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
      moradorId: textoSeguro(morador.id),
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
      moradorId: textoSeguro(morador.id),
      atorId: uidAtual,
      atorNome: nomePorteiro,
      acao: 'chegada_registrada',
      criadoEm: serverTimestamp(),
    }),
  ];

  if (ocrMeta) {
    const leituraRef = doc(collection(db, 'ocrLeituras'));
    tarefasAuxiliares.push(setDoc(leituraRef, {
      condominioId: condominioAtual,
      porteiroId: uidAtual,
      porteiroNome: nomePorteiro,
      motorOCR: 'ocr-space',
      tipoTexto: textoSeguro(ocrMeta.tipoTexto),
      iluminacao: textoSeguro(ocrMeta.iluminacao),
      tempoMs: Number(ocrMeta.tempoMs || 0),
      nomeDetectado: textoSeguro(ocrMeta.nomeDetectado),
      cpfDetectado: textoSeguro(ocrMeta.cpfDetectado),
      blocoDetectado: textoSeguro(ocrMeta.blocoDetectado),
      apartamentoDetectado: textoSeguro(ocrMeta.apartamentoDetectado),
      topCandidatoId: textoSeguro(ocrMeta.topCandidatoId),
      topScore: Number(ocrMeta.topScore || 0),
      confirmado: true,
      encomendaId: encomendaRef.id,
      moradorConfirmadoId: textoSeguro(morador.id),
      moradorConfirmadoNome: nomeMorador,
      confirmadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
    }));

    const testeRef = doc(collection(db, 'ocrTestes'));
    tarefasAuxiliares.push(setDoc(testeRef, {
      condominioId: condominioAtual,
      porteiroId: uidAtual,
      porteiroNome: nomePorteiro,
      encomendaId: encomendaRef.id,
      tipoTexto: textoSeguro(ocrMeta.tipoTexto),
      iluminacao: textoSeguro(ocrMeta.iluminacao),
      tempoMs: Number(ocrMeta.tempoMs || 0),
      topCandidatoId: textoSeguro(ocrMeta.topCandidatoId),
      topScore: Number(ocrMeta.topScore || 0),
      moradorConfirmadoId: textoSeguro(morador.id),
      moradorConfirmadoNome: nomeMorador,
      acertoTop1: !!ocrMeta.topCandidatoId && ocrMeta.topCandidatoId === morador.id,
      nomeDetectado: textoSeguro(ocrMeta.nomeDetectado),
      cpfDetectado: textoSeguro(ocrMeta.cpfDetectado),
      blocoDetectado: textoSeguro(ocrMeta.blocoDetectado),
      apartamentoDetectado: textoSeguro(ocrMeta.apartamentoDetectado),
      reconheceuNome: Boolean(ocrMeta.reconheceuNome),
      reconheceuCpf: Boolean(ocrMeta.reconheceuCpf),
      reconheceuBloco: Boolean(ocrMeta.reconheceuBloco),
      reconheceuApartamento: Boolean(ocrMeta.reconheceuApartamento),
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
  const nomePorteiro = textoSeguro(perfil?.nome).trim();
  const porteiroId = textoSeguro(perfil?.id || auth.currentUser?.uid).trim();

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(encomendaRef);
    if (!snap.exists()) throw new Error('Encomenda não encontrada.');
    const atual = { id: snap.id, ...snap.data() } as any;
    if (atual.condominioId !== perfil.condominioId) throw new Error('Esta encomenda não pertence ao condomínio da portaria.');
    if (atual.status !== 'pendente') return false;

    const ev = evento('retirada', 'Retirada registrada', porteiroId, nomePorteiro);
    transaction.update(encomendaRef, {
      status: 'retirada',
      retiradaEm: serverTimestamp(),
      retiradaPorId: porteiroId,
      retiradaPorNome: nomePorteiro,
      historico: arrayUnion(ev),
    });
    transaction.set(notificacaoRef, {
      destinatarioTipo: 'morador',
      moradorId: textoSeguro(atual.moradorId),
      condominioId: textoSeguro(atual.condominioId),
      encomendaId: atual.id,
      referenciaId: atual.id,
      mensagem: 'A retirada da sua encomenda foi registrada pela portaria.',
      tipo: 'retirada',
      lida: false,
      criadaEm: serverTimestamp(),
    });
    transaction.set(auditoriaRef, {
      encomendaId: atual.id,
      condominioId: textoSeguro(atual.condominioId),
      moradorId: textoSeguro(atual.moradorId),
      atorId: porteiroId,
      atorNome: nomePorteiro,
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
  const nomePorteiro = textoSeguro(perfil?.nome).trim();
  const porteiroId = textoSeguro(perfil?.id || auth.currentUser?.uid).trim();

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(encomendaRef);
    if (!snap.exists()) return false;
    const atual = { id: snap.id, ...snap.data() } as any;
    if (atual.condominioId !== perfil.condominioId) return false;
    if (atual.lembrete3dEnviado || atual.status !== 'pendente') return false;
    const recebidaEm = atual.recebidaEm?.toDate?.()?.getTime?.() || 0;
    if (!recebidaEm || Date.now() - recebidaEm < 3 * 86400000) return false;

    const ev = evento('lembrete', 'Lembrete de retirada enviado', porteiroId, nomePorteiro);
    transaction.update(encomendaRef, {
      lembrete3dEnviado: true,
      historico: arrayUnion(ev),
    });
    transaction.set(notificacaoRef, {
      destinatarioTipo: 'morador',
      moradorId: textoSeguro(atual.moradorId),
      condominioId: textoSeguro(atual.condominioId),
      encomendaId: atual.id,
      referenciaId: atual.id,
      mensagem: 'Sua encomenda está há mais de 3 dias aguardando retirada na portaria.',
      tipo: 'lembrete',
      lida: false,
      criadaEm: serverTimestamp(),
    });
    transaction.set(auditoriaRef, {
      encomendaId: atual.id,
      condominioId: textoSeguro(atual.condominioId),
      moradorId: textoSeguro(atual.moradorId),
      atorId: porteiroId,
      atorNome: nomePorteiro,
      acao: 'lembrete_3_dias',
      criadoEm: serverTimestamp(),
    });
    return true;
  });
}
