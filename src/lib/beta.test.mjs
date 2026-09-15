import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ORIGEM_DIRECTO,
  ORIGEM_INVALIDA,
  csv,
  normalizarTelemovel,
  numeroFormatado,
  origemDoUrl,
  porOrigem,
  validar,
} from './beta.js'

const CFG = { aberto: true, origens: ['amigo-familia', 'alguem-mercado', 'vi-mercado', 'outro'] }

test('origem do URL: criterios de aceitacao do brief', () => {
  assert.equal(origemDoUrl('?via=grupo-alges'), 'grupo-alges')
  assert.equal(origemDoUrl(''), ORIGEM_DIRECTO)
  assert.equal(origemDoUrl('?outracoisa=1'), ORIGEM_DIRECTO)
})

test('origem do URL: o continua a ser lido, mas via manda', () => {
  assert.equal(origemDoUrl('?o=cartaz-talho'), 'cartaz-talho')
  assert.equal(origemDoUrl('?via=mesa&o=saco'), 'mesa')
})

test('origem do URL: lixo fica invalido, nao directo', () => {
  assert.equal(origemDoUrl('?via=Grupo_Alges!'), ORIGEM_INVALIDA)
  assert.equal(origemDoUrl('?via=' + 'x'.repeat(41)), ORIGEM_INVALIDA)
})

test('origem do URL: maiusculas e espacos sao normalizados', () => {
  assert.equal(origemDoUrl('?via=MERCADO'), 'mercado')
  assert.equal(origemDoUrl('?via=%20mesa%20'), 'mesa')
})

test('telemovel: fica so com digitos', () => {
  assert.equal(normalizarTelemovel('912 345 678'), '912345678')
  assert.equal(normalizarTelemovel('+351 912-345-678'), '351912345678')
})

test('validacao: sem confirmar a leitura do aviso e bloqueado', () => {
  const base = { nome: 'Ana', telemovel: '912345678', origem_declarada: 'vi-mercado', maioridade: true }
  assert.deepEqual(validar({ ...base, aviso_lido: true }, CFG), [])
  assert.ok(validar({ ...base, aviso_lido: false }, CFG).length === 1)
})

test('validacao: sem confirmar mais de 18 e bloqueado', () => {
  const base = { nome: 'Ana', telemovel: '912345678', origem_declarada: 'vi-mercado', aviso_lido: true }
  assert.deepEqual(validar({ ...base, maioridade: true }, CFG), [])
  assert.ok(validar({ ...base, maioridade: false }, CFG).length === 1)
})

test('validacao: apanha nome curto, telemovel mau e origem fora da lista', () => {
  const erros = validar(
    { nome: 'A', telemovel: '12', origem_declarada: 'inventada', aviso_lido: true, maioridade: true },
    CFG,
  )
  assert.equal(erros.length, 3)
})

test('numero do cartao: tres digitos com zeros a esquerda', () => {
  assert.equal(numeroFormatado(37), '037')
  assert.equal(numeroFormatado(1), '001')
  assert.equal(numeroFormatado(999), '999')
  assert.equal(numeroFormatado(1000), '1000')
  assert.equal(numeroFormatado(null), '000')
})

test('CSV: devolve todas as colunas, com BOM e ponto-e-virgula', () => {
  const saida = csv([
    {
      numero: 7, nome: 'Ana "A" Silva', telemovel: '912345678',
      origem_param: 'grupo-alges', origem_declarada: 'amigo-familia',
      criado_em: '2026-09-01T10:00:00Z', aviso_lido_em: '2026-09-01T10:00:00Z',
      aviso_versao: '2026-09-01.v1',
      contacto_pos_beta: true, contacto_pos_beta_em: '2026-09-01T10:00:00Z',
      ultima_interacao_em: '2026-09-01T10:00:00Z',
      vaga: 1, estado: 'inscrito',
      expira_em: '2027-09-01',
    },
  ])
  assert.ok(saida.startsWith('\ufeff'))
  assert.equal(saida.split('\r\n')[0].split(';').length, 14)
  assert.ok(saida.includes('"007"'))
  assert.ok(saida.includes('"Ana ""A"" Silva"'))
})

test('por origem: mede a discrepancia entre o que dizem e o que o URL trouxe', () => {
  const [qr] = porOrigem([
    { origem_declarada: 'vi-mercado', origem_param: 'cartaz-talho' },
    { origem_declarada: 'vi-mercado', origem_param: ORIGEM_DIRECTO },
    { origem_declarada: 'vi-mercado', origem_param: ORIGEM_DIRECTO },
    { origem_declarada: 'alguem-mercado', origem_param: ORIGEM_DIRECTO },
  ])
  assert.equal(qr.origem, 'vi-mercado')
  assert.equal(qr.total, 3)
  assert.equal(qr.semParametro, 2)
  assert.equal(qr.pctSemParametro, 67)
})

