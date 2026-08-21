// Testes da matemática da dependência económica.
//   node --test src/lib/
//
// Os casos estão escritos em euros e em percentagens, não em fixtures
// abstratas, porque o que se quer verificar é uma conta que alguém vai ter
// de defender numa reunião — e essa defende-se com números reconhecíveis.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LIMIARES,
  apurar,
  dependencia,
  declaracaoDesatualizada,
  distribuicaoMecanica,
  margemDisponivel,
  minimoAbrangencia,
  motivoForaDeAmbito,
  nivel,
  pct,
  simular,
  taxaContratante,
  tetoArt53,
  unidadesDeApuramento,
} from './colaboradores.js'

// ── Auxiliares ────────────────────────────────────────────────────────────

const SHEMOT = 'shemot'

const ENTIDADES_GRUPO = [
  { id: 'a', nome: 'Cervejaria', agrupamento: SHEMOT },
  { id: 'b', nome: 'Eventos', agrupamento: SHEMOT },
  { id: 'c', nome: 'Retalho', agrupamento: SHEMOT },
]

// 12 pagamentos mensais de 800 €, rodados pelas três entidades.
const doze800 = () =>
  Array.from({ length: 12 }, (_, i) => ({
    entidade_id: ['a', 'b', 'c'][i % 3],
    valor_base: 800,
    data_recibo: `2026-${String(i + 1).padStart(2, '0')}-28`,
  }))

