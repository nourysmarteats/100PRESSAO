import { test } from 'node:test'
import assert from 'node:assert/strict'
import { margemPedidoPlataforma, calcularArranque } from './arranque.js'

const config = {
  iva_medio_pct: 13,
  embalagem_por_pedido: 0.3,
  comissao_plataforma_pct: { glovo: 30, ubereats: 30, boltfood: 25 },
  comissao_pagamento: {},
  inicio_online: '2026-10-25',
  inicio_beta_presencial: '2026-11-21',
  inauguracao: '2027-05-21',
  custos_fixos_online: 600,
  custos_fixos_presencial: 1200,
  caixa_inicial: 0,
}
const custos = new Map([['p:cv', 1.96]])
const pedidoGlovo = {
  id: 'g1',
  canal: 'glovo',
  criado_em: '2026-10-26T20:00:00Z',
  estado: 'entregue',
  estado_pagamento: 'pago',
  metodo_pagamento: 'plataforma',
  total: 8.8,
  order_items: [{ product_id: 'cv', quantidade: 2, preco_unitario: 4.4 }],
}

test('pedido de plataforma: custo exacto pela ficha, comissão estimada pela configuração', () => {
  const m = margemPedidoPlataforma(pedidoGlovo, config, custos)
  const esperado = 8.8 / 1.13 - 2 * 1.96 - 0.3 - 0.3 * 8.8
  assert.equal(m.canal, 'glovo')
  assert.ok(Math.abs(m.margem - esperado) < 1e-9)
  assert.equal(m.estimado, true)
})

test('pedido de plataforma sem ficha técnica: margem fica por saber, não a zero', () => {
  const m = margemPedidoPlataforma(pedidoGlovo, config, new Map())
  assert.equal(m.margem, null)
  assert.ok(m.faltas.includes('ficha'))
})

test('Arranque: pedidos de plataforma contam no canal deles, não no site', () => {
  const r = calcularArranque({
    config,
    custos,
    hoje: '2026-10-26',
    pedidos: [pedidoGlovo, { ...pedidoGlovo, id: 's1', canal: 'online', metodo_pagamento: 'mbway', portes: 0 }],
    plataformas: [],
    ocorrencias: [],
    falhasBeta: [],
    checklist: [],
  })
  const porId = Object.fromEntries((r.porCanal || []).map((c) => [c.id, c.pedidos]))
  assert.equal(porId.glovo, 1)
  assert.equal(porId.online, 1)
})
