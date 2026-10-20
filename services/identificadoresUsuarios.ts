import * as Crypto from 'expo-crypto';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { somenteDigitos } from '../utils/validacao';

type DadosUsuario = Record<string, any>;
type DadosCondominio = {
  id: string;
  nome: string;
  codigoExibicao: string;
};

function normalizarCPF(valor: unknown) {
  return somenteDigitos(String(valor || ''));
}

function normalizarTelefone(valor: unknown) {
  return somenteDigitos(String(valor || ''));
}

async function idIdentificador(tipo: 'cpf' | 'telefone', valor: string) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${tipo}:${valor}`,
  );
  return `${tipo}_${hash}`;
}

async function refsIdentificadores(cpf: string, telefone: string) {
  const [cpfId, telefoneId] = await Promise.all([
    idIdentificador('cpf', cpf),
    idIdentificador('telefone', telefone),
  ]);
  return {
    cpfRef: doc(db, 'identificadoresUsuarios', cpfId),
    telefoneRef: doc(db, 'identificadoresUsuarios', telefoneId),
    cpfId,
    telefoneId,
  };
}

function erroUnicidade(e: any): never {
  const codigo = String(e?.code || '');
  if (codigo.includes('permission-denied') || codigo.includes('already-exists')) {
    throw new Error('CPF ou telefone já está vinculado a outra conta. Confira os dados ou entre na conta já existente.');
  }
  throw e;
}

export async function salvarCadastroComIdentificadores(params: {
  uid: string;
  cpf: string;
  telefone: string;
  dadosUsuario: DadosUsuario;
  condominio?: DadosCondominio | null;
}) {
  const cpf = normalizarCPF(params.cpf);
  const telefone = normalizarTelefone(params.telefone);
  if (cpf.length !== 11 || telefone.length < 10) throw new Error('CPF ou telefone inválido para concluir o cadastro.');

  const { cpfRef, telefoneRef, cpfId, telefoneId } = await refsIdentificadores(cpf, telefone);
  const usuarioRef = doc(db, 'usuarios', params.uid);

  try {
    await runTransaction(db, async transaction => {
      transaction.set(cpfRef, {
        uid: params.uid,
        tipo: 'cpf',
        chave: cpfId,
        atualizadoEm: serverTimestamp(),
      });
      transaction.set(telefoneRef, {
        uid: params.uid,
        tipo: 'telefone',
        chave: telefoneId,
        atualizadoEm: serverTimestamp(),
      });

      if (params.condominio) {
        const condominioRef = doc(db, 'condominios', params.condominio.id);
        transaction.set(condominioRef, {
          nome: params.condominio.nome,
          codigo: params.condominio.id,
          codigoExibicao: params.condominio.codigoExibicao,
          criadoPor: params.uid,
          criadoEm: serverTimestamp(),
        });
      }

      transaction.set(usuarioRef, {
        ...params.dadosUsuario,
        cpf,
        telefoneDigitos: telefone,
      });
    });
  } catch (e: any) {
    erroUnicidade(e);
  }
}

export async function atualizarPerfilComIdentificadores(params: {
  uid: string;
  cpfAnterior: string;
  telefoneAnterior: string;
  cpfNovo: string;
  telefoneNovo: string;
  dadosUsuario: DadosUsuario;
}) {
  const cpfAnterior = normalizarCPF(params.cpfAnterior);
  const telefoneAnterior = normalizarTelefone(params.telefoneAnterior);
  const cpfNovo = normalizarCPF(params.cpfNovo);
  const telefoneNovo = normalizarTelefone(params.telefoneNovo);
  if (cpfNovo.length !== 11 || telefoneNovo.length < 10) throw new Error('CPF ou telefone inválido.');

  const novos = await refsIdentificadores(cpfNovo, telefoneNovo);
  const antigos = await refsIdentificadores(cpfAnterior || cpfNovo, telefoneAnterior || telefoneNovo);
  const usuarioRef = doc(db, 'usuarios', params.uid);

  try {
    await runTransaction(db, async transaction => {
      transaction.set(novos.cpfRef, {
        uid: params.uid,
        tipo: 'cpf',
        chave: novos.cpfId,
        atualizadoEm: serverTimestamp(),
      });
      transaction.set(novos.telefoneRef, {
        uid: params.uid,
        tipo: 'telefone',
        chave: novos.telefoneId,
        atualizadoEm: serverTimestamp(),
      });

      transaction.update(usuarioRef, {
        ...params.dadosUsuario,
        cpf: cpfNovo,
        telefoneDigitos: telefoneNovo,
      });

      if (antigos.cpfId !== novos.cpfId) transaction.delete(antigos.cpfRef);
      if (antigos.telefoneId !== novos.telefoneId) transaction.delete(antigos.telefoneRef);
    });
  } catch (e: any) {
    erroUnicidade(e);
  }
}
