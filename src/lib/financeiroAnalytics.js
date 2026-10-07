// Agregações do Financeiro para o separador Analytics.
//
// Funções puras (sem Supabase) para poderem ser testadas com `node --test`.
//
// Enquanto não existe a estrutura de contas (Revolut / Caixa / Pago do bolso),
// a origem do dinheiro vive na descrição da despesa, numa etiqueta escrita na
// importação dos extratos:
//   "[pago do bolso: Leandro 50% / Neide 50%]"  → pago fora do banco, a reembolsar
//   sem etiqueta                                → pago pela conta da empresa
// Quando as contas existirem, só `origemDespesa` e `partesSocios` mudam.

const ETIQUETA_BOLSO = /\[pago do bolso:([^\]]*)\]/i

export function origemDespesa(descricao) {
  return ETIQUETA_BOLSO.test(descricao || '') ? 'bolso' : 'banco'
}

// Devolve { Leandro: 0.5, Neide: 0.5 } a partir da etiqueta. Um nome sem
// percentagem fica com a parte toda; percentagens que não somem 100 são
// normalizadas, para nunca se inventar ou perder dinheiro na divisão.
export function partesSocios(descricao) {
  const m = (descricao || '').match(ETIQUETA_BOLSO)
  if (!m) return {}
  const partes = {}
  for (const troco of m[1].split('/')) {
    const nome = troco.replace(/\d+(?:[.,]\d+)?\s*%/, '').trim()
    if (!nome) continue
    const pct = troco.match(/(\d+(?:[.,]\d+)?)\s*%/)
    partes[nome] = pct ? Number(pct[1].replace(',', '.')) : 100
  }
  const total = Object.values(partes).reduce((s, v) => s + v, 0)
  if (!total) return {}
  for (const nome of Object.keys(partes)) partes[nome] = partes[nome] / total
  return partes
}

// Receitas externas: aportes de sócios, testes de sistema e receita a sério.
export function tipoReceita(r) {
  const notas = (r.notas || '').toLowerCase()
  if (/teste de sistema/.test(notas)) return 'teste'
  if (r.canal === 'outro' && /aporte/.test(notas)) return 'aporte'
  return 'operacional'
}

const centimos = (v) => Math.round(Number(v || 0) * 100)
const euros = (c) => c / 100

const chaveMes = (data) => String(data).slice(0, 7) // "2026-07"

const ROTULOS_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMesCurto = (chave) => {
  const [a, m] = chave.split('-').map(Number)
  return `${ROTULOS_MES[m - 1]} ${String(a).slice(2)}`
}

// Todos os meses entre o primeiro lançamento e `ate` (inclusive), sem buracos:
// um mês sem despesas tem de aparecer a zero, senão o gráfico mente.
function mesesEntre(inicio, fim) {
  const meses = []
  let [a, m] = inicio.split('-').map(Number)
  const [af, mf] = fim.split('-').map(Number)
  while (a < af || (a === af && m <= mf)) {
    meses.push(`${a}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return meses
}

export function resumoFinanceiro(despesas, receitas, hoje = new Date()) {
  const ate = chaveMes(hoje.toLocaleDateString('sv-SE'))
  const datas = [...despesas, ...receitas].map((x) => chaveMes(x.data)).sort()
  const inicio = datas[0] && datas[0] < ate ? datas[0] : ate

  const porMes = new Map(
    mesesEntre(inicio, datas.at(-1) > ate ? datas.at(-1) : ate).map((k) => [
      k,
      { chave: k, rotulo: rotuloMesCurto(k), banco: 0, bolso: 0, entradas: 0 },
    ]),
  )
  const porCategoria = new Map()
  const dividaSocios = {}
  const aportesSocios = {}
  let banco = 0
  let bolso = 0
  let aportes = 0
  let testes = 0
  let operacional = 0

  for (const d of despesas) {
    const c = centimos(d.valor)
    const origem = origemDespesa(d.descricao)
    const mes = porMes.get(chaveMes(d.data))
    if (mes) mes[origem] += c
    if (origem === 'bolso') {
      bolso += c
      // Reparte em cêntimos inteiros; o último sócio fica com o resto, para a
      // soma das partes ser sempre exactamente o valor da despesa.
      const partes = Object.entries(partesSocios(d.descricao))
      let atribuido = 0
      partes.forEach(([nome, parte], i) => {
        const fatia = i === partes.length - 1 ? c - atribuido : Math.round(c * parte)
        atribuido += fatia
        dividaSocios[nome] = (dividaSocios[nome] || 0) + fatia
      })
    } else {
      banco += c
    }
    const cat = d.categoria || 'Sem categoria'
    porCategoria.set(cat, (porCategoria.get(cat) || 0) + c)
  }

  for (const r of receitas) {
    const c = centimos(r.valor)
    const tipo = tipoReceita(r)
    const mes = porMes.get(chaveMes(r.data))
    if (mes) mes.entradas += c
    if (tipo === 'aporte') {
      aportes += c
      const socio = /neide/i.test(r.notas || '') ? 'Neide' : /leandro/i.test(r.notas || '') ? 'Leandro' : 'Outro'
      aportesSocios[socio] = (aportesSocios[socio] || 0) + c
    } else if (tipo === 'teste') testes += c
    else operacional += c
  }

  // Acumulado do investimento (tudo o que saiu, venha de onde vier)
  let acumulado = 0
  const meses = [...porMes.values()].map((m) => {
    acumulado += m.banco + m.bolso
    return {
      chave: m.chave,
      rotulo: m.rotulo,
      banco: euros(m.banco),
      bolso: euros(m.bolso),
      total: euros(m.banco + m.bolso),
      entradas: euros(m.entradas),
      acumulado: euros(acumulado),
    }
  })

  const socios = [...new Set([...Object.keys(dividaSocios), ...Object.keys(aportesSocios)])]
    .filter((n) => n !== 'Outro')
    .sort()
    .map((nome) => ({
      nome,
      aportes: euros(aportesSocios[nome] || 0),
      divida: euros(Math.round(dividaSocios[nome] || 0)),
      total: euros((aportesSocios[nome] || 0) + Math.round(dividaSocios[nome] || 0)),
    }))

  return {
    totais: {
      investido: euros(banco + bolso),
      pagoBanco: euros(banco),
      pagoBolso: euros(bolso),
      aportes: euros(aportes),
      testes: euros(testes),
      receitaOperacional: euros(operacional),
      // Tudo o que entrou no banco menos tudo o que saiu dele. Para conferir
      // com o saldo do extrato; uma diferença é um movimento por lançar.
      saldoBanco: euros(aportes + testes + operacional - banco),
      dividaSocios: euros(Math.round(Object.values(dividaSocios).reduce((s, v) => s + v, 0))),
    },
    meses,
    categorias: [...porCategoria.entries()]
      .map(([nome, c]) => ({ nome, valor: euros(c) }))
      .sort((a, b) => b.valor - a.valor),
    socios,
  }
}
