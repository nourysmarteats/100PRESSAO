// Relatórios — hub central. Reúne os relatórios de STOCK (valor em stock,
// abaixo do mínimo, movimentos) e encaminha para os de VENDAS (Analytics),
// fecho de caixa e faturas, que vivem nas suas próprias secções. `irPara`
// vem do Admin e troca a secção ativa.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt, nomeItemPedido } from '../../../lib/pedidos'
import { CARTAO, CAMPO } from './comuns'

const nf = (n) => Number(n ?? 0).toLocaleString('pt-PT', { maximumFractionDigits: 2 })
const iso = (d) => d.toISOString().slice(0, 10)
const hoje = () => iso(new Date())
const haDias = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}
const abaixoMin = (it) => Number(it.alerta_minimo) > 0 && Number(it.quantidade) <= Number(it.alerta_minimo)

// Alvo de reposição: a quantidade ideal definida no Stock; se ainda não estiver
// preenchida, sugere-se o dobro do alerta para a lista ser útil desde o início.
const alvoReposicao = (it) =>
  it.quantidade_ideal != null && it.quantidade_ideal !== ''
    ? Number(it.quantidade_ideal)
    : Number(it.alerta_minimo) * 2
const alvoSugerido = (it) => it.quantidade_ideal == null || it.quantidade_ideal === ''
const ROTULO_MOV = {
  entrada: { rotulo: 'Entrada', sinal: '+', cor: 'text-green-600' },
  saida: { rotulo: 'Saída', sinal: '−', cor: 'text-red-600' },
  venda: { rotulo: 'Venda', sinal: '−', cor: 'text-red-600' },
  ajuste: { rotulo: 'Ajuste', sinal: '=', cor: 'text-grafite-900' },
}

const ATALHOS = [
  { id: 'analytics', titulo: 'Vendas & receita', dica: 'Receita, pedidos, ticket médio, top produtos, horas de pico' },
  { id: 'caixa', titulo: 'Fecho de caixa', dica: 'Apuramento por método de pagamento' },
  { id: 'faturas', titulo: 'Faturas', dica: 'Quem pediu fatura e o NIF' },
]

