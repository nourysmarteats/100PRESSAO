// Testes das regras do portal de candidaturas.
//   npm test

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CONFIG_FALLBACK,
  MIME_ACEITES,
  TAMANHO_MAXIMO,
  TIPOS_DOCUMENTO,
  caminhoDocumento,
  config,
  documentosEmFalta,
  documentosObrigatorios,
  ficheiroAceite,
  funcao,
  funcoes,
  marcaCliente,
  validar,
} from './candidaturas.js'

const CFG = CONFIG_FALLBACK
const base = {
  nome: 'Maria Silva',
  email: 'maria@exemplo.pt',
  funcao_pretendida: 'cozinha',
  aviso_lido: true,
}

// ── A regra que motivou tudo isto ─────────────────────────────────────────

test('o comprovativo de atividade só é exigido na via de prestação de serviços', () => {
  assert.deepEqual(documentosObrigatorios(CFG, 'servicos'), ['comprovativo_atividade'])
  for (const f of ['cozinha', 'balcao', 'sala', 'entregas', 'outra']) {
    assert.deepEqual(documentosObrigatorios(CFG, f), [], `${f} não devia exigir documentos`)
  }
})

test('as funções de emprego são via emprego, e a de serviços não', () => {
  for (const f of ['cozinha', 'balcao', 'sala', 'entregas']) {
    assert.equal(funcao(CFG, f).via, 'emprego')
  }
  assert.equal(funcao(CFG, 'servicos').via, 'prestacao')
})

test('candidatura a cozinha passa sem anexo nenhum', () => {
  assert.deepEqual(validar(base, CFG, []), [])
})

test('candidatura a serviços é recusada sem o comprovativo', () => {
  const erros = validar({ ...base, funcao_pretendida: 'servicos' }, CFG, [])
  assert.equal(erros.length, 1)
  assert.match(erros[0], /Comprovativo de início de atividade/)
})

test('candidatura a serviços passa com o comprovativo', () => {
  const anexos = [{ tipo: 'comprovativo_atividade' }]
  assert.deepEqual(validar({ ...base, funcao_pretendida: 'servicos' }, CFG, anexos), [])
})

test('documentosEmFalta ignora anexos que não são os exigidos', () => {
  const anexos = [{ tipo: 'curriculo' }, { tipo: 'carta_conducao' }]
  assert.deepEqual(documentosEmFalta(CFG, 'servicos', anexos), ['comprovativo_atividade'])
})

// ── A lista de documentos ─────────────────────────────────────────────────

test('nenhum documento de identificação consta da lista aceite', () => {
  const chaves = Object.keys(TIPOS_DOCUMENTO).join(' ')
  for (const proibido of ['cartao_cidadao', 'cc', 'bilhete', 'passaporte', 'identifica']) {
    assert.ok(!chaves.includes(proibido), `${proibido} não devia ser aceite no portal`)
  }
})

// ── Validação ─────────────────────────────────────────────────────────────

test('nome curto, email inválido e função inexistente são apanhados', () => {
  const erros = validar({ nome: 'Jo', email: 'nada', funcao_pretendida: 'chefe', aviso_lido: true }, CFG)
  assert.equal(erros.length, 3)
})

test('sem confirmar o aviso de privacidade não se submete', () => {
  const erros = validar({ ...base, aviso_lido: false }, CFG, [])
  assert.deepEqual(erros, ['Falta confirmar a leitura do aviso de privacidade.'])
})

test('o limite de anexos é respeitado e vem da configuração', () => {
  const quatro = [1, 2, 3, 4].map(() => ({ tipo: 'curriculo' }))
  assert.match(validar(base, CFG, quatro)[0], /No máximo 3 anexos/)
  const generoso = config({ max_anexos: 5 })
  assert.deepEqual(validar(base, generoso, quatro), [])
})

test('config sobrepõe-se ao fallback sem perder as funções conhecidas', () => {
  const c = config({ portal_aberto: true, funcoes: { musica: { rotulo: 'Música', via: 'prestacao', obrigatorios: [] } } })
  assert.equal(c.portal_aberto, true)
  assert.ok(c.funcoes.cozinha, 'as funções de origem mantêm-se')
  assert.ok(c.funcoes.musica, 'e as novas entram')
  assert.equal(funcoes(c).length, 7)
})

test('config inválida não rebenta — devolve o fallback', () => {
  assert.deepEqual(config(null), CONFIG_FALLBACK)
  assert.deepEqual(config('nada'), CONFIG_FALLBACK)
})

// ── Ficheiros ─────────────────────────────────────────────────────────────

test('só PDF, JPEG e PNG, até 5 MB e nunca vazios', () => {
  assert.equal(ficheiroAceite({ type: 'application/pdf', size: 1000 }), null)
  assert.match(ficheiroAceite({ type: 'application/x-msdownload', size: 10 }), /PDF, JPEG ou PNG/)
  assert.match(ficheiroAceite({ type: 'image/png', size: TAMANHO_MAXIMO + 1 }), /5 MB/)
  assert.match(ficheiroAceite({ type: 'image/png', size: 0 }), /vazio/)
  assert.match(ficheiroAceite(null), /em falta/)
  assert.deepEqual(MIME_ACEITES, ['application/pdf', 'image/jpeg', 'image/png'])
})

test('o nome do ficheiro do candidato nunca entra no caminho', () => {
  const mau = '../../etc/passwd; rm -rf /.pdf'
  const caminho = caminhoDocumento('abc-123', 'curriculo', mau, 'x1')
  assert.equal(caminho, 'abc-123/curriculo-x1.pdf')
  assert.ok(!caminho.includes('..'))
  assert.ok(!caminho.includes(' '))
})

test('extensão fora da lista branca vira .bin, e jpeg normaliza para jpg', () => {
  assert.match(caminhoDocumento('a', 'curriculo', 'x.exe', '1'), /\.bin$/)
  assert.match(caminhoDocumento('a', 'curriculo', 'x.JPEG', '1'), /\.jpg$/)
})

test('tipo de documento desconhecido não passa para o caminho', () => {
  assert.match(caminhoDocumento('a', 'cartao_cidadao', 'x.pdf', '1'), /\/outro-/)
})

test('a marca do cliente é estável e não devolve o que recebeu', () => {
  const m = marcaCliente('agente|1280x720|Europe/Lisbon')
  assert.equal(m, marcaCliente('agente|1280x720|Europe/Lisbon'))
  assert.notEqual(m, marcaCliente('outro|1280x720|Europe/Lisbon'))
  assert.ok(!m.includes('Lisbon'))
  assert.ok(m.length <= 8)
})
