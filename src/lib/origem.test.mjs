import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registarOrigem, origemDaEncomenda, _reiniciarOrigem } from './origem.js'

test('sem código no URL, a encomenda é directo', () => {
  _reiniciarOrigem()
  assert.equal(registarOrigem(''), null)
  assert.equal(origemDaEncomenda(''), 'directo')
})

test('?via= e ?o= são aceites e normalizados', () => {
  _reiniciarOrigem()
  assert.equal(origemDaEncomenda('?via=Insta-Reel-A'), 'insta-reel-a')
  _reiniciarOrigem()
  assert.equal(origemDaEncomenda('?o=wa-leandro'), 'wa-leandro')
})

test('o primeiro toque mantém-se ao navegar', () => {
  _reiniciarOrigem()
  registarOrigem('?via=tiktok-a')
  registarOrigem('')
  registarOrigem('?via=outro-codigo')
  assert.equal(origemDaEncomenda(''), 'tiktok-a')
})

test('código mal formado fica marcado como invalido', () => {
  _reiniciarOrigem()
  assert.equal(origemDaEncomenda('?via=cartaz%20mercado'), 'invalido')
})
