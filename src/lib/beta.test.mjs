import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ORIGEM_DIRECTO,
  ORIGEM_INVALIDA,
  csv,
  normalizarTelemovel,
  numeroFormatado,
  origemDoUrl,
  porOrigem,
  validar,
} from './beta.js'

const CFG = { aberto: true, origens: ['amigo-familia', 'alguem-mercado', 'vi-mercado', 'outro'] }

test('origem do URL: criterios de aceitacao do brief', () => {
  assert.equal(origemDoUrl('?via=grupo-alges'), 'grupo-alges')
  assert.equal(origemDoUrl(''), ORIGEM_DIRECTO)
  assert.equal(origemDoUrl('?outracoisa=1'), ORIGEM_DIRECTO)
})

test('origem do URL: o continua a ser lido, mas via manda', () => {
  assert.equal(origemDoUrl('?o=cartaz-talho'), 'cartaz-talho')
  assert.equal(origemDoUrl('?via=mesa&o=saco'), 'mesa')
})

test('origem do URL: lixo fica invalido, nao directo', () => {
  assert.equal(origemDoUrl('?via=Grupo_Alges!'), ORIGEM_INVALIDA)
  assert.equal(origemDoUrl('?via=' + 'x'.repeat(41)), ORIGEM_INVALIDA)
})

test('origem do URL: maiusculas e espacos sao normalizados', () => {
  assert.equal(origemDoUrl('?via=MERCADO'), 'mercado')
  assert.equal(origemDoUrl('?via=%20mesa%20'), 'mesa')
})

test('telemovel: fica so com digitos', () => {
  assert.equal(normalizarTelemovel('912 345 678'), '912345678')
  assert.equal(normalizarTelemovel('+351 912-345-678'), '351912345678')
})

test('validacao: sem confirmar a leitura do aviso e bloqueado', () => {
  const base = { nome: 'Ana', telemovel: '912345678', origem_declarada: 'vi-mercado', maioridade: true }
  assert.deepEqual(validar({ ...base, aviso_lido: true }, CFG), [])
  assert.ok(validar({ ...base, aviso_lido: false }, CFG).length === 1)
})

test('validacao: sem confirmar mais de 18 e bloqueado', () => {
  const base = { nome: 'Ana', telemovel: '912345678', origem_declarada: 'vi-mercado', aviso_lido: true }
  assert.deepEqual(validar({ ...base, maioridade: true }, CFG), [])
  assert.ok(validar({ ...base, maioridade: false }, CFG).length === 1)
})

test('validacao: apanha nome curto, telemovel mau e origem fora da lista', () => {
  const erros = validar(
    { nome: 'A', telemovel: '12', origem_declarada: 'inventada', aviso_lido: true, maioridade: true },
    CFG,
  )
  assert.equal(erros.length, 3)
})

test('numero do cartao: tres digitos com zeros a esquerda', () => {
  assert.equal(numeroFormatado(37), '037')
  assert.equal(numeroFormatado(1), '001')
  assert.equal(numeroFormatado(999), '999')
  assert.equal(numeroFormatado(1000), '1000')
  assert.equal(numeroFormatado(null), '000')
})

test('CSV: devolve todas as colunas, com BOM e ponto-e-virgula', () => {
  const saida = csv([
    {
      numero: 7, nome: 'Ana "A" Silva', telemovel: '912345678',
      origem_param: 'grupo-alges', origem_declarada: 'amigo-familia',
      criado_em: '2026-09-01T10:00:00Z', aviso_lido_em: '2026-09-01T10:00:00Z',
      aviso_versao: '2026-09-01.v1',
      contacto_pos_beta: true, contacto_pos_beta_em: '2026-09-01T10:00:00Z',
      ultima_interacao_em: '2026-09-01T10:00:00Z',
      vaga: 1, estado: 'inscrito',
      expira_em: '2027-09-01',
    },
  ])
  assert.ok(saida.startsWith('\ufeff'))
  assert.equal(saida.split('\r\n')[0].split(';').length, 14)
  assert.ok(saida.includes('"007"'))
  assert.ok(saida.includes('"Ana ""A"" Silva"'))
})

test('por origem: mede a discrepancia entre o que dizem e o que o URL trouxe', () => {
  const [qr] = porOrigem([
    { origem_declarada: 'vi-mercado', origem_param: 'cartaz-talho' },
    { origem_declarada: 'vi-mercado', origem_param: ORIGEM_DIRECTO },
    { origem_declarada: 'vi-mercado', origem_param: ORIGEM_DIRECTO },
    { origem_declarada: 'alguem-mercado', origem_param: ORIGEM_DIRECTO },
  ])
  assert.equal(qr.origem, 'vi-mercado')
  assert.equal(qr.total, 3)
  assert.equal(qr.semParametro, 2)
  assert.equal(qr.pctSemParametro, 67)
})
