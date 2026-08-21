// Dependência económica de colaboradores a recibos verdes.
//
// A conta em si é uma divisão. O que não é trivial — e é a razão de isto
// viver em funções puras, longe do ecrã — é o que se divide por quê:
//
//   numerador   o que UMA ENTIDADE CONTRATANTE pagou ao colaborador no ano
//   denominador o que o colaborador faturou a TODAS as entidades nesse ano
//
// O grupo conhece o numerador ao cêntimo e não conhece o denominador de todo:
// vem de uma declaração do próprio. Por isso todas as funções aqui devolvem
// null quando não há declaração, em vez de assumirem um valor — um semáforo
// verde por falta de dados é pior do que semáforo nenhum.
//
// ─────────────────────────────────────────────────────────────────────────
// O QUE MUDOU EM 2026-08-21, E PORQUÊ
// ─────────────────────────────────────────────────────────────────────────
//
// 1. ENTIDADE CONTRATANTE NÃO É ENTIDADE JURÍDICA.
//    O Guia Prático das Entidades Contratantes é literal: «considera-se como
//    prestada à mesma entidade contratante os serviços prestados a empresas
//    do mesmo agrupamento empresarial». Três NIPC sob domínio comum são UMA
//    entidade contratante para efeitos de apuramento.
//
//    A versão anterior calculava taxa, custo e margem por entidade. No caso
//    dos 12 × 800 € repartidos por três empresas do grupo isso dava 0 € de
//    contribuição nas três linhas, quando o devido eram 672 €. O número mais
//    perigoso do ecrã era o único que estava errado.
//
//    Agora a unidade de apuramento é o AGRUPAMENTO. As linhas por entidade
//    passam a informativas: dizem quanto cada uma pagou, não o que cada uma
//    deve. Uma entidade sem agrupamento definido apura-se sozinha.
//
// 2. HÁ UM PISO. Só há entidade contratante se o colaborador tiver rendimento
//    anual de prestação de serviços igual ou superior a 6 × IAS. Em 2026, com
//    o IAS a 537,13 €, são 3.222,78 €. Abaixo disso não há contribuição, seja
//    a fração de 60% ou de 100%. A versão anterior pintava a vermelho quem
//    estava legalmente fora do âmbito.
//
// 3. HÁ ISENÇÕES QUE ANULAM A OBRIGAÇÃO. Se o colaborador estiver isento de
//    contribuir (art. 157.º do Código Contributivo) ou ainda não abrangido
//    pelo regime (art. 145.º), a entidade não é apurada como contratante mesmo
//    acima dos 50%. É um facto sobre a pessoa, não uma conta — vem da ficha.
//
//    ATENÇÃO: isto NÃO é o artigo 53.º do CIVA. O art. 53.º é isenção de IVA
//    e não tem efeito nenhum na Segurança Social. Os campos chamam-se
//    `isento_ss_art157` e `isento_art_53` exatamente para não serem trocados.
//
// 4. O ARTIGO 53.º TEM UM TETO PRÓPRIO, e é do colaborador, não teu. Quem
//    está isento de IVA factura até 15.000 €/ano (18.750 € de tolerância).
//    Se o grupo o empurrar para lá, ele salta para o regime normal a meio do
//    ano e passa a faturar-te com IVA. Não te custa líquido — a cervejaria
//    deduz — mas é uma conversa que é melhor ter em setembro do que em
//    dezembro. Fica como banda informativa, com a mesma regra: sem declaração
//    não se mostra nada.
//
// NOTA DE ÂMBITO: nada disto mede o risco laboral. A contribuição de
// entidade contratante é um custo (7%/10%); a presunção de contrato de
// trabalho do art. 12.º do Código do Trabalho é outra ordem de grandeza e
// não se afere por percentagens de faturação. Este ficheiro não a modela.

