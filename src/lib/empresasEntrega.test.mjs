// Testes das regras do registo de empresas de entrega.
//   npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  config, custoEntrega, mensagemErro, normalizarTelefone, parametros, paraNumero, telefoneValido, validar,
} from './empresasEntrega.js'

const OK = {
  nome_legal: 'Frota Exemplo, Lda.',
  nome_comercial: '',
  nipc: '500 000 000',
  contacto_nome: 'Ana Silva',
  contacto_email: ' Ana@Exemplo.PT ',
  contacto_telefone: '912 345 678',
  n_estafetas: '4',
  zona: 'Oeiras',
  tarifa_base: '2,50',
  tarifa_km: '0.45',
  aceita_termos: true,
  aviso_lido: true,
}

test('registo completo passa', () => assert.deepEqual(validar(OK), []))

test('NIPC com dígito de controlo errado falha', () => {
  assert.ok(validar({ ...OK, nipc: '500000001' }).some((e) => e.includes('NIPC')))
})

test('sem termos nem aviso falha com duas mensagens', () => {
  const e = validar({ ...OK, aceita_termos: false, aviso_lido: false })
  assert.equal(e.length, 2)
})

test('preços fora do intervalo falham', () => {
  assert.ok(validar({ ...OK, tarifa_base: '60' }).length)
  assert.ok(validar({ ...OK, tarifa_km: '-1' }).length)
  assert.ok(validar({ ...OK, tarifa_base: '' }).length)
})

test('número de estafetas é opcional mas tem de ser inteiro', () => {
  assert.deepEqual(validar({ ...OK, n_estafetas: '' }), [])
  assert.ok(validar({ ...OK, n_estafetas: '2.5' }).length)
})

test('telefone aceita formatos comuns', () => {
  assert.equal(normalizarTelefone('00351 912 345 678'), '+351912345678')
  assert.ok(telefoneValido('+351 912 345 678'))
  assert.ok(!telefoneValido('12345'))
})

test('vírgula decimal é aceite', () => assert.equal(paraNumero('2,5'), 2.5))

test('parametros limpa e normaliza', () => {
  const p = parametros(OK)
  assert.equal(p.p_nipc, '500000000')
  assert.equal(p.p_contacto_email, 'ana@exemplo.pt')
  assert.equal(p.p_contacto_telefone, '912345678')
  assert.equal(p.p_nome_comercial, null)
  assert.equal(p.p_n_estafetas, 4)
  assert.equal(p.p_tarifa_base, 2.5)
  assert.equal(p.p_tarifa_km, 0.45)
})

test('mensagens do servidor passam; erros internos não', () => {
  assert.equal(mensagemErro({ code: '23505', message: 'Já existe um registo activo para este NIPC.' }),
    'Já existe um registo activo para este NIPC.')
  assert.match(mensagemErro({ code: '500', message: 'stack trace' }), /Não foi possível/)
})

test('config cai para registo fechado', () => assert.equal(config(null).registo_aberto, false))

test('custo previsto usa o preço acordado', () => {
  assert.equal(custoEntrega({ tarifa_base: 2, tarifa_km: 0.4 }, 3.25), 3.3)
})
