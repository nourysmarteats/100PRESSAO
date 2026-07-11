import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { GRAFICO, TooltipGrafico, CARTAO } from './comuns'

// Série temporal de receita: por hora (Hoje) ou por dia (7/30 dias),
// com buckets vazios preenchidos a zero para a linha ser contínua
function construirSerie(pedidos, periodo) {
  const chaveDia = (d) => d.toLocaleDateString('sv-SE')
  const buckets = []
  const porChave = new Map()

  if (periodo === 'dia') {
    const horaAtual = new Date().getHours()
    for (let h = 0; h <= horaAtual; h++) {
      const item = { chave: String(h), rotulo: `${h}h`, receita: 0 }
      buckets.push(item)
      porChave.set(item.chave, item)
    }
  } else {
    const dias = periodo === 'semana' ? 7 : 30
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const item = {
        chave: chaveDia(d),
        rotulo: `${d.getDate()}/${d.getMonth() + 1}`,
        receita: 0,
      }
      buckets.push(item)
      porChave.set(item.chave, item)
    }
  }

  pedidos.forEach((o) => {
    const d = new Date(o.criado_em)
    const chave = periodo === 'dia' ? String(d.getHours()) : chaveDia(d)
    const bucket = porChave.get(chave)
    if (bucket) bucket.receita += Number(o.total || 0)
  })

  return buckets.map((b) => ({ ...b, receita: Number(b.receita.toFixed(2)) }))
}

// Horas de pico: volume de pedidos por hora do dia, agregado no período —
// para decisões de escala de equipa (item 9 da v2)
function construirHorasPico(pedidos) {
  const horas = Array.from({ length: 24 }, (_, h) => ({
    rotulo: `${h}h`,
    pedidos: 0,
  }))
  pedidos.forEach((o) => {
    horas[new Date(o.criado_em).getHours()].pedidos += 1
  })
  // Janela útil: da primeira à última hora com movimento (mínimo 8h–23h)
  const comMovimento = horas.map((h, i) => (h.pedidos > 0 ? i : null)).filter((i) => i != null)
  const inicio = Math.min(8, ...(comMovimento.length ? [comMovimento[0]] : [8]))
  const fim = Math.max(23, ...(comMovimento.length ? [comMovimento[comMovimento.length - 1]] : [23]))
  return horas.slice(inicio, fim + 1)
}

