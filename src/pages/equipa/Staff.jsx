import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  fmt,
  minutosDesde,
  proximoEstado,
  ROTULO_ESTADO,
  METODOS_PAGAMENTO,
  exigeFatura,
  temEntrega,
  nomeItemPedido,
  obterPedidosAtivos,
} from '../../lib/pedidos'
import { chamarApiFaturar } from '../../lib/equipa'
import { useAviso } from './admin/comuns'

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

const ATALHO =
  'inline-flex items-center rounded-full border border-grafite-900/20 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-grafite-800 transition-colors hover:border-grafite-900'

function CartaoPedido({ pedido, aoAvancar, aoEntregar }) {
  const entrega = temEntrega(pedido)
  const porCobrar = pedido.estado_pagamento === 'na_entrega'
  const [metodo, setMetodo] = useState(pedido.metodo_pagamento || null)
  const [ocupado, setOcupado] = useState(false)
  const [querFatura, setQuerFatura] = useState(false)
  const [nif, setNif] = useState('')
  // Eletrónico é sempre faturado; em numerário a fatura fica ao critério do
  // cliente. O NIF é sempre opcional, mas se for escrito tem de ser válido.
  const faturaObrigatoria = exigeFatura(metodo)
  const vaiFaturar = faturaObrigatoria || querFatura
  const nifValido = nif === '' || /^\d{9}$/.test(nif)
  // O momento de fechar a conta é o último passo antes de 'entregue': ao balcão
  // é quando está pronto; numa entrega é quando já vai a caminho, porque só
  // então o dinheiro muda de mãos.
  const aFechar = pedido.estado === (entrega ? 'a_caminho' : 'pronto')
  const emDestaque = pedido.estado === 'pronto' || pedido.estado === 'a_caminho'

  return (
    <article
      className={`rounded-2xl border p-5 ${
        emDestaque ? 'border-ambar-500/60 bg-white/70' : 'border-creme-300 bg-white/70'
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

      {entrega && (
        <div className="mt-4 rounded-xl border border-ambar-500/50 bg-ambar-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobre-600">
            Entrega ao domicílio
            {pedido.distancia_km > 0 && ` · ${Number(pedido.distancia_km).toFixed(1)} km`}
          </p>
          <p className="mt-1.5 font-semibold text-grafite-900">{pedido.morada || '— sem morada —'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pedido.cliente_telefone && (
              <a href={`tel:+351${pedido.cliente_telefone}`} className={ATALHO}>
                Ligar {pedido.cliente_telefone}
              </a>
            )}
            {pedido.morada && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.morada)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={ATALHO}
              >
                Como chegar
              </a>
            )}
          </div>
          {/* A cobrar à porta: quem vai entregar tem de saber o valor e levar troco. */}
          {porCobrar && (
            <p className="mt-3 rounded-lg bg-grafite-900 px-3 py-2 text-sm font-semibold text-creme-50">
              Cobrar na entrega: {fmt(pedido.total)} em dinheiro
            </p>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-1 border-t border-creme-300 pt-3 text-sm text-grafite-600">
        {pedido.order_items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>
              {i.quantidade}× {nomeItemPedido(i)}
            </span>
            <span>{fmt(i.preco_unitario * i.quantidade)}</span>
          </li>
        ))}
        <li className="flex justify-between pt-2 font-display font-bold text-grafite-900">
          <span>Total</span>
          <span>{fmt(pedido.total)}</span>
        </li>
      </ul>

      {aFechar ? (
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
          {faturaObrigatoria ? (
            <p className="mt-3 rounded-lg border border-creme-300 bg-creme-100/60 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600">
              Fatura emitida automaticamente
            </p>
          ) : (
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-grafite-600">
              <input
                type="checkbox"
                checked={querFatura}
                onChange={(e) => setQuerFatura(e.target.checked)}
                className="h-4 w-4 accent-ambar-500"
              />
              Cliente quer fatura
            </label>
          )}
          {vaiFaturar && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="NIF (opcional, 9 dígitos)"
              value={nif}
              onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm text-grafite-900 outline-none ${
                nifValido ? 'border-creme-300 focus:border-ambar-500' : 'border-red-500'
              }`}
            />
          )}
          <button
            type="button"
            disabled={!metodo || ocupado || !nifValido}
            onClick={async () => {
              setOcupado(true)
              await aoEntregar(pedido.id, metodo, { querFatura: vaiFaturar, nif: nif || undefined })
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
          → {ROTULO_ESTADO[proximoEstado(pedido.estado, entrega)]}
        </button>
      )}
    </article>
  )
}

function Staff() {
  const [pedidos, setPedidos] = useState([])
  const [entreguesHoje, setEntreguesHoje] = useState({ n: 0, receita: 0 })
  const [, forcarTick] = useState(0)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const [ativos, entregues] = await Promise.all([
      obterPedidosAtivos(supabase),
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
    const proximo = proximoEstado(pedido.estado, temEntrega(pedido))
    if (!proximo || proximo === 'entregue') return
    await supabase.from('orders').update({ estado: proximo }).eq('id', pedido.id)
    carregar()
  }

  async function entregar(id, metodo, opcoesFatura) {
    await supabase
      .from('orders')
      .update({ estado: 'entregue', metodo_pagamento: metodo, estado_pagamento: 'pago' })
      .eq('id', id)
    // Regista o pedido de fatura (colunas da migração de fatura). Feito num
    // update à parte para não bloquear a entrega se a migração ainda não
    // estiver aplicada — nesse caso este falha em silêncio.
    if (opcoesFatura) {
      await supabase
        .from('orders')
        .update({
          fatura_pedida: !!opcoesFatura.querFatura,
          fatura_nif: opcoesFatura.querFatura ? opcoesFatura.nif || null : null,
        })
        .eq('id', id)
    }
    carregar()

    // Emissão da fatura via Vendus (sob pedido). Falha em silêncio para não
    // bloquear a entrega — o pedido de fatura já ficou registado na BD acima.
    if (opcoesFatura?.querFatura) {
      try {
        const r = await chamarApiFaturar({ pedido_id: id, nif: opcoesFatura.nif })
        if (r.url) window.open(r.url, '_blank', 'noopener')
        mostrarAviso(
          r.modo_teste
            ? 'Fatura emitida em modo de teste (Vendus) ✓'
            : r.ja_existia
              ? 'Fatura já tinha sido emitida ✓'
              : 'Fatura emitida ✓',
        )
      } catch (erro) {
        mostrarAviso(`Erro a emitir fatura: ${erro.message}`)
      }
    }
  }

  // "Prontos" é o que já saiu da cozinha e espera fecho: pronto ao balcão, ou
  // a caminho na estrada.
  const prontos = pedidos.filter((p) => p.estado === 'pronto' || p.estado === 'a_caminho')
  const emCurso = pedidos.filter((p) => p.estado !== 'pronto' && p.estado !== 'a_caminho')

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
      {Aviso}
    </main>
  )
}

export default Staff
