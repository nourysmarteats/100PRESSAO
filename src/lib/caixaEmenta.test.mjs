import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarTexto,
  construirVendaveis,
  categoriasComArtigos,
  pesquisarVendaveis,
} from './caixaEmenta.js'

const CATS = [
  { id: 'alm', nome: 'Almoço' },
  { id: 'bra', nome: 'Sabores do Brasil' },
  { id: 'cmb', nome: 'Combos' },
]
const produtos = [
  { id: 'pf', nome: 'Prato Feito', preco: 8.4, category_id: 'alm' },
  { id: 'fj', nome: 'Feijoada Brasileira', preco: 12.3, category_id: 'bra' },
]

test('texto: sem acentos e em minúsculas', () => {
  assert.equal(normalizarTexto('  Feijão À Brás '), 'feijao a bras')
})

test('produto com variantes mas nenhuma hoje não se vende', () => {
  const v = construirVendaveis({ produtos, comVariantes: new Set(['pf']) })
  assert.deepEqual(v.map((x) => x.chave), ['p:fj'])
})

test('variantes de hoje substituem o produto-pai e herdam a categoria', () => {
  const v = construirVendaveis({
    produtos,
    variantes: [{ id: 'v1', product_id: 'pf', nome: 'Feijoada da Casa', preco: 9.24 }],
    comVariantes: new Set(['pf']),
  })
  const pf = v.find((x) => x.chave === 'v:v1')
  assert.equal(pf.nome, 'Prato Feito · Feijoada da Casa')
  assert.equal(pf.category_id, 'alm')
  assert.ok(!v.some((x) => x.chave === 'p:pf'))
})

test('categorias vazias desaparecem do caixa', () => {
  const v = construirVendaveis({ produtos, comVariantes: new Set(['pf']) })
  assert.deepEqual(categoriasComArtigos(CATS, v).map((c) => c.id), ['bra'])
})

test('combos contam para a categoria', () => {
  const v = construirVendaveis({ combos: [{ id: 'c1', nome: 'Boteco', preco: 20, category_id: 'cmb' }] })
  assert.deepEqual(categoriasComArtigos(CATS, v).map((c) => c.id), ['cmb'])
})

test('pesquisa atravessa categorias e ignora acentos', () => {
  const v = construirVendaveis({ produtos })
  assert.deepEqual(pesquisarVendaveis(v, 'FEIJ').map((x) => x.chave), ['p:fj'])
  assert.deepEqual(pesquisarVendaveis(v, 'feijoada brasil').map((x) => x.chave), ['p:fj'])
  assert.equal(pesquisarVendaveis(v, 'pizza').length, 0)
  assert.equal(pesquisarVendaveis(v, '   ').length, 2)
})
