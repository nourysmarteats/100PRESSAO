// Regras partilhadas do despacho de entregas (Fase 2A). Funções puras, testadas.

export const ESTADO_ENTREGA = {
  a_chamar: 'À procura de estafeta',
  aceite: 'Estafeta a caminho da recolha',
  recolhido: 'A caminho do cliente',
  entregue: 'Entregue',
  sem_estafeta: 'Sem estafeta',
  cancelada: 'Cancelada',
}

// O link que a empresa envia ao estafeta. O token só existe aqui e no telemóvel dele.
export const linkConvite = (origem, token) => `${origem}/estafeta?convite=${encodeURIComponent(token)}`

export const mensagemConvite = (nome, link) =>
  `Olá ${String(nome).split(' ')[0]}! Este é o teu acesso às entregas do 100PRESSÃO. ` +
  `Abre o link no teu telemóvel (válido 72 horas, só funciona uma vez): ${link}`

// Primeiro dia do mês, em AAAA-MM-DD, para a função entregas_da_minha_empresa.
export function inicioDoMes(ref = new Date()) {
  const d = new Date(ref)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function totaisEntregas(linhas) {
  const feitas = (linhas || []).filter((l) => l.estado === 'entregue')
  const km = feitas.reduce((s, l) => s + Number(l.distancia_km || 0), 0)
  const custo = feitas.reduce((s, l) => s + Number(l.custo || 0), 0)
  return { entregas: feitas.length, km: Math.round(km * 10) / 10, custo: Math.round(custo * 100) / 100 }
}

// Enquanto ninguém ficou com a entrega (nem a equipa, nem um estafeta), o Staff
// pode chamar estafeta ou assumi-la. Desde 2026-11-05 isto vale desde que o
// pagamento entra, e não só quando a comida está pronta.
const livre = (p) =>
  p?.tipo_entrega === 'entrega' &&
  !['entregue', 'cancelado'].includes(p?.estado) &&
  !['aceite', 'recolhido', 'entregue'].includes(p?.entrega_estado)
export const podeChamar = livre
export const podeAssumir = livre

// "Entregamos nós": a equipa ficou com a entrega (frota própria).
export const pelaEquipa = (p) => p?.entrega_modo === 'propria'

// Segundos que faltam até o pg_cron chamar o estafeta mais próximo
// (despacho_automatico). null quando já não há contagem: entrega já tratada,
// ou encomenda por pagar.
export function segundosParaAutomatico(p, minutos, agora = Date.now()) {
  if (p?.tipo_entrega !== 'entrega' || p?.entrega_estado) return null
  if (!['pago', 'na_entrega'].includes(p?.estado_pagamento)) return null
  const base = new Date(p.pago_em || p.criado_em).getTime()
  if (!Number.isFinite(base)) return null
  return Math.max(0, Math.round((base + Number(minutos || 0) * 60000 - agora) / 1000))
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Uma chamada sem resposta: a base de dados marca sem_estafeta ao fim de N minutos.
export const precisaAtencao = (p) => p?.entrega_estado === 'sem_estafeta'

export const linkEquipa = (origem, token) => `${origem}/estafeta?equipa=${encodeURIComponent(token)}`

export const mensagemEquipa = (empresa, link, dias) =>
  `Olá! Este é o link para fazeres entregas do 100PRESSÃO pela ${empresa}. ` +
  `Abre-o no teu telemóvel (válido ${dias} dia${dias > 1 ? 's' : ''}); depois de entrares, a empresa ativa o teu acesso: ${link}`

// Segunda-feira (AAAA-MM-DD) da semana de uma data — semanas de segunda a domingo.
export function inicioSemana(iso) {
  const d = new Date(iso)
  const dia = (d.getDay() + 6) % 7
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - dia)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Agrupa as entregas por semana (mais recente primeiro), com totais de entregas e km.
export function porSemana(linhas) {
  const m = new Map()
  for (const l of linhas || []) {
    const k = inicioSemana(l.data)
    const g = m.get(k) || { semana: k, entregas: [], km: 0 }
    g.entregas.push(l)
    g.km += Number(l.distancia_km || 0)
    m.set(k, g)
  }
  return [...m.values()]
    .map((g) => ({ ...g, km: Math.round(g.km * 10) / 10 }))
    .sort((a, b) => (a.semana < b.semana ? 1 : -1))
}

// Segunda-feira (AAAA-MM-DD) deslocada n semanas.
export function mudarSemana(segunda, n) {
  const d = new Date(`${segunda}T12:00:00`)
  d.setDate(d.getDate() + 7 * n)
  return inicioSemana(d)
}

export function rotuloSemana(segunda) {
  const ini = new Date(`${segunda}T12:00:00`)
  const fim = new Date(ini)
  fim.setDate(ini.getDate() + 6)
  const f = (d) => d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
  return `${f(ini)} a ${f(fim)}`
}
