import * as Crypto from 'expo-crypto';
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { somenteDigitos } from '../utils/validacao';

type DadosUsuario = Record<string, any>;
type TipoIdentificador = 'cpf' | 'telefone' | 'email';
type DadosCondominio = {
  id: string;
  nome: string;
  codigoExibicao: string;
};

export type DadosDiretorioUsuario = {
  uid: string;
  nome: string;
  tipo: 'morador' | 'porteiro';
  condominioId: string;
  bloco: string;
  apartamento: string;
};

function normalizarCPF(valor: unknown) {
  return somenteDigitos(String(valor || ''));
}

function normalizarTelefone(valor: unknown) {
  return somenteDigitos(String(valor || ''));
}

function normalizarEmail(valor: unknown) {
  return String(valor || '').trim().toLowerCase();
}

function textoCurto(valor: unknown, limite: number) {
  return String(valor || '').trim().slice(0, limite);
}

function dadosDiretorio(uid: string, dados: DadosUsuario): DadosDiretorioUsuario {
  return {
    uid,
    nome: textoCurto(dados?.nome, 120),
    tipo: dados?.tipo === 'porteiro' ? 'porteiro' : 'morador',
    condominioId: textoCurto(dados?.condominioId, 32),
    bloco: dados?.tipo === 'morador' ? textoCurto(dados?.bloco, 30) : '',
    apartamento: dados?.tipo === 'morador' ? textoCurto(dados?.apartamento, 30) : '',
  };
}

async function idIdentificador(tipo: TipoIdentificador, valor: string) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${tipo}:${valor}`,
  );
  return `${tipo}_${hash}`;
}

async function refIdentificador(tipo: TipoIdentificador, valor: string) {
  const id = await idIdentificador(tipo, valor);
  return { id, ref: doc(db, 'identificadoresUsuarios', id) };
}

async function refsPessoais(cpf: string, telefone: string) {
  const [cpfIdentificador, telefoneIdentificador] = await Promise.all([
    refIdentificador('cpf', cpf),
    refIdentificador('telefone', telefone),
  ]);
  return {
    cpfRef: cpfIdentificador.ref,
    telefoneRef: telefoneIdentificador.ref,
    cpfId: cpfIdentificador.id,
    telefoneId: telefoneIdentificador.id,
  };
}

function erroUnicidade(e: any): never {
  const codigo = String(e?.code || '');
  if (codigo.includes('permission-denied') || codigo.includes('already-exists')) {
    throw new Error('CPF, telefone ou e-mail já está vinculado a outra conta. Confira os dados ou entre na conta já existente.');
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
  const email = normalizarEmail(params.dadosUsuario?.email);
  if (cpf.length !== 11 || telefone.length < 10 || !email.includes('@')) {
    throw new Error('CPF, telefone ou e-mail inválido para concluir o cadastro.');
  }

  const [{ cpfRef, telefoneRef, cpfId, telefoneId }, emailIdentificador] = await Promise.all([
    refsPessoais(cpf, telefone),
    refIdentificador('email', email),
  ]);
  const usuarioRef = doc(db, 'usuarios', params.uid);
  const diretorioRef = doc(db, 'diretorioUsuarios', params.uid);
  const dadosCompletos = {
    ...params.dadosUsuario,
    email,
    cpf,
    telefoneDigitos: telefone,
  };

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
      transaction.set(emailIdentificador.ref, {
        uid: params.uid,
        tipo: 'email',
        chave: emailIdentificador.id,
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

      transaction.set(usuarioRef, dadosCompletos);
      transaction.set(diretorioRef, {
        ...dadosDiretorio(params.uid, dadosCompletos),
        atualizadoEm: serverTimestamp(),
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

  const novos = await refsPessoais(cpfNovo, telefoneNovo);
  const antigos = await refsPessoais(cpfAnterior || cpfNovo, telefoneAnterior || telefoneNovo);
  const usuarioRef = doc(db, 'usuarios', params.uid);
  const diretorioRef = doc(db, 'diretorioUsuarios', params.uid);

  try {
    await runTransaction(db, async transaction => {
      const usuarioSnap = await transaction.get(usuarioRef);
      if (!usuarioSnap.exists()) throw new Error('Perfil não encontrado. Entre novamente e tente outra vez.');
      const atual = usuarioSnap.data() || {};
      const atualizados = {
        ...atual,
        ...params.dadosUsuario,
        cpf: cpfNovo,
        telefoneDigitos: telefoneNovo,
      };

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
      transaction.set(diretorioRef, {
        ...dadosDiretorio(params.uid, atualizados),
        atualizadoEm: serverTimestamp(),
      });

      if (antigos.cpfId !== novos.cpfId) transaction.delete(antigos.cpfRef);
      if (antigos.telefoneId !== novos.telefoneId) transaction.delete(antigos.telefoneRef);
    });
  } catch (e: any) {
    erroUnicidade(e);
  }
}

export async function sincronizarIdentificadoresExistentes(params: {
  uid: string;
  cpf?: string;
  telefone?: string;
  email?: string;
}) {
  const cpf = normalizarCPF(params.cpf);
  const telefone = normalizarTelefone(params.telefone);
  const email = normalizarEmail(params.email);
  if (cpf.length !== 11 || telefone.length < 10 || !email.includes('@')) return;

  const [{ cpfRef, telefoneRef, cpfId, telefoneId }, emailIdentificador] = await Promise.all([
    refsPessoais(cpf, telefone),
    refIdentificador('email', email),
  ]);

  await runTransaction(db, async transaction => {
    transaction.set(cpfRef, { uid:params.uid, tipo:'cpf', chave:cpfId, atualizadoEm:serverTimestamp() });
    transaction.set(telefoneRef, { uid:params.uid, tipo:'telefone', chave:telefoneId, atualizadoEm:serverTimestamp() });
    transaction.set(emailIdentificador.ref, { uid:params.uid, tipo:'email', chave:emailIdentificador.id, atualizadoEm:serverTimestamp() });
  });
}

export async function sincronizarDiretorioUsuario(params: DadosUsuario & { id?: string; uid?: string }) {
  const uid = String(params.id || params.uid || '').trim();
  if (!uid || !params.nome || !params.tipo) return;
  await setDoc(doc(db, 'diretorioUsuarios', uid), {
    ...dadosDiretorio(uid, params),
    atualizadoEm: serverTimestamp(),
  });
}
