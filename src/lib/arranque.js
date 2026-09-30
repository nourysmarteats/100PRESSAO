// Arranque e Estabilização: pedidos, margem líquida, equilíbrio e alertas.
//
// Funções puras (sem I/O, sem React), para o cálculo poder ser verificado à
// parte do ecrã. Regra da casa: nunca inventar números. Quando falta um dado
// (comissão, IVA, embalagem, ficha técnica), a margem desse pedido fica null e
// o motivo vai para `faltas`, em vez de se assumir zero.
import { custoDaLinha } from './rentabilidade'

export const CANAIS = [
  { id: 'online', rotulo: 'Restaurante Online' },
  { id: 'ubereats', rotulo: 'Uber Eats' },
  { id: 'glovo', rotulo: 'Glovo' },
  { id: 'boltfood', rotulo: 'Bolt Food' },
  { id: 'presencial', rotulo: 'Presencial' },
]
export const rotuloCanal = (id) => CANAIS.find((c) => c.id === id)?.rotulo || id
export const PLATAFORMAS = ['ubereats', 'glovo', 'boltfood']

export const TIPOS_OCORRENCIA = [
  { id: 'cancelamento', rotulo: 'Cancelamento' },
  { id: 'reembolso', rotulo: 'Reembolso' },
  { id: 'atraso', rotulo: 'Atraso' },
  { id: 'reclamacao', rotulo: 'Reclamação' },
  { id: 'indisponivel', rotulo: 'Artigo indisponível' },
  { id: 'outro', rotulo: 'Outro' },
]

const DIA_MS = 86400000
const num = (v) => (v == null || v === '' ? null : Number(v))
const soma = (a) => a.reduce((s, v) => s + v, 0)
export const diaDe = (iso) => String(iso).slice(0, 10)

export function addDias(isoDia, n) {
  const d = new Date(`${isoDia}T00:00:00Z`)
  return new Date(d.getTime() + n * DIA_MS).toISOString().slice(0, 10)
}
export function diasEntre(de, ate) {
  // inclusivo: de 01 a 07 são 7 dias
  return Math.round((new Date(`${ate}T00:00:00Z`) - new Date(`${de}T00:00:00Z`)) / DIA_MS) + 1
}

// Um pedido do site conta como venda quando está pago, ou quando é em dinheiro
// e já foi entregue.
export function pedidoConta(p) {
  return p.estado_pagamento === 'pago' || (p.estado_pagamento === 'na_entrega' && p.estado === 'entregue')
}

export function faseEm(config, dia) {
  if (!config) return null
  if (dia >= config.inauguracao) return 'inauguracao'
  if (dia >= config.inicio_beta_presencial) return 'beta'
  if (dia >= config.inicio_online) return 'online'
  return 'pre'
}

export function custosFixosEm(config, dia) {
  return faseEm(config, dia) === 'online' || faseEm(config, dia) === 'pre'
    ? Number(config.custos_fixos_online)
    : Number(config.custos_fixos_presencial)
}

function comissaoPagamento(config, metodo, total) {
  const c = config.comissao_pagamento?.[metodo]
  if (c == null) return null
  if (typeof c === 'number') return (c / 100) * total
  const pct = num(c.pct) || 0
  const fixo = num(c.fixo) || 0
  return (pct / 100) * total + fixo
}

// Margem de um pedido do site.
// pedido: { id, criado_em, total, portes, estafeta_taxa, desconto_beta, metodo_pagamento,
//           order_items: [{ product_id, variant_id, combo_id, quantidade, preco_unitario }] }
export function margemPedidoSite(pedido, config, custos) {
  const faltas = []
  const iva = num(config.iva_medio_pct)
  if (iva == null) faltas.push('iva')
  const embalagem = num(config.embalagem_por_pedido)
  if (embalagem == null) faltas.push('embalagem')

  const total = Number(pedido.total || 0)
  const portes = Number(pedido.portes || 0)
  const desconto = Number(pedido.desconto_beta || 0)
  const linhas = pedido.order_items || []
  const bruto = soma(linhas.map((l) => Number(l.preco_unitario) * Number(l.quantidade)))

  let custo = 0
  for (const l of linhas) {
    const c = custoDaLinha(l, custos)
    if (c == null) {
      faltas.push('ficha')
      break
    }
    custo += c * Number(l.quantidade)
  }

  const comissao = comissaoPagamento(config, pedido.metodo_pagamento, total)
  if (comissao == null) faltas.push(`comissao:${pedido.metodo_pagamento}`)

  const receitaSemIva = iva == null ? null : (bruto - desconto) / (1 + iva / 100)
  const base = {
    canal: 'online',
    dia: diaDe(pedido.criado_em),
    pedidos: 1,
    faturacao: total,
    receitaSemIva,
    custo: faltas.includes('ficha') ? null : custo,
    estimado: false,
    faltas,
  }
  if (faltas.length) return { ...base, margem: null }
  const entrega = portes / (1 + iva / 100) - Number(pedido.estafeta_taxa || 0)
  return { ...base, margem: receitaSemIva - custo - embalagem - comissao + entrega }
}

