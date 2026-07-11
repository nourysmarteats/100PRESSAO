// Helpers partilhados pelos módulos do sistema de pedidos.

export const fmt = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`

export const ESTADOS_PEDIDO = ['recebido', 'em_preparacao', 'pronto', 'entregue']

export const ROTULO_ESTADO = {
  recebido: 'Recebido',
  em_preparacao: 'Em preparação',
  pronto: 'Pronto',
  entregue: 'Entregue',
}

export const METODOS_PAGAMENTO = [
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'multibanco', rotulo: 'Multibanco' },
  { id: 'mbway', rotulo: 'MB Way' },
  { id: 'cartao', rotulo: 'Cartão' },
]

export function proximoEstado(estado) {
  const i = ESTADOS_PEDIDO.indexOf(estado)
  return i >= 0 && i < ESTADOS_PEDIDO.length - 1 ? ESTADOS_PEDIDO[i + 1] : null
}

export function minutosDesde(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

// Beep de alerta (WebAudio) — portado do módulo original
export function beep(frequencias = [880, 1100, 1320]) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    frequencias.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
  } catch {
    /* sem áudio disponível */
  }
}

// Consulta padrão: pedidos ativos com sessão e itens (produtos, variantes
// e combos — um item de pedido tem product_id OU combo_id)
export const SELECT_PEDIDO_COMPLETO = `
  *,
  sessions ( nome_cliente, posicao_mesa ),
  order_items ( *, products ( nome, category_id ), product_variants ( nome ), combos ( nome, category_id ) )
`

// Select antigo (sem combos/variantes) — fallback enquanto a migração SQL
// v2 não estiver aplicada, para staff/operacional nunca ficarem às escuras
export const SELECT_PEDIDO_LEGADO = `
  *,
  sessions ( nome_cliente, posicao_mesa ),
  order_items ( *, products ( nome, category_id ) )
`

export async function obterPedidosAtivos(supabase) {
  let r = await supabase
    .from('orders')
    .select(SELECT_PEDIDO_COMPLETO)
    .neq('estado', 'entregue')
    .order('criado_em')
  if (r.error) {
    r = await supabase
      .from('orders')
      .select(SELECT_PEDIDO_LEGADO)
      .neq('estado', 'entregue')
      .order('criado_em')
  }
  return r
}

// Nome exibível de um item de pedido, seja produto (com variante) ou combo
export function nomeItemPedido(item) {
  if (item.combos?.nome) return `Combo ${item.combos.nome}`
  const variante = item.product_variants?.nome ? ` ${item.product_variants.nome}` : ''
  return `${item.products?.nome || '—'}${variante}`
}

// Categoria de um item (produto ou combo), para o filtro bar/cozinha
export function categoriaItemPedido(item) {
  return item.combos?.category_id ?? item.products?.category_id ?? null
}
