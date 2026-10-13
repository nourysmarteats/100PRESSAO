// Testes das regras do despacho.   npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { inicioSemana, porSemana, rotuloSemana, linkEquipa, inicioDoMes, linkConvite, mensagemConvite, podeChamar, precisaAtencao, totaisEntregas } from './despacho.js'

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
