import { signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase';

export async function excluirMinhaConta() {
  const functions = getFunctions(app);
  const excluir = httpsCallable(functions, 'excluirMinhaConta');
  try {
    await excluir({ confirmacao: 'EXCLUIR' });
    await signOut(auth).catch(() => {});
  } catch (erro: any) {
    const codigo = String(erro?.code || '');
    const mensagem = String(erro?.message || '');
    if (codigo.includes('failed-precondition')) {
      if (mensagem.toLowerCase().includes('última conta') || mensagem.toLowerCase().includes('ultima conta')) {
        throw new Error('Esta é a última conta da Portaria do condomínio. Vincule outra Portaria antes de excluir esta conta.');
      }
      throw new Error('Por segurança, saia e entre novamente na sua conta antes de tentar a exclusão.');
    }
    if (codigo.includes('unauthenticated')) throw new Error('Sua sessão expirou. Entre novamente e repita a exclusão.');
    throw new Error(mensagem || 'Não foi possível excluir a conta agora.');
  }
}