function Relatorios({ irPara }) {
  const [itens, setItens] = useState(null)
  const [movs, setMovs] = useState([])
  const [semStock, setSemStock] = useState(false)

  // Vendas por produto (intervalo de datas + pesquisa)
  const [de, setDe] = useState(haDias(30))
  const [ate, setAte] = useState(hoje())
  const [busca, setBusca] = useState('')
  const [vendas, setVendas] = useState(null)

  const carregarVendas = useCallback(async () => {
    setVendas(null)
    const { data, error } = await supabase
      .from('order_items')
      .select('quantidade, preco_unitario, products(nome), product_variants(nome), combos(nome), orders!inner(criado_em)')
      .gte('orders.criado_em', `${de}T00:00:00`)
      .lte('orders.criado_em', `${ate}T23:59:59`)
      .limit(5000)
    if (error) {
      setVendas([])
      return
    }
    const m = new Map()
    ;(data || []).forEach((i) => {
      const nome = nomeItemPedido(i)
      const a = m.get(nome) || { qtd: 0, receita: 0 }
      a.qtd += i.quantidade
      a.receita += i.quantidade * Number(i.preco_unitario)
      m.set(nome, a)
    })
    setVendas([...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd))
  }, [de, ate])

  useEffect(() => {
    carregarVendas()
  }, [carregarVendas])

  const vendasFiltradas = useMemo(
    () => (vendas || []).filter((v) => v.nome.toLowerCase().includes(busca.trim().toLowerCase())),
    [vendas, busca],
  )
  const totalQtd = vendasFiltradas.reduce((s, v) => s + v.qtd, 0)
  const totalReceita = vendasFiltradas.reduce((s, v) => s + v.receita, 0)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const [ri, rm] = await Promise.all([
        supabase
          .from('stock_items')
          .select('id, nome, categoria, unidade, quantidade, alerta_minimo, quantidade_ideal, custo'),
        supabase
          .from('stock_movements')
          .select('id, tipo, quantidade, motivo, criado_em, stock_items(nome, unidade)')
          .order('criado_em', { ascending: false })
          .limit(80),
      ])
      if (!ativo) return
      if (ri.error) {
        setSemStock(true)
        setItens([])
      } else setItens(ri.data)
      setMovs(rm.data || [])
    })()
    return () => {
      ativo = false
    }
  }, [])

  const baixos = (itens || []).filter(abaixoMin)
  const valor = (itens || []).reduce((s, i) => s + (i.custo != null ? Number(i.quantidade) * Number(i.custo) : 0), 0)

  // ── Lista de compras ──
  // Parte dos itens que atingiram o ponto de encomenda (no mínimo ou abaixo) e
  // calcula quanto falta comprar para chegar ao alvo. Agrupada por categoria,
  // que é como se anda numa loja de fornecedores.
  const listaCompras = useMemo(() => {
    const linhas = baixos
      .map((it) => {
        const comprar = alvoReposicao(it) - Number(it.quantidade)
        return {
          ...it,
          comprar,
          alvo: alvoReposicao(it),
          sugerido: alvoSugerido(it),
          custoLinha: it.custo != null ? comprar * Number(it.custo) : null,
        }
      })
      .filter((l) => l.comprar > 0)

    const grupos = new Map()
    linhas.forEach((l) => {
      const cat = l.categoria || 'Sem categoria'
      if (!grupos.has(cat)) grupos.set(cat, [])
      grupos.get(cat).push(l)
    })
    return {
      grupos: [...grupos.entries()]
        .map(([categoria, itens]) => ({
          categoria,
          itens: itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
        }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt')),
      total: linhas.reduce((s, l) => s + (l.custoLinha || 0), 0),
      nLinhas: linhas.length,
      semCusto: linhas.some((l) => l.custoLinha == null),
    }
  }, [baixos])

  const [copiado, setCopiado] = useState(false)
  async function copiarLista() {
    const texto = [
      `Lista de compras — 100PRESSÃO (${new Date().toLocaleDateString('pt-PT')})`,
      '',
      ...listaCompras.grupos.flatMap((g) => [
        g.categoria.toUpperCase(),
        ...g.itens.map(
          (l) => `- ${l.nome}: ${nf(l.comprar)} ${l.unidade} (tenho ${nf(l.quantidade)}, alvo ${nf(l.alvo)})`,
        ),
        '',
      ]),
      listaCompras.total > 0 ? `Total estimado: ${nf(listaCompras.total)} €` : '',
    ]
      .join('\n')
      .trim()
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Vendas por produto — intervalo de datas + pesquisa */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Vendas por produto</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">De</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${CAMPO} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${CAMPO} mt-1`} />
          </label>
          <label className="block min-w-48 flex-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Procurar item</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: coca" className={`${CAMPO} mt-1`} />
          </label>
        </div>

        {vendas === null ? (
          <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
        ) : vendasFiltradas.length === 0 ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            Sem vendas no período{busca ? ' para essa procura' : ''}. As vendas aparecem quando há
            pedidos reais (mesa em /cardapio; restaurante online quando deixar de ser simulação).
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qtd</th>
                  <th className="py-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {vendasFiltradas.map((v) => (
                  <tr key={v.nome} className="border-b border-creme-200">
                    <td className="py-2 text-grafite-900">{v.nome}</td>
                    <td className="py-2 text-right font-semibold text-grafite-900">{nf(v.qtd)}</td>
                    <td className="py-2 text-right text-grafite-600">{fmt(v.receita)}</td>
                  </tr>
                ))}
                <tr className="font-display font-bold text-grafite-900">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{nf(totalQtd)}</td>
                  <td className="py-2 text-right">{fmt(totalReceita)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Encaminhamento para os relatórios de vendas/caixa/faturas */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Vendas & finanças</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => irPara?.(a.id)}
              className={`${CARTAO} cursor-pointer p-4 text-left transition-colors hover:border-ambar-500`}
            >
              <p className="flex items-center gap-2 font-display font-bold uppercase text-grafite-900">
                {a.titulo}
                <svg className="h-3.5 w-3.5 text-cobre-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
                </svg>
              </p>
              <p className="mt-1 text-xs text-grafite-600/70">{a.dica}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Relatórios de stock */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Stock</h3>
        {semStock ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            As tabelas de stock ainda não existem. Aplica a migração de inventário no Supabase.
          </p>
        ) : itens === null ? (
          <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { rotulo: 'Itens', valor: itens.length },
                { rotulo: 'Abaixo do mínimo', valor: baixos.length, alerta: baixos.length > 0 },
                { rotulo: 'Valor em stock', valor: `${nf(valor)} €` },
              ].map((k) => (
                <div key={k.rotulo} className={`${CARTAO} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{k.rotulo}</p>
                  <p className={`mt-1 font-display text-2xl font-bold ${k.alerta ? 'text-red-600' : 'text-grafite-900'}`}>
                    {k.valor}
                  </p>
                </div>
              ))}
            </div>

            {/* Lista de compras — os itens no ponto de encomenda, já com a
                quantidade a comprar e o custo estimado, agrupados por categoria */}
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
                  Lista de compras
                </p>
                {listaCompras.nLinhas > 0 && (
                  <button
                    type="button"
                    onClick={copiarLista}
                    className="cursor-pointer rounded-full border border-creme-300 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-grafite-600 transition-colors hover:border-grafite-600"
                  >
                    {copiado ? 'Copiada ✓' : 'Copiar lista'}
                  </button>
                )}
              </div>

              {listaCompras.nLinhas === 0 ? (
                <p className="mt-2 text-sm text-grafite-600/70">
                  Nada a repor — nenhum item chegou ao mínimo.
                </p>
              ) : (
                <>
                  {listaCompras.grupos.map((g) => (
                    <div key={g.categoria} className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                        {g.categoria}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {g.itens.map((l) => (
                          <li key={l.id} className={`${CARTAO} flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm`}>
                            <span className="text-grafite-900">
                              {l.nome}
                              <span className="ml-2 text-xs text-grafite-600/70">
                                tenho {nf(l.quantidade)} · alvo {nf(l.alvo)}
                                {l.sugerido && <span title="Define a quantidade ideal no painel Stock"> (sugerido)</span>}
                              </span>
                            </span>
                            <span className="whitespace-nowrap">
                              <strong className="font-display text-base text-grafite-900">
                                {nf(l.comprar)} {l.unidade}
                              </strong>
                              {l.custoLinha != null && (
                                <span className="ml-2 text-grafite-600/70">≈ {nf(l.custoLinha)} €</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="mt-3 flex items-baseline justify-between border-t border-creme-300 pt-3">
                    <span className="text-sm text-grafite-600">
                      {listaCompras.nLinhas} {listaCompras.nLinhas === 1 ? 'item' : 'itens'} a comprar
                      {listaCompras.semCusto && (
                        <span className="text-grafite-600/70"> · alguns sem custo definido</span>
                      )}
                    </span>
                    <span className="font-display text-lg font-bold text-grafite-900">
                      ≈ {nf(listaCompras.total)} €
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-grafite-600/70">Movimentos recentes</p>
              {movs.length === 0 ? (
                <p className="mt-2 text-sm text-grafite-600/70">Sem movimentos registados.</p>
              ) : (
                <ul className="mt-2 divide-y divide-creme-300 rounded-2xl border border-creme-300 bg-white/70">
                  {movs.map((mv) => {
                    const r = ROTULO_MOV[mv.tipo] || { rotulo: mv.tipo, sinal: '', cor: 'text-grafite-900' }
                    return (
                      <li key={mv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <span className="text-grafite-900">
                          <strong className={r.cor}>{r.sinal}{nf(mv.quantidade)}</strong> {mv.stock_items?.unidade || ''} ·{' '}
                          {mv.stock_items?.nome || '(item removido)'}
                          <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/70">{r.rotulo}</span>
                          {mv.motivo ? <span className="ml-2 text-grafite-600/70">· {mv.motivo}</span> : ''}
                        </span>
                        <span className="text-xs text-grafite-600/70">
                          {new Date(mv.criado_em).toLocaleString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default Relatorios
