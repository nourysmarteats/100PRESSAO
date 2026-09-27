import test from 'node:test'
import assert from 'node:assert/strict'
import { lerConsentimento, CONSENT_VERSAO } from './analytics.js'

test('sem valor guardado → mostrar aviso', () => {
  assert.equal(lerConsentimento(null), null)
  assert.equal(lerConsentimento(''), null)
})

test('valor da versão antiga (string) é ignorado', () => {
  assert.equal(lerConsentimento('accepted'), null)
})

test('versão diferente obriga a perguntar de novo', () => {
  assert.equal(lerConsentimento(JSON.stringify({ v: 1, analise: true, publicidade: true })), null)
})

test('só true explícito conta como consentimento', () => {
  const c = lerConsentimento(JSON.stringify({ v: CONSENT_VERSAO, analise: 'sim', publicidade: 1 }))
  assert.deepEqual(c, { analise: false, publicidade: false })
})

test('escolha granular é preservada', () => {
  const c = lerConsentimento(JSON.stringify({ v: CONSENT_VERSAO, analise: true, publicidade: false }))
  assert.deepEqual(c, { analise: true, publicidade: false })
})
