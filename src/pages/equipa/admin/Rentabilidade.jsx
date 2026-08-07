// Rentabilidade — o painel dizia quanto se vendeu; este diz quanto se ganhou.
// Cruza as vendas do período com as fichas técnicas (stock_receitas × custo do
// item de stock) para obter custo das mercadorias, margem e food cost, e arruma
// a ementa na matriz clássica de engenharia de menu.
//
// Só entram vendas efectivas: encomendas de mesa/balcão, e do canal online só
// as que estão pagas — uma encomenda abandonada no checkout não é receita.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt, nomeItemPedido } from '../../../lib/pedidos'
import {
  custosPorChave,
  agregarPorItem,
  totais as calcularTotais,
  engenhariaMenu,
  QUADRANTES,
} from '../../../lib/rentabilidade'
import { CARTAO, CAMPO } from './comuns'

const iso = (d) => d.toISOString().slice(0, 10)
const hoje = () => iso(new Date())
const haDias = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}
const pct = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)

// Referência do sector para restauração: abaixo de 35% é saudável, acima de 40%
// costuma indicar preço a menos ou desperdício a mais.
function corFoodCost(v) {
  if (v == null) return 'text-grafite-900'
  if (v <= 35) return 'text-green-700'
  if (v <= 40) return 'text-ambar-600'
  return 'text-red-600'
}