// Valores por omissão. Os reais vêm de definicoes.colaboradores, porque as
// taxas, os escalões e o IAS mudam com o Orçamento do Estado.
export const LIMIARES = {
  limiar_dependencia: 0.5,
  alerta_dependencia: 0.4,
  escalao_agravado: 0.8,
  taxa_contratante: 0.07,
  taxa_contratante_agravada: 0.1,
  declaracao_valida_dias: 180,
  // Piso de abrangência: 6 × IAS. IAS de 2026 = 537,13 €.
  ias_anual: 537.13,
  minimo_multiplo_ias: 6,
  // Teto do regime de isenção de IVA do art. 53.º do CIVA, e a tolerância
  // de 25% acima da qual a saída do regime é imediata.
  limite_art_53: 15000,
  tolerancia_art_53: 18750,
}

// Rendimento anual mínimo para haver entidade contratante.
export function minimoAbrangencia(limiares = LIMIARES) {
  return Number(limiares.ias_anual || 0) * Number(limiares.minimo_multiplo_ias || 0)
}

// Fração que uma unidade de apuramento representa no rendimento anual.
// null = não há declaração, e portanto não há fração nenhuma para mostrar.
export function dependencia(pagoPelaUnidade, totalDeclarado) {
  const total = Number(totalDeclarado)
  if (!Number.isFinite(total) || total <= 0) return null
  return Number(pagoPelaUnidade || 0) / total
}

// Porque é que este colaborador está fora do âmbito da contribuição — ou
// null se está dentro. Devolve o motivo e não um booleano, porque o ecrã
// tem de poder dizer QUAL é a razão: as duas explicam-se de forma diferente
// a quem perguntar.
export function motivoForaDeAmbito(
  { totalDeclarado, isentoSsArt157 } = {},
  limiares = LIMIARES,
) {
  if (isentoSsArt157) return 'isento_art157'
  const total = Number(totalDeclarado)
  if (!Number.isFinite(total) || total <= 0) return null // sem dados ≠ fora de âmbito
  if (total < minimoAbrangencia(limiares)) return 'abaixo_minimo'
  return null
}

export const MOTIVOS_FORA_AMBITO = {
  isento_art157:
    'Colaborador isento de contribuir (art. 157.º do Código Contributivo). Não há entidade contratante, mesmo acima dos 50%.',
  abaixo_minimo:
    'Rendimento anual abaixo de 6 × IAS. O regime de entidade contratante não se aplica.',
}

// Contribuição devida pela entidade contratante, em fração do valor pago.
// Devolve 0 abaixo do limiar: nesse caso não há entidade contratante nenhuma.
// Função pura de escalão — o gating de âmbito faz-se em apurar().
export function taxaContratante(frac, limiares = LIMIARES) {
  if (frac == null) return null
  if (frac > limiares.escalao_agravado) return limiares.taxa_contratante_agravada
  if (frac > limiares.limiar_dependencia) return limiares.taxa_contratante
  return 0
}

// Quanto ainda pode esta UNIDADE DE APURAMENTO pagar no ano sem passar o
// limiar. Negativo significa que já passou — e é útil ver quanto, não só que sim.
//
// Cuidado ao ler isto: não é uma sugestão de repartir por outra entidade do
// mesmo agrupamento, porque a repartição não muda o numerador. É só a
// distância a que se está do escalão, para o custo não aparecer de surpresa.
export function margemDisponivel(totalDeclarado, jaPago, limiares = LIMIARES) {
  const total = Number(totalDeclarado)
  if (!Number.isFinite(total) || total <= 0) return null
  return total * limiares.limiar_dependencia - Number(jaPago || 0)
}

// Semáforo. Os nomes são os que aparecem no ecrã, para não haver tradução
// a meio do caminho.
export function nivel(frac, limiares = LIMIARES) {
  if (frac == null) return 'sem_dados'
  if (frac > limiares.escalao_agravado) return 'critico'
  if (frac > limiares.limiar_dependencia) return 'vermelho'
  if (frac >= limiares.alerta_dependencia) return 'ambar'
  return 'verde'
}

// Uma declaração de rendimento envelhece: o que o colaborador declarou em
// janeiro não descreve o ano em setembro. Não invalida a conta — assinala
// que o denominador merece uma pergunta.
export function declaracaoDesatualizada(declaradoEm, limiares = LIMIARES, hoje = new Date()) {
  if (!declaradoEm) return true
  const dias = (hoje - new Date(`${declaradoEm}T12:00:00`)) / 86_400_000
  return dias > limiares.declaracao_valida_dias
}

