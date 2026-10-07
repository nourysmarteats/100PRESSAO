import test from 'node:test'
import assert from 'node:assert/strict'
import { origemDespesa, partesSocios, tipoReceita, resumoFinanceiro } from './financeiroAnalytics.js'

const BOLSO = 'Renda [pago do bolso: Leandro 50% / Neide 50%]'

test('origem: etiqueta de bolso vs banco', () => {
  assert.equal(origemDespesa(BOLSO), 'bolso')
  assert.equal(origemDespesa('Leroy Merlin [extrato Revolut]'), 'banco')
  assert.equal(origemDespesa(null), 'banco')
})

test('partes: 50/50, nome único e percentagens que não somam 100', () => {
  assert.deepEqual(partesSocios(BOLSO), { Leandro: 0.5, Neide: 0.5 })
  assert.deepEqual(partesSocios('x [pago do bolso: Neide]'), { Neide: 1 })
  assert.deepEqual(partesSocios('x [pago do bolso: Leandro 30% / Neide 30%]'), { Leandro: 0.5, Neide: 0.5 })
  assert.deepEqual(partesSocios('sem etiqueta'), {})
})

test('tipo de receita', () => {
  assert.equal(tipoReceita({ canal: 'outro', notas: 'Aporte Neide [extrato Revolut]' }), 'aporte')
  assert.equal(tipoReceita({ canal: 'outro', notas: 'Teste de sistema IfThenPay' }), 'teste')
  assert.equal(tipoReceita({ canal: 'glovo', notas: null }), 'operacional')
})

test('resumo: totais, saldo do banco, dívida e meses sem buracos', () => {
  const despesas = [
    { data: '2026-03-08', valor: '300.00', categoria: 'Renda', descricao: BOLSO },
    { data: '2026-07-15', valor: '531.76', categoria: 'Obras', descricao: '[extrato Revolut]' },
    { data: '2026-07-11', valor: '10.00', categoria: 'Banco', descricao: null },
  ]
  const receitas = [
    { data: '2026-07-11', canal: 'outro', valor: '600.00', notas: 'Aporte Leandro' },
    { data: '2026-08-04', canal: 'outro', valor: '1.55', notas: 'Teste de sistema IfThenPay' },
  ]
  const r = resumoFinanceiro(despesas, receitas, new Date('2026-09-15T12:00:00'))

  assert.equal(r.totais.investido, 841.76)
  assert.equal(r.totais.pagoBanco, 541.76)
  assert.equal(r.totais.pagoBolso, 300)
  assert.equal(r.totais.saldoBanco, 59.79) // 600 + 1,55 − 541,76
  assert.equal(r.totais.dividaSocios, 300)

  assert.deepEqual(r.meses.map((m) => m.chave), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  assert.equal(r.meses[1].total, 0) // Abril vazio aparece a zero
  assert.equal(r.meses.at(-1).acumulado, 841.76)

  assert.deepEqual(r.socios, [
    { nome: 'Leandro', aportes: 600, divida: 150, total: 750 },
    { nome: 'Neide', aportes: 0, divida: 150, total: 150 },
  ])
  assert.equal(r.categorias[0].nome, 'Obras')
})

test('resumo vazio não rebenta', () => {
  const r = resumoFinanceiro([], [], new Date('2026-10-07T12:00:00'))
  assert.equal(r.totais.investido, 0)
  assert.equal(r.meses.length, 1)
})
