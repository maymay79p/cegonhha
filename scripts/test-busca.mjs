import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const arquivo = path.resolve(process.cwd(), 'utils/busca.ts');
const fonte = fs.readFileSync(arquivo, 'utf8');
const js = ts.transpileModule(fonte, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const modulo = { exports: {} };
new Function('module', 'exports', 'require', js)(modulo, modulo.exports, require);
const { normalizarBusca, montarTextoBuscaPessoa, montarTextoBuscaEncomenda, correspondeBusca } = modulo.exports;

const pessoa = {
  nome: 'João da Silva',
  email: 'joao@example.com',
  cpf: '123.456.789-09',
  tipo: 'morador',
  bloco: 'B',
  apartamento: '203',
};
const pessoaIndex = montarTextoBuscaPessoa(pessoa);
assert.equal(correspondeBusca(pessoaIndex, 'joao'), true, 'deve encontrar nome sem acento');
assert.equal(correspondeBusca(pessoaIndex, 'bloco b'), true, 'deve encontrar bloco com rótulo');
assert.equal(correspondeBusca(pessoaIndex, 'bl B'), true, 'deve encontrar abreviação de bloco');
assert.equal(correspondeBusca(pessoaIndex, 'apartamento 203'), true, 'deve encontrar apartamento com rótulo');
assert.equal(correspondeBusca(pessoaIndex, 'apto 203'), true, 'deve encontrar abreviação apto');
assert.equal(correspondeBusca(pessoaIndex, 'ap 203'), true, 'deve encontrar abreviação ap');
assert.equal(correspondeBusca(pessoaIndex, 'joao bloco b 203'), true, 'deve combinar múltiplos termos');
assert.equal(correspondeBusca(pessoaIndex, 'bloco z'), false, 'não deve retornar bloco diferente');
assert.equal(correspondeBusca(pessoaIndex, 'bloco a'), false, 'letra presente no nome não pode causar falso positivo no bloco');
assert.equal(correspondeBusca(pessoaIndex, 'ap 20'), false, 'valor curto precisa coincidir como palavra inteira');

const encomenda = {
  moradorNome: 'Maria Souza',
  bloco: 'A',
  apartamento: '101',
  descricao: 'Caixa pequena',
  codigoReferencia: 'AB12CD34',
  status: 'pendente',
};
const encomendaIndex = montarTextoBuscaEncomenda(encomenda);
assert.equal(correspondeBusca(encomendaIndex, 'bloco a'), true);
assert.equal(correspondeBusca(encomendaIndex, 'apartamento 101'), true);
assert.equal(correspondeBusca(encomendaIndex, 'apto 101 caixa'), true);
assert.equal(correspondeBusca(encomendaIndex, 'ab12cd34'), true);
assert.equal(correspondeBusca(encomendaIndex, 'maria ap 101'), true);
assert.equal(correspondeBusca(encomendaIndex, 'ap 999'), false);
assert.equal(correspondeBusca(encomendaIndex, 'bloco b'), false, 'não deve confundir bloco com letras do nome ou descrição');

assert.equal(normalizarBusca('  APÊ 203 / Bloco B  '), 'ape 203 bloco b');

console.log('Busca validada: nome, CPF/e-mail, bloco e apartamento com rótulos, abreviações e sem falsos positivos curtos.');