// Dia de uma plataforma (linha de financeiro.receitas_externas).
// O custo das plataformas é estimado com o food cost do site no mesmo período.
export function margemDiaPlataforma(linha, config, foodCost) {
  const faltas = []
  const iva = num(config.iva_medio_pct)
  if (iva == null) faltas.push('iva')
  const embalagem = num(config.embalagem_por_pedido)
  if (embalagem == null) faltas.push('embalagem')
  const pedidos = Number(linha.num_transacoes || 0)
  const faturacao = Number(linha.valor || 0)
  let comissao = num(linha.comissao)
  if (!comissao) {
    const pct = num(config.comissao_plataforma_pct?.[linha.canal])
    comissao = pct == null ? null : (pct / 100) * faturacao
  }
  if (comissao == null) faltas.push(`comissao:${linha.canal}`)
  if (foodCost == null) faltas.push('food_cost')
  const receitaSemIva = iva == null ? null : faturacao / (1 + iva / 100)
  const custo = receitaSemIva == null || foodCost == null ? null : receitaSemIva * foodCost
  const base = { canal: linha.canal, dia: diaDe(linha.data), pedidos, faturacao, receitaSemIva, custo, estimado: true, faltas }
  if (faltas.length || pedidos === 0) return { ...base, margem: faltas.length ? null : receitaSemIva - comissao - custo }
  return { ...base, margem: receitaSemIva - comissao - custo - embalagem * pedidos }
}

function agrupar(registos) {
  const r = { pedidos: 0, faturacao: 0, margem: 0, pedidosComMargem: 0, pedidosSemMargem: 0 }
  for (const x of registos) {
    r.pedidos += x.pedidos
    r.faturacao += x.faturacao
    if (x.margem == null) r.pedidosSemMargem += x.pedidos
    else {
      r.margem += x.margem
      r.pedidosComMargem += x.pedidos
    }
  }
  r.margemMedia = r.pedidosComMargem ? r.margem / r.pedidosComMargem : null
  r.ticketMedio = r.pedidos ? r.faturacao / r.pedidos : null
  return r
}

