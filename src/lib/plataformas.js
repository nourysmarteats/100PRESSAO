// Pedidos das plataformas de entrega lançados no caixa (2026-10-26).
//
// Uber Eats, Glovo e Bolt Food cobram o cliente, transferem o líquido e faturam
// a comissão à parte. Para a venda existir no Financeiro, no Arranque e na
// Rentabilidade, cada pedido é lançado no caixa ao preco_plataforma, com o
// n.º do pedido na plataforma (único: o mesmo pedido não entra duas vezes).
//
// Os ids são os mesmos do Arranque (src/lib/arranque.js) — um só vocabulário.

export const PLATAFORMAS_ENTREGA = [
  { id: 'ubereats', rotulo: 'Uber Eats' },
  { id: 'glovo', rotulo: 'Glovo' },
  { id: 'boltfood', rotulo: 'Bolt Food' },
]

export const METODO_PLATAFORMA = 'plataforma'

export const ePlataforma = (canal) => PLATAFORMAS_ENTREGA.some((p) => p.id === canal)

export const rotuloPlataforma = (canal) =>
  PLATAFORMAS_ENTREGA.find((p) => p.id === canal)?.rotulo || canal

// Espelha a normalização do servidor (criar_pedido_plataforma): maiúsculas,
// sem espaços e sem # inicial. "#ab 12-3" e "AB12-3" são o mesmo pedido.
export function normalizarRefPlataforma(valor) {
  return String(valor ?? '')
    .replace(/\s+/g, '')
    .replace(/^#+/, '')
    .toUpperCase()
}

export const refPlataformaValida = (valor) =>
  /^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(normalizarRefPlataforma(valor))
