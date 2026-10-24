import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
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

async function buscarSolicitacaoExistenteDoMorador(moradorId: string, condominioId: string) {
  // Importante: não fazemos getDoc() direto no ID determinístico antes de a
  // solicitação existir. Pelas regras do Firestore, um documento inexistente
  // não possui resource.data para comprovar que pertence ao morador e o get é
  // corretamente negado. Uma query restrita ao próprio morador, por outro lado,
  // pode retornar uma lista vazia com segurança e funciona também na 1ª tentativa.
  const snap = await getDocs(query(
    collection(db, 'solicitacoesCondominio'),
    where('moradorId', '==', moradorId),
  ));
  const idEsperado = idSolicitacaoVinculo(moradorId, condominioId);
  return snap.docs.find(item => item.id === idEsperado) || null;
}

export async function solicitarVinculoPorCodigo({
  moradorId,
  moradorNome,
  email,
  bloco,
  apartamento,
  codigo,
  solicitanteTipo = 'morador',
}: {
  moradorId: string;
  moradorNome: string;
  email: string;
  bloco?: string;
  apartamento?: string;
  codigo: string;
  solicitanteTipo?: 'morador' | 'porteiro';
}) {
  const uidAtual = auth.currentUser?.uid || '';
  if (!uidAtual || uidAtual !== moradorId) {
    throw new Error('Sua sessão mudou. Entre novamente antes de solicitar o vínculo.');
  }

  const condominio = await buscarCondominioPorCodigo(codigo);
  if (!condominio) {
    throw new Error('Código de condomínio inválido. Confira o código e tente novamente.');
  }

  const id = idSolicitacaoVinculo(moradorId, condominio.id);
  const ref = doc(db, 'solicitacoesCondominio', id);
  const atual = await buscarSolicitacaoExistenteDoMorador(moradorId, condominio.id);
  const dadosAtuais = atual?.data() as any;

  if (atual && dadosAtuais?.status === 'aprovada') {
    return { id, condominio, status: 'aprovada' as const };
  }

  if (atual && dadosAtuais?.status === 'concluida') {
    return { id, condominio, status: 'concluida' as const };
  }

  if (atual && dadosAtuais?.status === 'pendente') {
    return { id, condominio, status: 'pendente' as const };
  }

  const notificacaoRef = doc(collection(db, 'notificacoes'));
  const batch = writeBatch(db);
  batch.set(ref, {
    moradorId,
    moradorNome,
    email,
    bloco: bloco || '',
    apartamento: apartamento || '',
    condominioId: condominio.id,
    condominioNome: condominio.nome,
    condominioCodigo: condominio.codigoExibicao,
    status: 'pendente',
    solicitanteTipo,
    criadoEm: atual ? (dadosAtuais?.criadoEm || serverTimestamp()) : serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
  batch.set(notificacaoRef, {
    destinatarioTipo: 'porteiro',
    condominioId: condominio.id,
    remetenteId: moradorId,
    remetenteNome: moradorNome,
    referenciaId: id,
    tipo: 'solicitacao_vinculo',
    mensagem: solicitanteTipo === 'porteiro'
      ? `${moradorNome} solicitou acesso como Portaria ao condomínio.`
      : `${moradorNome} solicitou entrada no condomínio${bloco || apartamento ? ` · Bloco ${bloco || '-'} · Ap. ${apartamento || '-'}` : ''}.`,
    lidaPor: [],
    criadaEm: serverTimestamp(),
  });
  await batch.commit();

  return { id, condominio, status: 'pendente' as const };
}

export async function concluirVinculoAprovado({
  moradorId,
  solicitacaoId,
}: {
  moradorId: string;
  solicitacaoId: string;
}) {
  const uidAtual = auth.currentUser?.uid || '';
  if (!uidAtual || uidAtual !== moradorId) {
    throw new Error('Sua sessão mudou. Entre novamente antes de concluir o vínculo.');
  }

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
    atualizadoEm: serverTimestamp(),
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
