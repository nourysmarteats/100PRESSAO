import test from 'node:test'
import assert from 'node:assert/strict'
import { ipDoPedido, marcaPrivada, dentroDoLimite } from '../../api/_lib/limites.js'

test('prefere o cabeçalho da Vercel a um x-forwarded-for falsificado', () => {
  assert.equal(ipDoPedido({ headers: { 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' } }), '1.1.1.1')
})
test('sem cabeçalhos não rebenta', () => assert.equal(ipDoPedido({}), 'sem-ip'))
test('a marca não contém o valor e depende do segredo', () => {
  const m = marcaPrivada('912345678', 'a')
  assert.ok(!m.includes('912345678'))
  assert.notEqual(m, marcaPrivada('912345678', 'b'))
})
test('respeita a recusa do limite', async () => {
  const admin = { rpc: async () => ({ data: false, error: null }) }
  assert.equal(await dentroDoLimite(admin, 'x', 'y', 1, 60), false)
})
test('falha em aberto se o limite estiver indisponível', async () => {
  const original = console.error
  console.error = () => {}
  const admin = { rpc: async () => ({ data: null, error: { message: 'erro' } }) }
  assert.equal(await dentroDoLimite(admin, 'x', 'y', 1, 60), true)
  console.error = original
})
