// Testes das regras do despacho.   npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { inicioSemana, mudarSemana, porSemana, rotuloSemana, linkEquipa, inicioDoMes, linkConvite, mensagemConvite, podeChamar, podeAssumir, pelaEquipa, segundosParaAutomatico, mmss, precisaAtencao, totaisEntregas } from './despacho.js'

test('link de convite codifica o token', () => {
  assert.equal(linkConvite('https://x.pt', 'a+b/c'), 'https://x.pt/estafeta?convite=a%2Bb%2Fc')
})

test('mensagem usa o primeiro nome', () => assert.match(mensagemConvite('Ana Silva', 'L'), /^Olá Ana!/))

test('início do mês', () => assert.equal(inicioDoMes(new Date(2026, 9, 25)), '2026-10-01'))

test('totais só contam entregas concluídas', () => {
  const t = totaisEntregas([
    { estado: 'entregue', distancia_km: 3.25, custo: 3.3 },
    { estado: 'entregue', distancia_km: 1.5, custo: 2.6 },
    { estado: 'aceite', distancia_km: 9, custo: 5.6 },
  ])
  assert.deepEqual(t, { entregas: 2, km: 4.8, custo: 5.9 })
})

test('podeChamar/podeAssumir: entregas em aberto sem ninguém com elas', () => {
  assert.ok(podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: null }))
  assert.ok(podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: 'sem_estafeta' }))
  assert.ok(podeChamar({ tipo_entrega: 'entrega', estado: 'em_preparacao' }))
  assert.ok(podeAssumir({ tipo_entrega: 'entrega', estado: 'recebido', entrega_estado: 'a_chamar' }))
  assert.ok(!podeChamar({ tipo_entrega: 'levar', estado: 'pronto' }))
  assert.ok(!podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: 'aceite' }))
  assert.ok(!podeAssumir({ tipo_entrega: 'entrega', estado: 'entregue', entrega_estado: null }))
})

test('pelaEquipa reconhece a frota própria', () => {
  assert.ok(pelaEquipa({ entrega_modo: 'propria' }))
  assert.ok(!pelaEquipa({ entrega_modo: 'proximidade' }))
})

test('segundosParaAutomatico conta a partir do pagamento', () => {
  const pago_em = '2026-11-05T19:00:00Z'
  const agora = Date.parse('2026-11-05T19:01:00Z')
  const p = { tipo_entrega: 'entrega', estado_pagamento: 'pago', pago_em, entrega_estado: null }
  assert.equal(segundosParaAutomatico(p, 3, agora), 120)
  assert.equal(segundosParaAutomatico(p, 3, Date.parse('2026-11-05T19:05:00Z')), 0)
  assert.equal(segundosParaAutomatico({ ...p, estado_pagamento: 'pendente' }, 3, agora), null)
  assert.equal(segundosParaAutomatico({ ...p, entrega_estado: 'aceite' }, 3, agora), null)
  assert.equal(mmss(125), '2:05')
})

test('precisaAtencao quando ninguém aceitou', () => {
  assert.ok(precisaAtencao({ entrega_estado: 'sem_estafeta' }))
  assert.ok(!precisaAtencao({ entrega_estado: 'a_chamar' }))
})

test('semana começa à segunda-feira', () => {
  assert.equal(inicioSemana('2026-10-13T10:00:00'), '2026-10-12') // terça → segunda
  assert.equal(inicioSemana('2026-10-18T22:00:00'), '2026-10-12') // domingo → segunda anterior
  assert.equal(inicioSemana('2026-10-19T08:00:00'), '2026-10-19') // segunda
})

test('agrupa por semana, mais recente primeiro, com km somados', () => {
  const g = porSemana([
    { numero: 1, data: '2026-10-06T12:00:00', distancia_km: 2 },
    { numero: 2, data: '2026-10-13T12:00:00', distancia_km: 3.25 },
    { numero: 3, data: '2026-10-14T12:00:00', distancia_km: 1.5 },
  ])
  assert.equal(g.length, 2)
  assert.equal(g[0].semana, '2026-10-12')
  assert.equal(g[0].entregas.length, 2)
  assert.equal(g[0].km, 4.8)
})

test('rótulo da semana', () => assert.equal(rotuloSemana('2026-10-12'), '12/10 a 18/10'))

test('link de equipa usa o parâmetro equipa', () => assert.equal(linkEquipa('https://x.pt', 'abc'), 'https://x.pt/estafeta?equipa=abc'))

test('mudarSemana anda de segunda em segunda', () => {
  assert.equal(mudarSemana('2026-10-12', -1), '2026-10-05')
  assert.equal(mudarSemana('2026-10-12', 1), '2026-10-19')
  assert.equal(mudarSemana('2026-03-23', 1), '2026-03-30') // mudança de hora
})