// Cálculo principal.
// dados: { config, pedidos (site, com order_items), custos (Map), plataformas (receitas_externas),
//          ocorrencias, falhasBeta ([{ criado_em }]), checklist, hoje, janela (dias, por omissão 7) }
export function calcularArranque(dados) {
  const { config, custos, hoje } = dados
  const janela = dados.janela || 7
  const inicio = config.inicio_online
  const fase = faseEm(config, hoje)
  const alertas = []
  const faltasConfig = []
  if (num(config.iva_medio_pct) == null) faltasConfig.push('Taxa de IVA média')
  if (num(config.embalagem_por_pedido) == null) faltasConfig.push('Custo de embalagem por pedido')
  const metodosSemComissao = Object.entries(config.comissao_pagamento || {}).filter(([, v]) => v == null).map(([k]) => k)
  if (metodosSemComissao.length) faltasConfig.push(`Comissões de pagamento (${metodosSemComissao.join(', ')})`)
  const platSemComissao = PLATAFORMAS.filter((p) => num(config.comissao_plataforma_pct?.[p]) == null)
  if (platSemComissao.length) faltasConfig.push(`Comissões das plataformas (${platSemComissao.map(rotuloCanal).join(', ')})`)

  // Só conta o que acontece a partir da abertura online (as simulações ficam de fora).
  const pedidosSite = (dados.pedidos || []).filter((p) => diaDe(p.criado_em) >= inicio && diaDe(p.criado_em) <= hoje && pedidoConta(p))
  const site = pedidosSite.map((p) => margemPedidoSite(p, config, custos))

  // Food cost do site (custo / receita sem IVA), para estimar as plataformas.
  const comCusto = site.filter((s) => s.custo != null && s.receitaSemIva)
  const foodCost = comCusto.length ? soma(comCusto.map((s) => s.custo)) / soma(comCusto.map((s) => s.receitaSemIva)) : null

  const plat = (dados.plataformas || [])
    .filter((l) => PLATAFORMAS.includes(l.canal) && diaDe(l.data) >= inicio && diaDe(l.data) <= hoje)
    .map((l) => margemDiaPlataforma(l, config, foodCost))

  const todos = [...site, ...plat]
  const abriu = hoje >= inicio
  const diasDecorridos = abriu ? diasEntre(inicio, hoje) : 0
  const inicioJanela = abriu ? [addDias(hoje, -(janela - 1)), inicio].sort().at(-1) : null
  const diasJanela = abriu ? diasEntre(inicioJanela, hoje) : 0
  const naJanela = todos.filter((x) => abriu && x.dia >= inicioJanela)

  const geral = agrupar(todos)
  const janelaAgg = agrupar(naJanela)
  const pedidosDia = abriu && diasJanela ? janelaAgg.pedidos / diasJanela : null

  // Equilíbrio: custos fixos do mês ÷ margem média por pedido.
  const custosFixos = custosFixosEm(config, hoje)
  const margemMedia = janelaAgg.margemMedia ?? geral.margemMedia
  const equilibrioMes = margemMedia && margemMedia > 0 ? custosFixos / margemMedia : null
  const equilibrioDia = equilibrioMes == null ? null : equilibrioMes / 30

  let estado = 'sem_dados'
  if (pedidosDia != null && equilibrioDia != null) {
    if (pedidosDia >= equilibrioDia) estado = 'acima'
    else if (pedidosDia >= 0.8 * equilibrioDia) estado = 'proximo'
    else estado = 'abaixo'
  } else if (margemMedia != null && margemMedia <= 0) estado = 'abaixo'

  // Caixa: inicial + margem acumulada − custos fixos já decorridos (pro rata).
  let caixa = null
  let mesesAutonomia = null
  if (abriu && geral.pedidosSemMargem === 0) {
    let fixosDecorridos = 0
    for (let i = 0; i < diasDecorridos; i++) fixosDecorridos += custosFixosEm(config, addDias(inicio, i)) / 30
    caixa = Number(config.caixa_inicial) + geral.margem - fixosDecorridos
    const margemMensal = pedidosDia != null && margemMedia != null ? pedidosDia * 30 * margemMedia : 0
    const queima = custosFixos - margemMensal
    mesesAutonomia = queima > 0 ? Math.max(0, caixa) / queima : Infinity
  } else if (!abriu) {
    caixa = Number(config.caixa_inicial)
  }

  // Por canal
  const porCanal = CANAIS.filter((c) => c.id !== 'presencial').map((c) => ({
    ...c,
    ...agrupar(todos.filter((x) => x.canal === c.id)),
    estimado: c.id !== 'online',
  }))
  const comMargem = porCanal.filter((c) => c.pedidosComMargem > 0 && c.margemMedia != null)
  const canalTop = comMargem.length ? comMargem.reduce((a, b) => (b.margemMedia > a.margemMedia ? b : a)) : null

  // Série diária (para o registo)
  const porDia = new Map()
  for (const x of todos) {
    const k = `${x.dia}|${x.canal}`
    porDia.set(k, [...(porDia.get(k) || []), x])
  }
  const serie = [...porDia.entries()]
    .map(([k, regs]) => {
      const [dia, canal] = k.split('|')
      return { dia, canal, ...agrupar(regs), estimado: regs.some((r) => r.estimado) }
    })
    .sort((a, b) => (a.dia === b.dia ? a.canal.localeCompare(b.canal) : b.dia.localeCompare(a.dia)))

  // ── Alertas ──
  if (faltasConfig.length) {
    alertas.push({ nivel: 'aviso', tipo: 'config', texto: `Falta configurar: ${faltasConfig.join('; ')}. Sem isto a margem fica por calcular.` })
  }
  const semFicha = site.filter((s) => s.faltas.includes('ficha')).length
  if (semFicha) alertas.push({ nivel: 'aviso', tipo: 'ficha', texto: `${semFicha} pedido(s) com artigos sem ficha técnica: margem por calcular.` })

  for (const canal of ['online', ...PLATAFORMAS]) {
    const pend = (dados.checklist || []).filter((i) => i.canal === canal && i.critico && !i.feito)
    if (pend.length) alertas.push({ nivel: abriu ? 'critico' : 'aviso', tipo: 'checklist', texto: `${rotuloCanal(canal)}: ${pend.length} item(ns) crítico(s) da checklist por fechar.` })
  }

  if (abriu && pedidosDia != null) {
    const referencia = equilibrioDia ?? Number(config.meta_minima_dia)
    if (pedidosDia < referencia) {
      alertas.push({
        nivel: 'critico',
        tipo: 'pedidos',
        texto: `Média de ${pedidosDia.toFixed(1)} pedidos/dia nos últimos ${diasJanela} dia(s), abaixo ${equilibrioDia != null ? `do equilíbrio (${equilibrioDia.toFixed(1)})` : `da meta mínima (${referencia})`}.`,
      })
    }
  }
  if (margemMedia != null && margemMedia < 0) {
    alertas.push({ nivel: 'critico', tipo: 'margem', texto: `Margem média negativa: ${margemMedia.toFixed(2).replace('.', ',')} € por pedido.` })
  }
  const diasNegativos = serie.filter((d) => d.margem < 0 && d.pedidosComMargem > 0 && d.dia >= (inicioJanela || hoje))
  for (const d of diasNegativos.slice(0, 3)) {
    alertas.push({ nivel: 'aviso', tipo: 'margem', texto: `${rotuloCanal(d.canal)} a ${d.dia}: margem negativa no dia.` })
  }

  const desde7 = addDias(hoje, -6)
  const oc7 = (dados.ocorrencias || []).filter((o) => o.data >= desde7 && o.data <= hoje)
  for (const t of TIPOS_OCORRENCIA) {
    const n = oc7.filter((o) => o.tipo === t.id).length
    if (t.id === 'indisponivel') {
      const hojeInd = oc7.filter((o) => o.tipo === 'indisponivel' && o.data === hoje)
      for (const o of hojeInd) alertas.push({ nivel: 'aviso', tipo: 'indisponivel', texto: `Indisponível hoje (${rotuloCanal(o.canal)}): ${o.descricao || 'artigo não indicado'}.` })
    } else if (n >= 3) {
      alertas.push({ nivel: 'aviso', tipo: 'ocorrencias', texto: `${n} ocorrências de "${t.rotulo.toLowerCase()}" nos últimos 7 dias.` })
    }
  }

  const falhasPorDia = new Map()
  for (const f of dados.falhasBeta || []) {
    const d = diaDe(f.criado_em)
    falhasPorDia.set(d, (falhasPorDia.get(d) || 0) + 1)
  }
  for (const [d, n] of falhasPorDia) {
    if (d >= desde7 && n >= 5) alertas.push({ nivel: 'aviso', tipo: 'beta', texto: `${n} falhas de validação do Cliente Beta a ${d}.` })
  }

  const ordemNivel = { critico: 0, aviso: 1 }
  alertas.sort((a, b) => ordemNivel[a.nivel] - ordemNivel[b.nivel])

  return {
    fase,
    abriu,
    diasDecorridos,
    diasJanela,
    pedidosDia,
    margemMedia,
    equilibrioMes,
    equilibrioDia,
    estado,
    custosFixos,
    caixa,
    mesesAutonomia,
    foodCost,
    geral,
    janela: janelaAgg,
    porCanal,
    canalTop,
    serie,
    alertas,
    faltasConfig,
  }
}

// Estado da checklist por canal: pronto só quando não há críticos pendentes.
export function estadoChecklist(itens) {
  return ['online', ...PLATAFORMAS].map((canal) => {
    const doCanal = itens.filter((i) => i.canal === canal)
    const feitos = doCanal.filter((i) => i.feito).length
    const criticosPendentes = doCanal.filter((i) => i.critico && !i.feito).length
    return { canal, total: doCanal.length, feitos, criticosPendentes, pronto: doCanal.length > 0 && criticosPendentes === 0 }
  })
}