// Situação do colaborador face ao teto do art. 53.º do CIVA.
// Só faz sentido para quem está no regime de isenção; para os outros devolve
// null, porque não há teto nenhum a vigiar.
export function tetoArt53({ isentoArt53, totalDeclarado, pagoPeloGrupo }, limiares = LIMIARES) {
  if (!isentoArt53) return null
  const total = Number(totalDeclarado)
  if (!Number.isFinite(total) || total <= 0) return null

  const limite = Number(limiares.limite_art_53)
  const tolerancia = Number(limiares.tolerancia_art_53)
  const estado =
    total > tolerancia ? 'saida_imediata' : total > limite ? 'sai_em_janeiro' : 'dentro'

  return {
    faturado: total,
    limite,
    tolerancia,
    margem: limite - total,
    // Que fatia do teto dele é o grupo que ocupa. É este número que diz se
    // um pico de trabalho nosso o empurra para fora do regime.
    pesoDoGrupo: dependencia(pagoPeloGrupo, limite),
    estado,
  }
}

// Agrupa entidades em unidades de apuramento. Entidades com o mesmo
// `agrupamento` (texto não vazio) contam como UMA entidade contratante;
// uma entidade sem agrupamento apura-se sozinha.
export function unidadesDeApuramento(entidades = []) {
  const unidades = []
  const porChave = new Map()

  for (const e of entidades) {
    const grupo = typeof e.agrupamento === 'string' ? e.agrupamento.trim() : ''
    const chave = grupo ? `g:${grupo}` : `e:${e.id}`
    let u = porChave.get(chave)
    if (!u) {
      u = { chave, agrupamento: grupo || null, nome: grupo || e.nome, entidades: [] }
      porChave.set(chave, u)
      unidades.push(u)
    }
    u.entidades.push(e)
  }
  return unidades
}

// Heurística de distribuição mecânica.
//
// Trabalho real distribui-se de forma irregular: um mês há mais catering,
// noutro há menos. Valores quase idênticos entre entidades, repetidos mês
// após mês, são o que distingue uma repartição por calendário de uma
// repartição por trabalho — e é o primeiro sítio onde alguém a conferir
// isto iria olhar.
//
// Isto NÃO é um veredicto: uma avença genuinamente igual em três operações
// dispara na mesma. Serve para o admin poder explicar antes de lhe pedirem.
//
// Desde que o apuramento passou a ser consolidado por agrupamento, isto
// deixou de ter valor fiscal — repartir não muda a contribuição. Mantém-se
// porque continua a ter valor LABORAL: uma quantia certa com periodicidade
// certa é a alínea d) do art. 12.º do Código do Trabalho.
export function distribuicaoMecanica(totaisPorEntidade, nPagamentos) {
  const valores = Object.values(totaisPorEntidade || {}).filter((v) => v > 0)
  if (valores.length < 2 || nPagamentos < 6) return false

  const media = valores.reduce((a, b) => a + b, 0) / valores.length
  if (media <= 0) return false
  const desvio = Math.sqrt(
    valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length,
  )
  // Coeficiente de variação abaixo de 5%: as entidades receberam
  // praticamente o mesmo, o que raramente acontece por acaso.
  return desvio / media < 0.05
}

