// Regras da ementa do caixa (venda manual ao balcão). Funções puras.
//
// Porquê aqui e não no componente: o caixa escondia categorias inteiras sem
// ninguém perceber (ementa carregada uma só vez e nunca refrescada), e uma aba
// "Almoço" vazia mandava o operador procurar no sítio errado. Estas regras
// decidem o que aparece no balcão e merecem testes próprios.

/** Minúsculas e sem acentos: "Feijão" e "feijao" encontram-se. */
export const normalizarTexto = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Tudo o que se pode vender agora, de todas as categorias, já com a categoria
 * em cada linha. Um produto com variantes dá lugar às variantes de hoje; se tem
 * variantes mas nenhuma serve hoje, não se vende (nem pelo preço do pai).
 */
// Preço do artigo no canal em que se está a vender. Ao balcão é o preço de
// menu; num pedido de plataforma é o preco_plataforma, e um artigo sem ele não
// se vende por esse canal (entraria com um valor que não foi o cobrado).
function precoNoCanal(linha, plataforma) {
  if (!plataforma) return Number(linha.preco || 0)
  return linha.preco_plataforma == null ? null : Number(linha.preco_plataforma)
}

export function construirVendaveis({
  produtos = [],
  variantes = [],
  combos = [],
  comVariantes = new Set(),
  plataforma = false,
}) {
  const lista = []
  produtos.forEach((p) => {
    const suas = variantes.filter((v) => String(v.product_id) === String(p.id))
    if (suas.length === 0 && comVariantes.has(p.id)) return
    if (suas.length === 0) {
      const preco = precoNoCanal(p, plataforma)
      if (preco == null) return
      lista.push({
        chave: `p:${p.id}`,
        nome: p.nome,
        preco,
        product_id: p.id,
        category_id: p.category_id,
      })
      return
    }
    suas.forEach((v) => {
      const preco = precoNoCanal(v, plataforma)
      if (preco == null) return
      lista.push({
        chave: `v:${v.id}`,
        nome: `${p.nome} · ${v.nome}`,
        preco,
        product_id: p.id,
        variant_id: v.id,
        category_id: p.category_id,
      })
    })
  })
  combos.forEach((c) => {
    const preco = precoNoCanal(c, plataforma)
    if (preco == null) return
    lista.push({
      chave: `c:${c.id}`,
      nome: `Combo ${c.nome}`,
      preco,
      combo_id: c.id,
      category_id: c.category_id,
    })
  })
  return lista
}

/** Só as categorias que têm pelo menos um artigo vendável — nada de abas vazias. */
export function categoriasComArtigos(categorias = [], vendaveis = []) {
  const usadas = new Set(vendaveis.map((v) => String(v.category_id)))
  return categorias.filter((c) => usadas.has(String(c.id)))
}

/** Pesquisa por nome em todas as categorias. Cada palavra tem de aparecer. */
export function pesquisarVendaveis(vendaveis = [], termo = '') {
  const palavras = normalizarTexto(termo).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return vendaveis
  return vendaveis.filter((v) => {
    const nome = normalizarTexto(v.nome)
    return palavras.every((p) => nome.includes(p))
  })
}
