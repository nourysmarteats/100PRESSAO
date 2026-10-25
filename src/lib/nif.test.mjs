import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nifValido, nifDeEmpresa, codigoPostalValido, dadosEmpresaValidos } from './nif.js'

test('NIF de empresa vs particular', () => {
  assert.equal(nifDeEmpresa('516188976'), true) // encomenda nº 40
  assert.equal(nifDeEmpresa('502288655'), true) // encomenda nº 41
  assert.equal(nifDeEmpresa('235445668'), false)
  assert.equal(nifDeEmpresa(''), false)
})

test('os NIF das encomendas 40 e 41 são válidos', () => {
  assert.equal(nifValido('516188976'), true)
  assert.equal(nifValido('502288655'), true)
})

test('código postal', () => {
  assert.equal(codigoPostalValido('1250-020'), true)
  assert.equal(codigoPostalValido('1250020'), false)
  assert.equal(codigoPostalValido('1250-02'), false)
})

test('dados da empresa completos', () => {
  const ok = { nome: 'Empresa, Lda.', morada: 'Rua X, 1', codigo_postal: '1250-020', localidade: 'Lisboa' }
  assert.equal(dadosEmpresaValidos(ok), true)
  assert.equal(dadosEmpresaValidos({ ...ok, morada: ' ' }), false)
  assert.equal(dadosEmpresaValidos({ ...ok, codigo_postal: '1250' }), false)
  assert.equal(dadosEmpresaValidos(null), false)
})
