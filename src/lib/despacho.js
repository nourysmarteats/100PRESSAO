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

// O Staff só pode chamar estafeta numa entrega pronta que ainda não tenha um.
export const podeChamar = (p) =>
  p?.tipo_entrega === 'entrega' && p?.estado === 'pronto' && !['aceite', 'recolhido', 'entregue'].includes(p?.entrega_estado)

// Uma chamada sem resposta: a base de dados marca sem_estafeta ao fim de N minutos.
export const precisaAtencao = (p) => p?.entrega_estado === 'sem_estafeta'
