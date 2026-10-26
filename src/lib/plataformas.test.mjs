import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ePlataforma,
  rotuloPlataforma,
  normalizarRefPlataforma,
  refPlataformaValida,
} from './plataformas.js'
import { construirVendaveis } from './caixaEmenta.js'

test('plataformas: ids iguais aos do Arranque', () => {
  assert.ok(ePlataforma('ubereats') && ePlataforma('glovo') && ePlataforma('boltfood'))
  assert.equal(ePlataforma('online'), false)
  assert.equal(ePlataforma('mesa'), false)
  assert.equal(rotuloPlataforma('boltfood'), 'Bolt Food')
})

test('n.º do pedido: normaliza como o servidor', () => {
  assert.equal(normalizarRefPlataforma(' #ab 12-3 '), 'AB12-3')
  assert.equal(normalizarRefPlataforma('##99'), '99')
  assert.ok(refPlataformaValida('#ab 12-3'))
  assert.equal(refPlataformaValida('  # '), false)
  assert.equal(refPlataformaValida('pedido!'), false)
  assert.equal(refPlataformaValida('A'.repeat(41)), false)
})

const produtos = [
  { id: 'cv', nome: 'Caldo Verde', preco: 3.7, preco_plataforma: 4.4, category_id: 's' },
  { id: 'bo', nome: 'Bolinho', preco: 7.5, preco_plataforma: null, category_id: 's' },
  { id: 'pf', nome: 'Prato Feito', preco: 8, preco_plataforma: 9, category_id: 'a' },
]
const variantes = [{ id: 'v1', product_id: 'pf', nome: 'Seg', preco: 8.4, preco_plataforma: null }]
const combos = [{ id: 'c1', nome: 'Caldo + Bifana', preco: 8.5, preco_plataforma: 9.9, category_id: 'c' }]

test('balcão: preço de menu, tudo vendável', () => {
  const v = construirVendaveis({ produtos, variantes, combos, comVariantes: new Set(['pf']) })
  assert.deepEqual(
    v.map((x) => [x.chave, x.preco]),
    [['p:cv', 3.7], ['p:bo', 7.5], ['v:v1', 8.4], ['c:c1', 8.5]],
  )
})

test('plataforma: preco_plataforma, e sem ele o artigo não aparece', () => {
  const v = construirVendaveis({ produtos, variantes, combos, comVariantes: new Set(['pf']), plataforma: true })
  assert.deepEqual(
    v.map((x) => [x.chave, x.preco]),
    [['p:cv', 4.4], ['c:c1', 9.9]],
  )
})
