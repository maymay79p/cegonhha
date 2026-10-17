import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const arquivo = path.resolve(process.cwd(), 'utils/ocrParser.ts');
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
const { extrairDadosEtiqueta, calcularCompatibilidadeOCR } = modulo.exports;

function caso(nome, texto, esperado) {
  const atual = extrairDadosEtiqueta(texto);
  for (const [campo, valor] of Object.entries(esperado)) {
    assert.equal(atual[campo], valor, `${nome}: ${campo} esperado ${JSON.stringify(valor)}, recebido ${JSON.stringify(atual[campo])}`);
  }
}

caso('rotulos completos', `
DESTINATÁRIO:
Maria Eduarda da Silva
CPF: 123.456.789-09
BLOCO: A
APARTAMENTO: 203
`, {
  nome: 'Maria Eduarda da Silva',
  cpf: '123.456.789-09',
  bloco: 'A',
  apartamento: '203',
});

caso('abreviacoes comuns', `
DEST. João Pedro Souza
CPF 987.654.321-00
BL. B
AP. 404
`, {
  nome: 'João Pedro Souza',
  cpf: '987.654.321-00',
  bloco: 'B',
  apartamento: '404',
});

caso('recebedor com valor na linha abaixo', `
RECEBEDOR
Ana Clara Ribeiro
DOC CPF
111.222.333-44
TORRE
2
APT
1205
`, {
  nome: 'Ana Clara Ribeiro',
  cpf: '111.222.333-44',
  bloco: '2',
  apartamento: '1205',
});

caso('destinatario tem prioridade sobre remetente', `
REMETENTE
Loja Exemplo Comercio Ltda
RUA CENTRAL 100
DESTINATÁRIO
Carla Mendes Ferreira
CPF: 222.333.444-55
BL C APTO 502
`, {
  nome: 'Carla Mendes Ferreira',
  cpf: '222.333.444-55',
  bloco: 'C',
  apartamento: '502',
});

caso('remetente isolado ainda reconhece nome contextual', `
REMETENTE:
Carlos Henrique Moraes
CPF: 333.444.555-66
BL: D
APTO: 77
`, {
  nome: 'Carlos Henrique Moraes',
  cpf: '333.444.555-66',
  bloco: 'D',
  apartamento: '77',
});

caso('morador abreviado', `
MOR.: Pedro Lucas Martins
CPF Nº 444.555.666-77
BLC E
UNID 908
`, {
  nome: 'Pedro Lucas Martins',
  cpf: '444.555.666-77',
  bloco: 'E',
  apartamento: '908',
});

caso('bloco e apartamento combinados', `
Nome do recebedor: Luiza Rocha Alves
CPF: 555.666.777-88
BL/AP: F/303
`, {
  nome: 'Luiza Rocha Alves',
  cpf: '555.666.777-88',
  bloco: 'F',
  apartamento: '303',
});

caso('rotulos em linhas separadas', `
CLIENTE
Rafael de Lima Costa
CPF
66677788899
BLOCO
G
APTO
12B
`, {
  nome: 'Rafael de Lima Costa',
  cpf: '666.777.888-99',
  bloco: 'G',
  apartamento: '12B',
});

caso('confusao OCR em numero do CPF', `
DESTINATARIA: Bianca Souza Lopes
CPF: 123.456.789-O9
TORRE: 3
AP: 1001
`, {
  nome: 'Bianca Souza Lopes',
  cpf: '123.456.789-09',
  bloco: '3',
  apartamento: '1001',
});

caso('endereco nao vira nome', `
DESTINATÁRIO
Marcos Vinicius Nunes
Avenida Sete de Setembro 1200
Bairro Centro
CEP 96400-000
APTO 701
BL 1
`, {
  nome: 'Marcos Vinicius Nunes',
  bloco: '1',
  apartamento: '701',
});

const dadosParciais = extrairDadosEtiqueta(`
RECEB.
Marina Collares
BL A
AP 101
`);
const scoreCorreto = calcularCompatibilidadeOCR(dadosParciais, {
  nome: 'Marina de Souza Collares',
  cpf: '',
  bloco: 'A',
  apartamento: '101',
}, 'RECEB. Marina Collares BL A AP 101');
const scoreErrado = calcularCompatibilidadeOCR(dadosParciais, {
  nome: 'Joana Pereira',
  cpf: '',
  bloco: 'C',
  apartamento: '900',
}, 'RECEB. Marina Collares BL A AP 101');
assert.ok(scoreCorreto > scoreErrado, 'Compatibilidade deve favorecer o morador com nome/endereço compatíveis.');
assert.ok(scoreCorreto >= 0.7, `Compatibilidade esperada >= 0.7, recebida ${scoreCorreto}`);

// Simula a edição manual depois de uma leitura imperfeita. O ranking recalculado
// deve considerar os valores corrigidos, sem depender do texto bruto antigo.
const dadosCorrigidos = {
  nome: 'Ana Clara Ribeiro',
  cpf: '111.222.333-44',
  bloco: '2',
  apartamento: '1205',
};
const scoreCorrigidoCerto = calcularCompatibilidadeOCR(dadosCorrigidos, {
  nome: 'Ana Clara Ribeiro',
  cpf: '11122233344',
  bloco: '2',
  apartamento: '1205',
}, '');
const scoreCorrigidoErrado = calcularCompatibilidadeOCR(dadosCorrigidos, {
  nome: 'Ana Paula Martins',
  cpf: '99988877766',
  bloco: '4',
  apartamento: '305',
}, '');
assert.ok(scoreCorrigidoCerto > 0.95, `Correção manual deveria produzir compatibilidade alta; recebida ${scoreCorrigidoCerto}`);
assert.ok(scoreCorrigidoCerto > scoreCorrigidoErrado, 'Após editar os dados, o morador corrigido deve liderar o ranking.');

console.log('Parser OCR validado: abreviações, recebedor/remetente, CPF, bloco, apartamento, correção manual e ranking de morador.');