// Retrato completo de um colaborador num ano. Uma função só, para o ecrã não
// ter de recombinar meia dúzia de resultados parciais e se enganar num.
export function apurar({
  pagamentos = [],
  totalDeclarado,
  entidades = [],
  colaborador = {},
  limiares = LIMIARES,
}) {
  const porEntidade = {}
  for (const e of entidades) porEntidade[e.id] = 0

  let totalGrupo = 0
  for (const p of pagamentos) {
    // valor_base, não o total do recibo: a contribuição de entidade
    // contratante incide sobre o valor dos serviços, sem IVA.
    const v = Number(p.valor_base || 0)
    porEntidade[p.entidade_id] = (porEntidade[p.entidade_id] || 0) + v
    totalGrupo += v
  }

  const fora = motivoForaDeAmbito(
    { totalDeclarado, isentoSsArt157: colaborador.isento_ss_art157 },
    limiares,
  )

  // Linhas por entidade: informativas. Quanto cada uma pagou e que peso tem
  // no rendimento do colaborador. NÃO trazem taxa nem custo — esses não se
  // apuram por entidade quando há agrupamento.
  const linhas = entidades.map((e) => {
    const pago = porEntidade[e.id] || 0
    const frac = dependencia(pago, totalDeclarado)
    return { entidade: e, pago, fracao: frac }
  })

  // Unidades de apuramento: é aqui que a Segurança Social olha.
  const contratantes = unidadesDeApuramento(entidades).map((u) => {
    const pago = u.entidades.reduce((acc, e) => acc + (porEntidade[e.id] || 0), 0)
    const frac = dependencia(pago, totalDeclarado)
    const taxa = fora ? 0 : taxaContratante(frac, limiares)
    return {
      ...u,
      pago,
      fracao: frac,
      nivel: fora ? 'fora_ambito' : nivel(frac, limiares),
      taxa,
      // Custo da contribuição, se esta unidade for mesmo apurada como
      // contratante. É o número que dói, e portanto o que convence.
      custoContratante: frac == null ? null : pago * (taxa || 0),
      margem: margemDisponivel(totalDeclarado, pago, limiares),
    }
  })

  const fracaoGrupo = dependencia(totalGrupo, totalDeclarado)
  const custoTotal = contratantes.reduce((acc, c) => acc + (c.custoContratante || 0), 0)

  return {
    linhas,
    contratantes,
    totalGrupo,
    fracaoGrupo,
    nivelGrupo: fora ? 'fora_ambito' : nivel(fracaoGrupo, limiares),
    foraDeAmbito: fora,
    explicacaoForaDeAmbito: fora ? MOTIVOS_FORA_AMBITO[fora] : null,
    custoTotal,
    mecanica: distribuicaoMecanica(porEntidade, pagamentos.length),
    art53: tetoArt53(
      {
        isentoArt53: colaborador.isento_art_53,
        totalDeclarado,
        pagoPeloGrupo: totalGrupo,
      },
      limiares,
    ),
    // Recibos com IVA lançado para quem está no art. 53.º: um dos dois está
    // errado, e vale a pena descobrir qual antes de o contabilista descobrir.
    ivaIncoerente:
      !!colaborador.isento_art_53 && pagamentos.some((p) => Number(p.iva || 0) > 0),
  }
}

// Simula o efeito de um pagamento antes de o gravar. É isto que alimenta o
// travão do formulário: a pergunta útil não é "já passei?" mas "passo se
// lançar este?".
//
// `pagoAtualNaUnidade` é o total da UNIDADE DE APURAMENTO a que a entidade
// escolhida pertence — não o da entidade isolada. Passar o da entidade dá
// uma simulação otimista e é o erro que esta versão corrige.
export function simular({
  pagamentoValor,
  pagoAtualNaUnidade,
  totalDeclarado,
  foraDeAmbito = null,
  limiares = LIMIARES,
}) {
  const depois = Number(pagoAtualNaUnidade || 0) + Number(pagamentoValor || 0)
  const frac = dependencia(depois, totalDeclarado)
  const taxa = foraDeAmbito ? 0 : taxaContratante(frac, limiares)
  return {
    fracaoDepois: frac,
    nivelDepois: foraDeAmbito ? 'fora_ambito' : nivel(frac, limiares),
    passaTeto: !foraDeAmbito && frac != null && frac > limiares.limiar_dependencia,
    margemDepois: margemDisponivel(totalDeclarado, depois, limiares),
    custoDepois: frac == null ? null : depois * (taxa || 0),
    foraDeAmbito,
  }
}

export const pct = (frac) => (frac == null ? '—' : `${(frac * 100).toFixed(1).replace('.', ',')} %`)
