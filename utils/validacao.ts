export function somenteDigitos(valor: string = '') {
  return valor.replace(/\D/g, '');
}

export function formatarCPF(valor: string = '') {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function validarCPF(valor: string = '') {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce((total, numero, indice) => total + Number(numero) * (pesoInicial - indice), 0);
    const resto = 11 - (soma % 11);
    return resto >= 10 ? 0 : resto;
  };

  const primeiro = calcularDigito(cpf.slice(0, 9), 10);
  const segundo = calcularDigito(cpf.slice(0, 9) + primeiro, 11);
  return cpf === `${cpf.slice(0, 9)}${primeiro}${segundo}`;
}

export function formatarTelefoneBR(valor: string = '') {
  const d = somenteDigitos(valor).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarTelefoneBR(valor: string = '') {
  const telefone = somenteDigitos(valor);
  if (telefone.length !== 10 && telefone.length !== 11) return false;
  if (/^(\d)\1+$/.test(telefone)) return false;

  const ddd = Number(telefone.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  if (telefone.length === 11 && telefone[2] !== '9') return false;
  return true;
}
