import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descontoUnidade, descontoCarrinho, numeroBetaValido } from './clienteBetaCaixa.js'

test('desconto por unidade arredonda ao cêntimo como a fatura', () => {
  assert.equal(descontoUnidade(1.5, 10), 0.15)
  assert.equal(descontoUnidade(5, 10), 0.5)
  assert.equal(descontoUnidade(4.95, 10), 0.49) // líquido 4,455 → 4,46
  assert.equal(descontoUnidade(2, 0), 0)
})

test('desconto do carrinho = desconto por unidade × quantidade', () => {
  // Igual ao teste feito na BD: 3 × 1,50 € → 0,45 €
  assert.equal(descontoCarrinho([{ preco: 1.5, quantidade: 3 }], 10), 0.45)
  assert.equal(
    descontoCarrinho([{ preco: 4.95, quantidade: 2 }, { preco: 2, quantidade: 1 }], 10),
    1.18,
  )
  assert.equal(descontoCarrinho([], 10), 0)
})

test('número Beta: 3 dígitos entre 100 e 999', () => {
  assert.equal(numeroBetaValido('407'), 407)
  assert.equal(numeroBetaValido(' 4 0 7 '), 407)
  assert.equal(numeroBetaValido('099'), null)
  assert.equal(numeroBetaValido('12'), null)
  assert.equal(numeroBetaValido('1000'), null)
  assert.equal(numeroBetaValido(''), null)
})