function Analytics() {
  const [periodo, setPeriodo] = useState('dia')
  const [kpis, setKpis] = useState(null)
  const [top, setTop] = useState([])
  const [serie, setSerie] = useState([])
  const [horasPico, setHorasPico] = useState([])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const inicio = new Date()
      if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
      if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7)
      if (periodo === 'mes') inicio.setDate(inicio.getDate() - 30)

      const [rPedidos, rItens] = await Promise.all([
        supabase
          .from('orders')
          .select('total, criado_em, atualizado_em, metodo_pagamento')
          .eq('estado', 'entregue')
          .gte('criado_em', inicio.toISOString()),
        supabase
          .from('order_items')
          .select('quantidade, preco_unitario, products(nome), orders!inner(estado, criado_em)')
          .eq('orders.estado', 'entregue')
          .gte('orders.criado_em', inicio.toISOString()),
      ])
      if (!ativo) return

      const pedidos = rPedidos.data || []
      const receita = pedidos.reduce((s, o) => s + Number(o.total || 0), 0)
      const tempos = pedidos
        .map((o) => (new Date(o.atualizado_em) - new Date(o.criado_em)) / 60000)
        .filter((t) => t > 0 && t < 120)

      setKpis({
        pedidos: pedidos.length,
        receita,
        ticket: pedidos.length ? receita / pedidos.length : 0,
        tempoMedio: tempos.length
          ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
          : null,
      })
      setSerie(construirSerie(pedidos, periodo))
      setHorasPico(construirHorasPico(pedidos))

      const porProduto = new Map()
      ;(rItens.data || []).forEach((i) => {
        const nome = i.products?.nome || '—'
        const atual = porProduto.get(nome) || { qtd: 0, receita: 0 }
        atual.qtd += i.quantidade
        atual.receita += i.quantidade * Number(i.preco_unitario)
        porProduto.set(nome, atual)
      })
      setTop(
        [...porProduto.entries()]
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.qtd - a.qtd)
          .slice(0, 8),
      )
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [periodo])

  const semDados = serie.every((b) => b.receita === 0)

  return (
    <div>
      <div className="flex gap-2">
        {[
          { id: 'dia', rotulo: 'Hoje' },
          { id: 'semana', rotulo: '7 dias' },
          { id: 'mes', rotulo: '30 dias' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              periodo === p.id
                ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: 'Receita', valor: kpis ? fmt(kpis.receita) : '—' },
          { rotulo: 'Pedidos', valor: kpis?.pedidos ?? '—' },
          { rotulo: 'Ticket médio', valor: kpis ? fmt(kpis.ticket) : '—' },
          {
            rotulo: 'Tempo médio',
            valor: kpis?.tempoMedio != null ? `${kpis.tempoMedio} min` : '—',
          },
        ].map((k) => (
          <div key={k.rotulo} className={`${CARTAO} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
              {k.rotulo}
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-grafite-900">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Tendência de receita no período */}
      <div className={`${CARTAO} mt-6 p-4`}>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Tendência de receita
        </h3>
        {semDados ? (
          <p className="mt-3 text-sm text-grafite-600/70">Sem receita no período.</p>
        ) : (
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRAFICO.grelha} vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => `${v} €`}
                />
                <Tooltip
                  content={<TooltipGrafico formatador={fmt} />}
                  cursor={{ stroke: GRAFICO.tinta, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke={GRAFICO.serie}
                  strokeWidth={2}
                  fill={GRAFICO.serie}
                  fillOpacity={0.15}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Horas de pico (item 9): pedidos por hora do dia no período */}
      <div className={`${CARTAO} mt-6 p-4`}>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Horas de pico
        </h3>
        {kpis?.pedidos ? (
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={horasPico} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRAFICO.grelha} vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<TooltipGrafico formatador={(v) => `${v} pedidos`} />}
                  cursor={{ fill: 'rgba(201, 130, 46, 0.08)' }}
                />
                <Bar
                  dataKey="pedidos"
                  name="Pedidos"
                  fill={GRAFICO.serie}
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-sm text-grafite-600/70">Sem pedidos no período.</p>
        )}
      </div>

      <h3 className="mt-8 font-display text-lg font-bold uppercase text-grafite-600">
        Produtos mais vendidos
      </h3>
      {top.length === 0 ? (
        <p className="mt-3 text-grafite-600/70">Sem vendas no período.</p>
      ) : (
        <>
          <div className={`${CARTAO} mt-4 p-4`}>
            <ResponsiveContainer width="100%" height={top.length * 36 + 24}>
              <BarChart
                data={top}
                layout="vertical"
                margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={140}
                  tick={{ fill: GRAFICO.tintaForte, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TooltipGrafico formatador={(v) => `${v} unidades`} />}
                  cursor={{ fill: 'rgba(201, 130, 46, 0.08)' }}
                />
                <Bar
                  dataKey="qtd"
                  name="Vendidos"
                  fill={GRAFICO.serie}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vista em lista (com receita) — alternativa acessível ao gráfico */}
          <ul className="mt-4 space-y-2">
            {top.map((p, i) => (
              <li
                key={p.nome}
                className={`${CARTAO} flex items-center justify-between px-4 py-3`}
              >
                <span className="text-grafite-900">
                  <span className="mr-3 font-display font-bold text-ambar-600">{i + 1}.</span>
                  {p.nome}
                </span>
                <span className="text-sm text-grafite-600">
                  {p.qtd}× · {fmt(p.receita)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default Analytics
