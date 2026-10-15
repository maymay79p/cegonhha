import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { buscarCondominioPorCodigo } from './condominios';

export type DadosSolicitacaoVinculo = {
  id: string;
  moradorId: string;
  moradorNome: string;
  email: string;
  bloco?: string;
  apartamento?: string;
  condominioId: string;
  condominioNome: string;
  condominioCodigo: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'concluida';
  criadoEm?: any;
  atualizadoEm?: any;
};

export function idSolicitacaoVinculo(moradorId: string, condominioId: string) {
  return moradorId + '_' + condominioId;
}

export async function solicitarVinculoPorCodigo({
  moradorId,
  moradorNome,
  email,
  bloco,
  apartamento,
  codigo,
}: {
  moradorId: string;
  moradorNome: string;
  email: string;
  bloco?: string;
  apartamento?: string;
  codigo: string;
}) {
  const condominio = await buscarCondominioPorCodigo(codigo);
  if (!condominio) {
    throw new Error('Código de condomínio inválido. Confira o código e tente novamente.');
  }

  const id = idSolicitacaoVinculo(moradorId, condominio.id);
  const ref = doc(db, 'solicitacoesCondominio', id);
  const atual = await getDoc(ref);

  if (atual.exists() && atual.data()?.status === 'aprovada') {
    return { id, condominio, status: 'aprovada' as const };
  }

  if (atual.exists() && atual.data()?.status === 'concluida') {
    return { id, condominio, status: 'concluida' as const };
  }

  await setDoc(ref, {
    moradorId,
    moradorNome,
    email,
    bloco: bloco || '',
    apartamento: apartamento || '',
    condominioId: condominio.id,
    condominioNome: condominio.nome,
    condominioCodigo: condominio.codigoExibicao,
    status: 'pendente',
    criadoEm: atual.exists() ? (atual.data()?.criadoEm || serverTimestamp()) : serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });

  return { id, condominio, status: 'pendente' as const };
}

export async function concluirVinculoAprovado({
  moradorId,
  solicitacaoId,
}: {
  moradorId: string;
  solicitacaoId: string;
}) {
  const solicitacaoRef = doc(db, 'solicitacoesCondominio', solicitacaoId);
  const solicitacaoSnap = await getDoc(solicitacaoRef);
  if (!solicitacaoSnap.exists()) throw new Error('Solicitação não encontrada.');

  const solicitacao = solicitacaoSnap.data() as any;
  if (solicitacao.moradorId !== moradorId) throw new Error('Esta solicitação não pertence à sua conta.');
  if (solicitacao.status !== 'aprovada') throw new Error('A portaria ainda não aprovou esta solicitação.');

  const usuarioRef = doc(db, 'usuarios', moradorId);
  const batch = writeBatch(db);
  batch.update(usuarioRef, {
    condominioId: solicitacao.condominioId,
    condominioNome: solicitacao.condominioNome,
    condominioCodigo: solicitacao.condominioCodigo,
    vinculoSolicitacaoId: solicitacaoId,
    vinculadoEm: serverTimestamp(),
  });
  batch.update(solicitacaoRef, {
    status: 'concluida',
    concluidaEm: serverTimestamp(),
  });
  await batch.commit();

  return {
    condominioId: solicitacao.condominioId,
    condominioNome: solicitacao.condominioNome,
    condominioCodigo: solicitacao.condominioCodigo,
  };
}

export async function cancelarSolicitacaoRejeitada(solicitacaoId: string) {
  await updateDoc(doc(db, 'solicitacoesCondominio', solicitacaoId), {
    status: 'rejeitada',
    atualizadoEm: serverTimestamp(),
  });
}
