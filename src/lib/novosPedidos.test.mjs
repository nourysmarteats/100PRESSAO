import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idsNovos } from './novosPedidos.js'

test('primeira leitura não conta como pedido novo', () => {
  assert.deepEqual(idsNovos(null, [{ id: 1 }, { id: 2 }]), [])
})

test('devolve só os ids que não estavam na leitura anterior', () => {
  assert.deepEqual(idsNovos(new Set([1, 2]), [{ id: 1 }, { id: 2 }, { id: 3 }]), [3])
})

test('pedidos que saem da lista não contam', () => {
  assert.deepEqual(idsNovos(new Set([1, 2]), [{ id: 2 }]), [])
})

test('lista inválida (erro de leitura) não toca', () => {
  assert.deepEqual(idsNovos(new Set([1]), null), [])
})