const perto = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ~${b}, obtido ${a}`)

// ── Fração e escalões ─────────────────────────────────────────────────────

test('dependência é null sem denominador — nunca zero', () => {
  assert.equal(dependencia(9600, null), null)
  assert.equal(dependencia(9600, 0), null)
  assert.equal(dependencia(9600, undefined), null)
  assert.equal(dependencia(9600, 'abc'), null)
})

test('dependência divide o pago pelo declarado', () => {
  perto(dependencia(9600, 12000), 0.8)
  perto(dependencia(0, 12000), 0)
})

test('taxa de contratante segue os escalões, com fronteiras estritas', () => {
  assert.equal(taxaContratante(null), null)
  assert.equal(taxaContratante(0.3), 0)
  assert.equal(taxaContratante(0.5), 0, 'exatamente 50% ainda não é contratante')
  assert.equal(taxaContratante(0.5001), 0.07)
  assert.equal(taxaContratante(0.8), 0.07, 'exatamente 80% fica nos 7%')
  assert.equal(taxaContratante(0.8001), 0.1)
})

test('semáforo cobre os quatro estados', () => {
  assert.equal(nivel(null), 'sem_dados')
  assert.equal(nivel(0.2), 'verde')
  assert.equal(nivel(0.4), 'ambar')
  assert.equal(nivel(0.55), 'vermelho')
  assert.equal(nivel(0.9), 'critico')
})

test('margem disponível dá negativa quando já se passou', () => {
  assert.equal(margemDisponivel(12000, 4000), 2000)
  assert.equal(margemDisponivel(12000, 9600), -3600)
  assert.equal(margemDisponivel(null, 9600), null)
})

test('declaração envelhece ao fim dos dias configurados', () => {
  const hoje = new Date('2026-08-21T12:00:00')
  assert.equal(declaracaoDesatualizada(null, LIMIARES, hoje), true)
  assert.equal(declaracaoDesatualizada('2026-08-01', LIMIARES, hoje), false)
  assert.equal(declaracaoDesatualizada('2025-08-01', LIMIARES, hoje), true)
})

test('formatação usa vírgula decimal e travessão sem dados', () => {
  assert.equal(pct(null), '—')
  assert.equal(pct(0.8), '80,0 %')
})

// ── Agrupamento empresarial: a correção que motivou esta versão ───────────

test('entidades do mesmo agrupamento contam como uma entidade contratante', () => {
  const u = unidadesDeApuramento(ENTIDADES_GRUPO)
  assert.equal(u.length, 1)
  assert.equal(u[0].entidades.length, 3)
})

test('entidade sem agrupamento apura-se sozinha', () => {
  const u = unidadesDeApuramento([
    { id: 'a', nome: 'Cervejaria', agrupamento: SHEMOT },
    { id: 'b', nome: 'Eventos', agrupamento: SHEMOT },
    { id: 'z', nome: 'Parceiro externo', agrupamento: null },
  ])
  assert.equal(u.length, 2)
  assert.equal(u.find((x) => x.agrupamento === SHEMOT).entidades.length, 2)
  assert.equal(u.find((x) => x.agrupamento === null).entidades.length, 1)
})

test('agrupamento vazio ou só espaços não agrupa nada', () => {
  const u = unidadesDeApuramento([
    { id: 'a', nome: 'Um', agrupamento: '' },
    { id: 'b', nome: 'Dois', agrupamento: '   ' },
  ])
  assert.equal(u.length, 2)
})

test('O CASO DOS 12 × 800: individualmente verde, consolidado deve 672 €', () => {
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
  })

  // Cada entidade, sozinha, parece inofensiva.
  for (const l of r.linhas) {
    perto(l.pago, 3200)
    perto(l.fracao, 0.2667)
  }

  // O apuramento real é um só, e está no escalão dos 7%.
  assert.equal(r.contratantes.length, 1)
  const c = r.contratantes[0]
  perto(c.pago, 9600)
  perto(c.fracao, 0.8)
  assert.equal(c.nivel, 'vermelho')
  assert.equal(c.taxa, 0.07)
  perto(c.custoContratante, 672)
  perto(r.custoTotal, 672)

  // E o padrão continua a ser assinalado — agora por razões laborais.
  assert.equal(r.mecanica, true)
})

test('linhas por entidade não trazem taxa nem custo — não é lá que se apura', () => {
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
  })
  for (const l of r.linhas) {
    assert.equal(l.taxa, undefined)
    assert.equal(l.custoContratante, undefined)
    assert.equal(l.margem, undefined)
  }
})

test('passar dos 80% leva o consolidado aos 10%', () => {
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 10000, // 9600/10000 = 96%
    entidades: ENTIDADES_GRUPO,
  })
  const c = r.contratantes[0]
  assert.equal(c.taxa, 0.1)
  assert.equal(c.nivel, 'critico')
  perto(c.custoContratante, 960)
})

test('parceiro externo apura-se à parte e pode ficar abaixo do limiar', () => {
  const entidades = [...ENTIDADES_GRUPO, { id: 'z', nome: 'Externo', agrupamento: null }]
  const r = apurar({
    pagamentos: [...doze800(), { entidade_id: 'z', valor_base: 1000 }],
    totalDeclarado: 12000,
    entidades,
  })
  assert.equal(r.contratantes.length, 2)
  const externo = r.contratantes.find((c) => c.agrupamento === null)
  perto(externo.fracao, 0.0833)
  assert.equal(externo.taxa, 0)
  perto(externo.custoContratante, 0)
  perto(r.custoTotal, 672)
})

// ── Piso dos 6 × IAS ──────────────────────────────────────────────────────

test('o piso é 6 × IAS — 3.222,78 € em 2026', () => {
  perto(minimoAbrangencia(), 3222.78)
})

test('abaixo do piso não há entidade contratante, por muito alta que seja a fração', () => {
  const r = apurar({
    pagamentos: [{ entidade_id: 'a', valor_base: 2800 }],
    totalDeclarado: 3000, // 93% de dependência, mas abaixo de 6 × IAS
    entidades: ENTIDADES_GRUPO,
  })
  assert.equal(r.foraDeAmbito, 'abaixo_minimo')
  assert.equal(r.nivelGrupo, 'fora_ambito')
  assert.equal(r.contratantes[0].taxa, 0)
  perto(r.custoTotal, 0)
  assert.ok(r.explicacaoForaDeAmbito.includes('6 × IAS'))
})

test('mesmo cêntimo acima do piso volta a haver contribuição', () => {
  const r = apurar({
    pagamentos: [{ entidade_id: 'a', valor_base: 3200 }],
    totalDeclarado: 3223,
    entidades: ENTIDADES_GRUPO,
  })
  assert.equal(r.foraDeAmbito, null)
  assert.equal(r.contratantes[0].taxa, 0.1)
})

test('falta de declaração não é o mesmo que estar fora de âmbito', () => {
  assert.equal(motivoForaDeAmbito({ totalDeclarado: null }), null)
  const r = apurar({
    pagamentos: [{ entidade_id: 'a', valor_base: 3200 }],
    totalDeclarado: null,
    entidades: ENTIDADES_GRUPO,
  })
  assert.equal(r.foraDeAmbito, null)
  assert.equal(r.nivelGrupo, 'sem_dados')
  assert.equal(r.contratantes[0].custoContratante, null)
})

// ── Isenção do art. 157.º CRC ─────────────────────────────────────────────

test('colaborador isento pelo art. 157.º não gera contribuição', () => {
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
    colaborador: { isento_ss_art157: true },
  })
  assert.equal(r.foraDeAmbito, 'isento_art157')
  perto(r.custoTotal, 0)
  // A fração continua a ser calculada e mostrada: o facto não desaparece,
  // só deixa de ter consequência contributiva.
  perto(r.fracaoGrupo, 0.8)
})

test('o art. 53.º do CIVA não isenta de nada na Segurança Social', () => {
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
    colaborador: { isento_art_53: true },
  })
  assert.equal(r.foraDeAmbito, null)
  perto(r.custoTotal, 672)
})

// ── Teto do art. 53.º do CIVA ─────────────────────────────────────────────

test('quem não está no art. 53.º não tem teto para vigiar', () => {
  assert.equal(tetoArt53({ isentoArt53: false, totalDeclarado: 12000 }), null)
  assert.equal(tetoArt53({ isentoArt53: true, totalDeclarado: null }), null)
})

test('teto do art. 53.º: margem e peso do grupo', () => {
  const t = tetoArt53({ isentoArt53: true, totalDeclarado: 12000, pagoPeloGrupo: 9600 })
  assert.equal(t.estado, 'dentro')
  perto(t.margem, 3000)
  perto(t.pesoDoGrupo, 0.64)
})

test('teto do art. 53.º: os dois modos de saída do regime', () => {
  assert.equal(
    tetoArt53({ isentoArt53: true, totalDeclarado: 16000, pagoPeloGrupo: 0 }).estado,
    'sai_em_janeiro',
  )
  assert.equal(
    tetoArt53({ isentoArt53: true, totalDeclarado: 19000, pagoPeloGrupo: 0 }).estado,
    'saida_imediata',
  )
})

test('IVA lançado a quem está no art. 53.º é incoerência assinalada', () => {
  const base = {
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
    colaborador: { isento_art_53: true },
  }
  assert.equal(apurar({ ...base, pagamentos: doze800() }).ivaIncoerente, false)
  assert.equal(
    apurar({ ...base, pagamentos: [{ entidade_id: 'a', valor_base: 800, iva: 184 }] })
      .ivaIncoerente,
    true,
  )
})

test('a base de incidência é o valor sem IVA', () => {
  const r = apurar({
    pagamentos: [{ entidade_id: 'a', valor_base: 10000, iva: 2300 }],
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
  })
  perto(r.totalGrupo, 10000, 0.001)
  perto(r.contratantes[0].custoContratante, 1000) // 10% sobre 10.000, não sobre 12.300
})

// ── Distribuição mecânica ─────────────────────────────────────────────────

test('distribuição mecânica precisa de duas entidades e seis pagamentos', () => {
  assert.equal(distribuicaoMecanica({ a: 1000 }, 12), false)
  assert.equal(distribuicaoMecanica({ a: 1000, b: 1000 }, 5), false)
  assert.equal(distribuicaoMecanica({ a: 1000, b: 1000 }, 6), true)
})

test('distribuição irregular não dispara', () => {
  assert.equal(distribuicaoMecanica({ a: 5000, b: 1200, c: 300 }, 12), false)
})

// ── Simulação ─────────────────────────────────────────────────────────────

test('simulação corre sobre a unidade, não sobre a entidade', () => {
  // 9.600 € já pagos pelo agrupamento, mais 800 €, sobre 12.000 declarados.
  const s = simular({ pagamentoValor: 800, pagoAtualNaUnidade: 9600, totalDeclarado: 12000 })
  perto(s.fracaoDepois, 0.8667)
  assert.equal(s.nivelDepois, 'critico')
  assert.equal(s.passaTeto, true)
  perto(s.custoDepois, 1040) // 10% sobre 10.400
})

test('simulação fora de âmbito não inventa custo', () => {
  const s = simular({
    pagamentoValor: 800,
    pagoAtualNaUnidade: 9600,
    totalDeclarado: 12000,
    foraDeAmbito: 'isento_art157',
  })
  assert.equal(s.passaTeto, false)
  assert.equal(s.nivelDepois, 'fora_ambito')
  perto(s.custoDepois, 0)
})

test('simulação sem declaração não devolve fração nem custo', () => {
  const s = simular({ pagamentoValor: 800, pagoAtualNaUnidade: 0, totalDeclarado: null })
  assert.equal(s.fracaoDepois, null)
  assert.equal(s.custoDepois, null)
  assert.equal(s.passaTeto, false)
})

// ── Limiares configuráveis ────────────────────────────────────────────────

test('limiares vindos de definicoes sobrepõem-se aos do código', () => {
  const orcamento2027 = { ...LIMIARES, taxa_contratante: 0.08, ias_anual: 550 }
  const r = apurar({
    pagamentos: doze800(),
    totalDeclarado: 12000,
    entidades: ENTIDADES_GRUPO,
    limiares: orcamento2027,
  })
  perto(r.contratantes[0].custoContratante, 768) // 8% sobre 9.600
  perto(minimoAbrangencia(orcamento2027), 3300)
})
