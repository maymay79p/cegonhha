import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from '../firebase';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type Condominio = {
  id: string;
  codigo: string;
  codigoExibicao: string;
  nome: string;
  criadoPor?: string;
};

export function normalizarCodigoCondominio(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function formatarCodigoCondominio(valor: string) {
  const codigo = normalizarCodigoCondominio(valor);
  if (codigo.length <= 3) return codigo;
  return `${codigo.slice(0, 3)}-${codigo.slice(3)}`;
}

export function gerarCodigoCondominioAleatorio() {
  // O código funciona como segredo de convite. Como o alfabeto tem 32 símbolos,
  // byte % 32 distribui os valores uniformemente sem viés de módulo.
  const bytes = new Uint8Array(7);
  Crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ALFABETO[byte % ALFABETO.length]).join('');
}

export function prepararNovoCondominio(nome: string, criadorUid: string): Condominio {
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length < 3) throw new Error('Informe o nome do condomínio.');

  const codigo = gerarCodigoCondominioAleatorio();
  return {
    id: codigo,
    codigo,
    codigoExibicao: formatarCodigoCondominio(codigo),
    nome: nomeLimpo,
    criadoPor: criadorUid,
  };
}

export async function buscarCondominioPorCodigo(valor: string): Promise<Condominio | null> {
  const codigo = normalizarCodigoCondominio(valor);
  if (codigo.length !== 7) return null;

  const snapshot = await getDoc(doc(db, 'condominios', codigo));
  if (!snapshot.exists()) return null;

  const dados = snapshot.data();
  return {
    id: snapshot.id,
    codigo: snapshot.id,
    codigoExibicao: dados.codigoExibicao || formatarCodigoCondominio(snapshot.id),
    nome: dados.nome || 'Condomínio',
    criadoPor: dados.criadoPor,
  };
}

export async function criarCondominio(nome: string, criadorUid: string): Promise<Condominio> {
  const novo = prepararNovoCondominio(nome, criadorUid);

  await setDoc(doc(db, 'condominios', novo.id), {
    nome: novo.nome,
    codigo: novo.codigo,
    codigoExibicao: novo.codigoExibicao,
    criadoPor: criadorUid,
    criadoEm: serverTimestamp(),
  });

  return novo;
}