test('campanha: nunca substitui uma unidade inexistente nem escolhe entre várias', async () => {
  const { selecionarCampanha } = await import('./beta.js')
  const a = { id: 'a', unidade_codigo: 'carnaxide', aberto: false }
  const b = { id: 'b', unidade_codigo: 'outra', aberto: true }
  assert.equal(selecionarCampanha([a, b], 'carnaxide'), a)
  assert.equal(selecionarCampanha([a, b], 'inexistente'), null)
  assert.equal(selecionarCampanha([a, b]), null)
  assert.equal(selecionarCampanha([a]), a)
})

test('adesão: aceitação expressa é independente de marketing', async () => {
  const { validarAdesao } = await import('./beta.js')
  assert.deepEqual(validarAdesao({ aceita_regulamento: true, aviso_lido: true, contacto_pos_beta: false }), [])
  assert.equal(validarAdesao({ aceita_regulamento: false, aviso_lido: true, contacto_pos_beta: true }).length, 1)
  assert.equal(validarAdesao({ aceita_regulamento: 'true', aviso_lido: true }).length, 1)
})

// Limites de inauguração: não dependem do fuso horário de quem se inscreve.
test('inscrições: antes, no instante e depois da inauguração', async () => {
  const { estadoInscricoes } = await import('./beta.js')
  const cfg = { aberto: true, inauguracao_em: '2026-09-20T15:00:00+01:00' }
  assert.equal(estadoInscricoes(cfg, Date.parse('2026-09-20T13:59:59.999Z')), 'aberta')
  assert.equal(estadoInscricoes(cfg, Date.parse('2026-09-20T14:00:00Z')), 'encerrada')
  assert.equal(estadoInscricoes(cfg, Date.parse('2026-09-20T14:00:01Z')), 'encerrada')
  assert.equal(estadoInscricoes({ aberto: true, inauguracao_em: '2026-09-20T14:00:00.000000+00:00' }, Date.parse('2026-09-20T14:00:00Z')), 'encerrada')
})

test('inscrições: sem data respeita apenas o interruptor booleano', async () => {
  const { estadoInscricoes } = await import('./beta.js')
  assert.equal(estadoInscricoes({ aberto: true }), 'aberta')
  assert.equal(estadoInscricoes({ aberto: false }), 'fechada')
  assert.equal(estadoInscricoes({ aberto: 'true' }), 'fechada')
  assert.equal(estadoInscricoes(null), 'fechada')
})

test('inscrições: compatibilidade com data antiga em Lisboa no verão e inverno', async () => {
  const { estadoInscricoes } = await import('./beta.js')
  const verao = { aberto: true, beta_terminou_em: '2026-09-20' }
  assert.equal(estadoInscricoes(verao, Date.parse('2026-09-19T22:59:59Z')), 'aberta')
  assert.equal(estadoInscricoes(verao, Date.parse('2026-09-19T23:00:00Z')), 'encerrada')
  const inverno = { aberto: true, beta_terminou_em: '2026-12-20' }
  assert.equal(estadoInscricoes(inverno, Date.parse('2026-12-19T23:59:59Z')), 'aberta')
  assert.equal(estadoInscricoes(inverno, Date.parse('2026-12-20T00:00:00Z')), 'encerrada')
})

test('inscrições: instante preciso prevalece sobre data antiga', async () => {
  const { estadoInscricoes } = await import('./beta.js')
  const cfg = { aberto: true, beta_terminou_em: '2026-09-20', inauguracao_em: '2026-09-20T15:00:00+01:00' }
  assert.equal(estadoInscricoes(cfg, Date.parse('2026-09-20T12:00:00Z')), 'aberta')
})

test('inscrições: configuração inválida falha fechada', async () => {
  const { estadoInscricoes } = await import('./beta.js')
  for (const data of ['amanhã', '2026-02-30', '2026-13-01', '20/09/2026', true]) {
    assert.equal(estadoInscricoes({ aberto: true, beta_terminou_em: data }), 'configuracao_invalida')
  }
  for (const data of ['2026-09-20T15:00:00', '2026-02-30T15:00:00Z', '2026-09-20', true]) {
    assert.equal(estadoInscricoes({ aberto: true, inauguracao_em: data }), 'configuracao_invalida')
  }
  assert.equal(estadoInscricoes({ aberto: true }, NaN), 'configuracao_invalida')
  assert.equal(estadoInscricoes({ aberto: true, beta_terminou_em: '2026-09-20' }, Number.MAX_VALUE), 'configuracao_invalida')
  assert.equal(estadoInscricoes({ aberto: true }, new Date('inválida')), 'configuracao_invalida')
})
