import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarNumero, normalizarTelemovelAdesao, validarAdesaoDireta } from './ementaSecreta.js'

test('número beta: só 100–999', () => {
  assert.equal(normalizarNumero('407'), 407)
  assert.equal(normalizarNumero('099'), null)
  assert.equal(normalizarNumero('12'), null)
})

test('telemóvel: formatos portugueses comuns', () => {
  assert.equal(normalizarTelemovelAdesao('912 345 678'), '912345678')
  assert.equal(normalizarTelemovelAdesao('+351 912345678'), '912345678')
  assert.equal(normalizarTelemovelAdesao('00351912345678'), '912345678')
  assert.equal(normalizarTelemovelAdesao('91234567'), null)
})

test('adesão direta exige telemóvel, regulamento e aviso', () => {
  assert.equal(validarAdesaoDireta({ telemovel: '912345678', aceita_regulamento: true, aviso_lido: true }).length, 0)
  assert.equal(validarAdesaoDireta({ telemovel: '', aceita_regulamento: false, aviso_lido: false }).length, 3)
})
