// Testes das regras do despacho.   npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { inicioDoMes, linkConvite, mensagemConvite, podeChamar, precisaAtencao, totaisEntregas } from './despacho.js'

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

test('podeChamar: só entregas prontas sem estafeta', () => {
  assert.ok(podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: null }))
  assert.ok(podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: 'sem_estafeta' }))
  assert.ok(!podeChamar({ tipo_entrega: 'levar', estado: 'pronto' }))
  assert.ok(!podeChamar({ tipo_entrega: 'entrega', estado: 'pronto', entrega_estado: 'aceite' }))
  assert.ok(!podeChamar({ tipo_entrega: 'entrega', estado: 'em_preparacao' }))
})

test('precisaAtencao quando ninguém aceitou', () => {
  assert.ok(precisaAtencao({ entrega_estado: 'sem_estafeta' }))
  assert.ok(!precisaAtencao({ entrega_estado: 'a_chamar' }))
})
