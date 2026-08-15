// Regra de preços por canal, decidida pelo Leandro (2026-08-07).
//
//   preco             — mesa e balcão. É o preço de menu, o de referência.
//   preco_online      — restaurante online: base + 10%. A folga que financia a
//                       entrega vem daqui (ver o painel Economia da entrega).
//   preco_plataforma  — referência Uber/Glovo/Bolt: base + 30%, para cobrir a
//                       comissão delas sem perder dinheiro.
//
// A regra vive aqui e não espalhada pelos ecrãs porque é uma decisão de
// negócio, não um detalhe de formulário: se as percentagens mudarem, muda-se
// num sítio.
export const ACRESCIMO_ONLINE = 0.1
export const ACRESCIMO_PLATAFORMA = 0.3

const cent = (n) => Math.round(n * 100) / 100

export const precoOnlineRegra = (base) => cent(Number(base) * (1 + ACRESCIMO_ONLINE))
export const precoPlataformaRegra = (base) => cent(Number(base) * (1 + ACRESCIMO_PLATAFORMA))

// Um desvio só conta a partir de um cêntimo. Comparar números com casas
// decimais directamente daria falsos positivos por arredondamento.
export const desvia = (atual, esperado) =>
  atual !== '' && atual != null && Math.abs(Number(atual) - Number(esperado)) >= 0.01