function Kpi({ rotulo, valor, cor, nota }) {
  return (
    <div className={`${CARTAO} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{rotulo}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${cor || 'text-grafite-900'}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-grafite-600/70">{nota}</p>}
    </div>
  )
}

function Rentabilidade({ irPara }) {
  const [de, setDe] = useState(haDias(30))
  const [ate, setAte] = useState(hoje())
  const [linhas, setLinhas] = useState(null)
  const [receitas, setReceitas] = useState([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setLinhas(null)
    setErro('')
    const [rVendas, rReceitas] = await Promise.all([
      supabase
        .from('order_items')
        .select(
          'quantidade, preco_unitario, product_id, variant_id, combo_id,' +
            ' products(nome), product_variants(nome), combos(nome),' +
            ' orders!inner(criado_em, canal, estado_pagamento)',
        )
        .gte('orders.criado_em', `${de}T00:00:00`)
        .lte('orders.criado_em', `${ate}T23:59:59`)
        .limit(5000),
      supabase
        .from('stock_receitas')
        .select('product_id, variant_id, combo_id, quantidade, stock_items(custo)'),
    ])
    if (rVendas.error || rReceitas.error) {
      setErro('Não foi possível carregar. Confirma que as tabelas de stock existem.')
      setLinhas([])
      return
    }
    // Online só conta depois de pago; mesa/balcão conta sempre.
    setLinhas(
      (rVendas.data || []).filter(
        (l) => l.orders?.canal !== 'online' || l.orders?.estado_pagamento === 'pago',
      ),
    )
    setReceitas(rReceitas.data || [])
  }, [de, ate])

  useEffect(() => {
    carregar()
  }, [carregar])

  const custos = useMemo(() => custosPorChave(receitas), [receitas])
  const itens = useMemo(
    () => (linhas ? agregarPorItem(linhas, custos, nomeItemPedido) : []),
    [linhas, custos],
  )
  const t = useMemo(() => calcularTotais(itens), [itens])
  const menu = useMemo(() => engenhariaMenu(itens), [itens])

  const porQuadrante = (q) =>
    menu.itens.filter((i) => i.quadrante === q).sort((a, b) => b.margem - a.margem)

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Rentabilidade
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${CAMPO} mt-0 w-auto`} aria-label="De" />
            <span className="text-sm text-grafite-600/70">a</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${CAMPO} mt-0 w-auto`} aria-label="Até" />
          </div>
        </div>

        {erro && <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>{erro}</p>}
        {linhas === null && <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>}

        {linhas !== null && !erro && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi rotulo="Receita" valor={fmt(t.receita)} />
              <Kpi rotulo="Custo das mercadorias" valor={fmt(t.custo)} nota="só itens com ficha técnica" />
              <Kpi rotulo="Margem bruta" valor={fmt(t.margem)} nota={pct(t.margemPct)} />
              <Kpi
                rotulo="Food cost"
                valor={pct(t.foodCostPct)}
                cor={corFoodCost(t.foodCostPct)}
                nota="saudável até 35%"
              />
            </div>

            {/* A honestidade do número depende da cobertura das fichas técnicas:
                sem isto à vista, um food cost bonito pode ser só falta de dados. */}
            {t.semFicha.length > 0 && (
              <div className="mt-3 rounded-xl border border-ambar-500/50 bg-ambar-500/10 px-4 py-3 text-sm text-grafite-800">
                <strong>{pct(t.coberturaPct)} da receita</strong> tem ficha técnica. Ficaram de fora{' '}
                {t.semFicha.length} {t.semFicha.length === 1 ? 'item' : 'itens'} sem ingredientes
                definidos ({t.semFicha.slice(0, 4).map((i) => i.nome).join(', ')}
                {t.semFicha.length > 4 ? '…' : ''}) — o custo real é maior do que o mostrado.{' '}
                {irPara && (
                  <button type="button" onClick={() => irPara('produtos')} className="cursor-pointer font-semibold text-cobre-600 underline-offset-4 hover:underline">
                    Completar fichas
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Engenharia de menu ── */}
      {linhas !== null && !erro && menu.itens.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Engenharia de menu
          </h3>
          <p className="mt-1 text-sm text-grafite-600/70">
            Cada prato cruzado por quanto vende e quanto rende. Popular acima de{' '}
            {menu.limiarQtd.toFixed(1)} unidades; rentável acima de {fmt(menu.limiarMargem)} de
            margem por unidade.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {['estrela', 'cavalo', 'enigma', 'peso'].map((q) => {
              const lista = porQuadrante(q)
              return (
                <div key={q} className={`${CARTAO} p-5`}>
                  <p className="font-display text-base font-bold uppercase tracking-tight text-grafite-900">
                    {QUADRANTES[q].rotulo}
                    <span className="ml-2 text-sm font-normal text-grafite-600/70">
                      {lista.length}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-grafite-600/70">{QUADRANTES[q].dica}</p>
                  {lista.length === 0 ? (
                    <p className="mt-3 text-sm text-grafite-600/50">Nenhum item.</p>
                  ) : (
                    <ul className="mt-3 space-y-1">
                      {lista.map((i) => (
                        <li key={i.chave} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-grafite-900">{i.nome}</span>
                          <span className="whitespace-nowrap text-grafite-600/70">
                            {i.qtd}× · <strong className="text-grafite-900">{fmt(i.margemUnit)}</strong>/un
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Detalhe por item ── */}
      {linhas !== null && !erro && itens.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Margem por item
          </h3>
          <div className={`${CARTAO} mt-3 overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Receita</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                  <th className="px-4 py-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-creme-200">
                {[...itens]
                  .sort((a, b) => (b.margem ?? -Infinity) - (a.margem ?? -Infinity))
                  .map((i) => (
                    <tr key={i.chave}>
                      <td className="px-4 py-2.5 text-grafite-900">
                        {i.nome}
                        {!i.temFicha && (
                          <span className="ml-2 text-xs text-ambar-600">sem ficha</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{i.qtd}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(i.receita)}</td>
                      <td className="px-4 py-2.5 text-right text-grafite-600/70">
                        {i.temFicha ? fmt(i.custo) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-grafite-900">
                        {i.temFicha ? fmt(i.margem) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-grafite-600/70">
                        {pct(i.margemPct)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {linhas !== null && !erro && itens.length === 0 && (
        <p className={`${CARTAO} p-6 text-grafite-600`}>Sem vendas no período escolhido.</p>
      )}
    </div>
  )
}

export default Rentabilidade
