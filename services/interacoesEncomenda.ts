import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export type TipoContestacaoEncomenda = 'nao_reconheco' | 'nao_retirei';

function textoSeguro(valor: unknown) {
  return typeof valor === 'string' ? valor : valor == null ? '' : String(valor);
}

export function idSolicitacaoRetirada(encomendaId: string) {
  return `${encomendaId}_retirada`;
}

export function idContestacaoEncomenda(encomendaId: string) {
  return `${encomendaId}_contestacao`;
}

export async function solicitarConfirmacaoRetirada(encomenda: any, perfil: any) {
  const uid = textoSeguro(auth.currentUser?.uid || perfil?.id).trim();
  const nome = textoSeguro(perfil?.nome).trim() || 'Morador';

  if (!uid || perfil?.tipo !== 'morador') {
    throw new Error('Apenas o morador da encomenda pode informar a retirada.');
  }

  const encomendaRef = doc(db, 'encomendas', encomenda.id);
  const interacaoRef = doc(db, 'interacoesEncomendas', idSolicitacaoRetirada(encomenda.id));
  const notificacaoRef = doc(collection(db, 'notificacoes'));

  return runTransaction(db, async transaction => {
    const [snapEncomenda, snapInteracao] = await Promise.all([
      transaction.get(encomendaRef),
      transaction.get(interacaoRef),
    ]);

    if (!snapEncomenda.exists()) throw new Error('Encomenda não encontrada.');
    const atual = { id: snapEncomenda.id, ...snapEncomenda.data() } as any;

    if (atual.moradorId !== uid) throw new Error('Esta encomenda não pertence à sua conta.');
    if (atual.status !== 'pendente') throw new Error('Esta encomenda já possui uma retirada registrada.');
    if (snapInteracao.exists()) return false;

    transaction.set(interacaoRef, {
      tipo: 'retirada_solicitada',
      status: 'pendente',
      encomendaId: atual.id,
      condominioId: textoSeguro(atual.condominioId),
      moradorId: uid,
      moradorNome: nome,
      codigoReferencia: textoSeguro(atual.codigoReferencia),
      criadaEm: serverTimestamp(),
    });

    transaction.set(notificacaoRef, {
      destinatarioTipo: 'porteiro',
      condominioId: textoSeguro(atual.condominioId),
      moradorId: uid,
      encomendaId: atual.id,
      referenciaId: interacaoRef.id,
      remetenteId: uid,
      remetenteNome: nome,
      mensagem: `${nome} informou que retirou a encomenda${atual.codigoReferencia ? ` #${atual.codigoReferencia}` : ''}. Confirme a retirada na portaria.`,
      tipo: 'retirada_solicitada',
      lidaPor: [],
      criadaEm: serverTimestamp(),
    });

    return true;
  });
}

export async function contestarEncomenda(encomenda: any, perfil: any, tipo: TipoContestacaoEncomenda) {
  const uid = textoSeguro(auth.currentUser?.uid || perfil?.id).trim();
  const nome = textoSeguro(perfil?.nome).trim() || 'Morador';

  if (!uid || perfil?.tipo !== 'morador') {
    throw new Error('Apenas o morador da encomenda pode registrar uma contestação.');
  }

  const encomendaRef = doc(db, 'encomendas', encomenda.id);
  const interacaoRef = doc(db, 'interacoesEncomendas', idContestacaoEncomenda(encomenda.id));
  const notificacaoRef = doc(collection(db, 'notificacoes'));

  return runTransaction(db, async transaction => {
    const [snapEncomenda, snapInteracao] = await Promise.all([
      transaction.get(encomendaRef),
      transaction.get(interacaoRef),
    ]);

    if (!snapEncomenda.exists()) throw new Error('Encomenda não encontrada.');
    const atual = { id: snapEncomenda.id, ...snapEncomenda.data() } as any;

    if (atual.moradorId !== uid) throw new Error('Esta encomenda não pertence à sua conta.');
    if (snapInteracao.exists()) return false;

    const motivo = tipo === 'nao_retirei'
      ? 'Morador informa que não realizou a retirada registrada.'
      : 'Morador informa que não reconhece esta encomenda como recebida por ele.';

    transaction.set(interacaoRef, {
      tipo: 'contestacao_encomenda',
      status: 'aberta',
      contestacaoTipo: tipo,
      motivo,
      encomendaId: atual.id,
      condominioId: textoSeguro(atual.condominioId),
      moradorId: uid,
      moradorNome: nome,
      codigoReferencia: textoSeguro(atual.codigoReferencia),
      criadaEm: serverTimestamp(),
    });

    transaction.set(notificacaoRef, {
      destinatarioTipo: 'porteiro',
      condominioId: textoSeguro(atual.condominioId),
      moradorId: uid,
      encomendaId: atual.id,
      referenciaId: interacaoRef.id,
      remetenteId: uid,
      remetenteNome: nome,
      mensagem: `${nome} contestou a encomenda${atual.codigoReferencia ? ` #${atual.codigoReferencia}` : ''}: ${motivo}`,
      tipo: 'contestacao_encomenda',
      lidaPor: [],
      criadaEm: serverTimestamp(),
    });

    return true;
  });
}

export async function confirmarSolicitacaoRetirada(encomendaId: string, perfil: any) {
  if (perfil?.tipo !== 'porteiro') return false;
  const ref = doc(db, 'interacoesEncomendas', idSolicitacaoRetirada(encomendaId));
  try {
    await updateDoc(ref, {
      status: 'confirmada',
      confirmadaEm: serverTimestamp(),
      confirmadaPorId: textoSeguro(auth.currentUser?.uid || perfil?.id),
      confirmadaPorNome: textoSeguro(perfil?.nome),
    });
    return true;
  } catch (erro: any) {
    if (String(erro?.code || '').includes('not-found')) return false;
    throw erro;
  }
}
