// Rentabilidade: transforma vendas + fichas técnicas em margem.
//
// O painel sabia dizer quanto se vendeu, não quanto se ganhou. Os dados para o
// segundo já existiam: stock_receitas liga cada produto/variante/combo aos
// itens de stock, e cada item de stock tem custo. Falta só multiplicar.
//
// Funções puras de propósito — sem I/O, sem React — para o cálculo poder ser
// verificado à parte da apresentação.

// Um item vendido identifica-se pelo mais específico que tiver: um combo é um
// combo; uma variante é a variante (o registo traz também o product_id, mas o
// preço e a receita são da variante); senão é o produto.
export function chaveItem({ combo_id, variant_id, product_id }) {
  if (combo_id) return `c:${combo_id}`
  if (variant_id) return `v:${variant_id}`
  if (product_id) return `p:${product_id}`
  return null
}

// Custo unitário por chave, a partir das fichas técnicas.
// receitas: [{ product_id, variant_id, combo_id, quantidade, stock_items: { custo } }]
export function custosPorChave(receitas) {
  const custos = new Map()
  for (const r of receitas || []) {
    const chave = chaveItem(r)
    if (!chave) continue
    const custoUnitario = Number(r.stock_items?.custo)
    if (!Number.isFinite(custoUnitario)) continue
    const acrescento = custoUnitario * Number(r.quantidade || 0)
    custos.set(chave, (custos.get(chave) || 0) + acrescento)
  }
  return custos
}

// Custo de uma linha vendida. Uma variante sem ficha própria herda a do
// produto — é o caso comum (mesma preparação, tamanho diferente), e é melhor
// aproximação do que tratá-la como custo zero.
export function custoDaLinha(linha, custos) {
  const chave = chaveItem(linha)
  if (chave && custos.has(chave)) return custos.get(chave)
  if (linha.variant_id && linha.product_id) {
    const doProduto = `p:${linha.product_id}`
    if (custos.has(doProduto)) return custos.get(doProduto)
  }
  return null // sem ficha técnica: não se inventa custo
}

// Agrega linhas vendidas por item, com receita, custo e margem.
// `nomeDe` permite reutilizar o nomeItemPedido já existente.
export function agregarPorItem(linhas, custos, nomeDe) {
  const mapa = new Map()
  for (const l of linhas || []) {
    const chave = chaveItem(l)
    if (!chave) continue
    const qtd = Number(l.quantidade || 0)
    const receita = Number(l.preco_unitario || 0) * qtd
    const custoUnit = custoDaLinha(l, custos)
    const anterior = mapa.get(chave) || {
      chave,
      nome: nomeDe ? nomeDe(l) : chave,
      qtd: 0,
      receita: 0,
      custo: 0,
      temFicha: custoUnit != null,
    }
    anterior.qtd += qtd
    anterior.receita += receita
    if (custoUnit != null) anterior.custo += custoUnit * qtd
    else anterior.temFicha = false
    mapa.set(chave, anterior)
  }
  return [...mapa.values()].map((i) => ({
    ...i,
    margem: i.temFicha ? i.receita - i.custo : null,
    margemPct: i.temFicha && i.receita > 0 ? ((i.receita - i.custo) / i.receita) * 100 : null,
    margemUnit: i.temFicha && i.qtd > 0 ? (i.receita - i.custo) / i.qtd : null,
  }))
}

// Totais do período. O food cost só conta o que tem ficha técnica — misturar
// receita com ficha e receita sem ficha daria uma percentagem falsamente boa.
export function totais(itens) {
  const comFicha = itens.filter((i) => i.temFicha)
  const receita = itens.reduce((s, i) => s + i.receita, 0)
  const receitaComFicha = comFicha.reduce((s, i) => s + i.receita, 0)
  const custo = comFicha.reduce((s, i) => s + i.custo, 0)
  return {
    receita,
    receitaComFicha,
    custo,
    margem: receitaComFicha - custo,
    margemPct: receitaComFicha > 0 ? ((receitaComFicha - custo) / receitaComFicha) * 100 : null,
    foodCostPct: receitaComFicha > 0 ? (custo / receitaComFicha) * 100 : null,
    coberturaPct: receita > 0 ? (receitaComFicha / receita) * 100 : null,
    semFicha: itens.filter((i) => !i.temFicha),
  }
}

// Engenharia de menu: cruza popularidade com margem unitária e arruma cada
// prato em quatro gavetas. O limiar clássico de popularidade é 70% da média —
// evita que num menu com muitos itens quase tudo caia em "vende pouco".
export const QUADRANTES = {
  estrela: {
    rotulo: 'Estrelas',
    dica: 'Vendem bem e dão margem. Proteger: não mexer no preço nem na receita.',
  },
  cavalo: {
    rotulo: 'Cavalos de batalha',
    dica: 'Vendem bem mas dão pouco. Subir preço com cuidado ou baixar o custo.',
  },
  enigma: {
    rotulo: 'Enigmas',
    dica: 'Dão margem mas vendem pouco. Dar destaque na ementa ou sugerir ao balcão.',
  },
  peso: {
    rotulo: 'Peso morto',
    dica: 'Vendem pouco e dão pouco. Candidatos a sair da ementa.',
  },
}

export function engenhariaMenu(itens) {
  const elegiveis = itens.filter((i) => i.temFicha && i.qtd > 0)
  if (elegiveis.length === 0) return { itens: [], limiarQtd: 0, limiarMargem: 0 }

  const limiarQtd = (elegiveis.reduce((s, i) => s + i.qtd, 0) / elegiveis.length) * 0.7
  const qtdTotal = elegiveis.reduce((s, i) => s + i.qtd, 0)
  const margemTotal = elegiveis.reduce((s, i) => s + i.margem, 0)
  const limiarMargem = qtdTotal > 0 ? margemTotal / qtdTotal : 0

  return {
    limiarQtd,
    limiarMargem,
    itens: elegiveis.map((i) => {
      const popular = i.qtd >= limiarQtd
      const rentavel = i.margemUnit >= limiarMargem
      return {
        ...i,
        quadrante: popular ? (rentavel ? 'estrela' : 'cavalo') : rentavel ? 'enigma' : 'peso',
      }
    }),
  }
}
