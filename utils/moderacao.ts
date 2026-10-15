const TERMOS_BLOQUEADOS = new Set([
  'porra', 'caralho', 'merda', 'bosta', 'puta', 'puto', 'putaria', 'foda', 'foder', 'fodase',
  'fdp', 'vsf', 'buceta', 'boceta', 'cu', 'cuzao', 'piranha', 'vagabunda', 'vagabundo',
  'arrombado', 'arrombada', 'desgracado', 'desgracada', 'retardado', 'retardada', 'viado', 'viada',
  'otario', 'otaria', 'babaca', 'imbecil', 'idiota', 'escroto', 'escrota',
]);

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

export function contemLinguagemImpropria(texto: string = '') {
  const normalizado = normalizar(texto);
  const palavras = normalizado.split(/[^a-z0-9]+/).filter(Boolean);
  if (palavras.some(palavra => TERMOS_BLOQUEADOS.has(palavra))) return true;

  const compacto = normalizado.replace(/[^a-z0-9]/g, '');
  return ['fdp', 'vsf', 'fodase'].some(abreviacao => compacto === abreviacao);
}
