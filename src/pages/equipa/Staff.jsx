import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  fmt,
  minutosDesde,
  proximoEstado,
  ROTULO_ESTADO,
  METODOS_PAGAMENTO,
  SELECT_PEDIDO_COMPLETO,
} from '../../lib/pedidos'

function Kpi({ rotulo, valor, destaque }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? 'border-ambar-500/50 bg-ambar-500/10' : 'border-creme-300 bg-white/70'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{rotulo}</p>
      <p className="mt-1 font-display text-3xl font-bold text-grafite-900">{valor}</p>
    </div>
  )
}

function CartaoPedido({ pedido, aoAvancar, aoEntregar }) {
  const [metodo, setMetodo] = useState(pedido.metodo_pagamento || null)
  const [ocupado, setOcupado] = useState(false)
  const pronto = pedido.estado === 'pronto'

  return (
    <article
      className={`rounded-2xl border p-5 ${
        pronto ? 'border-ambar-500/60 bg-white/70' : 'border-creme-300 bg-white/70'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-ambar-600">nº {pedido.numero}</p>
          <p className="mt-0.5 text-sm text-grafite-600">
            {pedido.sessions?.nome_cliente}
            {pedido.sessions?.posicao_mesa ? ` · ${pedido.sessions.posicao_mesa}` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-full border border-creme-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-grafite-600">
            {ROTULO_ESTADO[pedido.estado]}
          </span>
          <p className="mt-1 text-xs text-grafite-600/70">{minutosDesde(pedido.criado_em)} min</p>
        </div>
      </header>

      <ul className="mt-4 space-y-1 border-t border-creme-300 pt-3 text-sm text-grafite-600">
        {pedido.order_items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>
              {i.quantidade}× {i.products?.nome}
            </span>
            <span>{fmt(i.preco_unitario * i.quantidade)}</span>
          </li>
        ))}
        <li className="flex justify-between pt-2 font-display font-bold text-grafite-900">
          <span>Total</span>
          <span>{fmt(pedido.total)}</span>
        </li>
      </ul>

      {pronto ? (
        <div className="mt-4 border-t border-creme-300 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {METODOS_PAGAMENTO.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetodo(m.id)}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  metodo === m.id
                    ? 'border-ambar-500 bg-ambar-500/20 text-grafite-900'
                    : 'border-creme-300 text-grafite-600/70 hover:text-grafite-900'
                }`}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!metodo || ocupado}
            onClick={async () => {
              setOcupado(true)
              await aoEntregar(pedido.id, metodo)
              setOcupado(false)
            }}
            className="mt-3 w-full cursor-pointer rounded-full bg-ambar-500 px-6 py-3 font-semibold uppercase tracking-widest text-grafite-950 transition-colors hover:bg-ambar-400 disabled:opacity-40"
          >
            {ocupado ? 'A registar…' : 'Confirmar entrega'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            await aoAvancar(pedido)
            setOcupado(false)
          }}
          className="mt-4 w-full cursor-pointer rounded-full border border-grafite-600/40 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-grafite-900 transition-colors hover:border-ambar-500 hover:text-ambar-600 disabled:opacity-40"
        >
          → {ROTULO_ESTADO[proximoEstado(pedido.estado)]}
        </button>
      )}
    </article>
  )
}

function Staff() {
  const [pedidos, setPedidos] = useState([])
  const [entreguesHoje, setEntreguesHoje] = useState({ n: 0, receita: 0 })
  const [, forcarTick] = useState(0)

  const carregar = useCallback(async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [ativos, entregues] = await Promise.all([
      supabase
        .from('orders')
        .select(SELECT_PEDIDO_COMPLETO)
        .neq('estado', 'entregue')
        .order('criado_em'),
      supabase
        .from('orders')
        .select('total')
        .eq('estado', 'entregue')
        .gte('criado_em', hoje.toISOString()),
    ])

    if (!ativos.error) setPedidos(ativos.data)
    if (!entregues.error)
      setEntreguesHoje({
        n: entregues.data.length,
        receita: entregues.data.reduce((s, o) => s + Number(o.total || 0), 0),
      })
  }, [])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('staff-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, carregar)
      .subscribe()
    const tick = setInterval(() => forcarTick((n) => n + 1), 30000)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(tick)
    }
  }, [carregar])

  async function avancarPedido(pedido) {
    const proximo = proximoEstado(pedido.estado)
    if (!proximo || proximo === 'entregue') return
    await supabase.from('orders').update({ estado: proximo }).eq('id', pedido.id)
    carregar()
  }

  async function entregar(id, metodo) {
    await supabase
      .from('orders')
      .update({ estado: 'entregue', metodo_pagamento: metodo, estado_pagamento: 'pago' })
      .eq('id', id)
    carregar()
  }

  const prontos = pedidos.filter((p) => p.estado === 'pronto')
  const emCurso = pedidos.filter((p) => p.estado !== 'pronto')

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi rotulo="Prontos" valor={prontos.length} destaque={prontos.length > 0} />
        <Kpi rotulo="Em curso" valor={emCurso.length} />
        <Kpi rotulo="Entregues hoje" valor={entreguesHoje.n} />
        <Kpi rotulo="Receita hoje" valor={fmt(entreguesHoje.receita)} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold uppercase text-ambar-600">
          Prontos para entrega
        </h2>
        {prontos.length === 0 ? (
          <p className="mt-3 text-grafite-600/70">Nada pronto neste momento.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prontos.map((p) => (
              <CartaoPedido key={p.id} pedido={p} aoAvancar={avancarPedido} aoEntregar={entregar} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold uppercase text-grafite-600">Em curso</h2>
        {emCurso.length === 0 ? (
          <p className="mt-3 text-grafite-600/70">Sem pedidos em curso.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emCurso.map((p) => (
              <CartaoPedido key={p.id} pedido={p} aoAvancar={avancarPedido} aoEntregar={entregar} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default Staff
