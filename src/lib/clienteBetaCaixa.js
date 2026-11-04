// Cliente Beta no caixa — contas puras, iguais às do servidor.
//
// O servidor (aplicar_cliente_beta_caixa) é sempre a verdade; isto serve para
// o operador e o cliente verem no ecrã, e no visor, o mesmo valor que vai
// para a fatura: desconto por unidade arredondado ao cêntimo, vezes a
// quantidade (a mesma conta do criar_pedido_online e de api/_lib/faturacao.js).

const cent = (v) => Math.round(v * 100 + 1e-6) / 100

/** Desconto de uma unidade a `pct`%, arredondado como na fatura. */
export function descontoUnidade(preco, pct) {
  const p = Number(preco) || 0
  const q = Number(pct) || 0
  if (q <= 0) return 0
  const liquido = Math.round(p * (100 - q) + 1e-6) / 100
  return cent(p - liquido)
}

/** Desconto total do carrinho. `itens`: [{ preco, quantidade }]. */
export function descontoCarrinho(itens, pct) {
  return cent(
    (itens || []).reduce((s, i) => s + descontoUnidade(i.preco, pct) * (Number(i.quantidade) || 0), 0),
  )
}

/** Número Beta escrito no caixa: 3 dígitos, 100–999. Devolve o número ou null. */
export function numeroBetaValido(texto) {
  const so = String(texto ?? '').replace(/\D/g, '')
  if (so.length !== 3) return null
  const n = Number(so)
  return n >= 100 && n <= 999 ? n : null
}
