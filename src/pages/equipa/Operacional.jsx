import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  fmt,
  beep,
  minutosDesde,
  ROTULO_ESTADO,
  nomeItemPedido,
  categoriaItemPedido,
  obterPedidosAtivos,
} from '../../lib/pedidos'

const ESTADO_ITEM = {
  pendente: { rotulo: 'Pendente', botao: '→ Preparar' },
  em_preparacao: { rotulo: 'Em preparação', botao: '→ Pronto' },
  pronto: { rotulo: 'Pronto', botao: '✓' },
}

function proximoEstadoItem(estado) {
  return estado === 'pendente' ? 'em_preparacao' : 'pronto'
}

// Estado do pedido derivado dos itens (no original ficava implícito)
function estadoDerivado(itens) {
  if (itens.length === 0) return null
  if (itens.every((i) => i.estado === 'pronto')) return 'pronto'
  if (itens.some((i) => i.estado !== 'pendente')) return 'em_preparacao'
  return 'recebido'
}

function Operacional() {
  const [pedidos, setPedidos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtroCat, setFiltroCat] = useState('todas')
  const [somLigado, setSomLigado] = useState(true)
  const [entreguesHoje, setEntreguesHoje] = useState(0)
  const somRef = useRef(true)
  somRef.current = somLigado
  const [, forcarTick] = useState(0)

  const carregar = useCallback(async () => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const [ativos, rCat, entregues] = await Promise.all([
      obterPedidosAtivos(supabase),
      supabase.from('categories').select('*').order('ordem'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'entregue')
        .gte('criado_em', hoje.toISOString()),
    ])
    if (!ativos.error) setPedidos(ativos.data)
    if (!rCat.error) setCategorias(rCat.data)
    if (entregues.count != null) setEntreguesHoje(entregues.count)
  }, [])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('op-pedidos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (somRef.current) beep([660, 880])
        carregar()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, carregar)
      .subscribe()
    const tick = setInterval(() => forcarTick((n) => n + 1), 30000)
    return () => {
      supabase.removeChannel(canal)
      clearInterval(tick)
    }
  }, [carregar])

  async function avancarItem(pedido, item) {
    const novoEstadoItem = proximoEstadoItem(item.estado)
    const { error } = await supabase
      .from('order_items')
      .update({ estado: novoEstadoItem })
      .eq('id', item.id)
    if (error) return

    // Sincronizar o estado do pedido (o stepper do cliente e o ecrã dependem dele)
    const itensAtualizados = pedido.order_items.map((i) =>
      i.id === item.id ? { ...i, estado: novoEstadoItem } : i,
    )
    const novoEstadoPedido = estadoDerivado(itensAtualizados)
    if (novoEstadoPedido && novoEstadoPedido !== pedido.estado) {
      await supabase.from('orders').update({ estado: novoEstadoPedido }).eq('id', pedido.id)
    }
    carregar()
  }

  const itensPendentes = pedidos.reduce(
    (s, p) => s + p.order_items.filter((i) => i.estado !== 'pronto').length,
    0,
  )
  const prontos = pedidos.filter((p) => p.estado === 'pronto').length

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          {[
            { rotulo: 'Ativos', valor: pedidos.length },
            { rotulo: 'Itens por fazer', valor: itensPendentes },
            { rotulo: 'Prontos', valor: prontos },
            { rotulo: 'Entregues hoje', valor: entreguesHoje },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-xl border border-creme-300 bg-white/70 px-4 py-2">
              <span className="font-display text-2xl font-bold text-grafite-900">{k.valor}</span>
              <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/70">
                {k.rotulo}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSomLigado((v) => !v)}
          aria-pressed={somLigado}
          className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
        >
          Som: {somLigado ? 'ligado' : 'desligado'}
        </button>
      </div>

      {/* Filtro por categoria (bar vs cozinha) */}
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {[{ id: 'todas', nome: 'Tudo' }, ...categorias].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFiltroCat(c.id)}
            className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              String(filtroCat) === String(c.id)
                ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {pedidos.length === 0 && (
        <p className="mt-12 text-center text-grafite-600/70">Sem pedidos ativos. 🍺 em paz.</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map((p) => {
          const itens =
            filtroCat === 'todas'
              ? p.order_items
              : p.order_items.filter(
                  (i) => String(categoriaItemPedido(i)) === String(filtroCat),
                )
          if (itens.length === 0) return null
          const minutos = minutosDesde(p.criado_em)
          return (
            <article
              key={p.id}
              className={`rounded-2xl border p-5 ${
                p.estado === 'pronto'
                  ? 'border-ambar-500/60 bg-white/70'
                  : minutos >= 15
                    ? 'border-red-500/50 bg-white/70'
                    : 'border-creme-300 bg-white/70'
              }`}
            >
              <header className="flex items-center justify-between">
                <span className="font-display text-2xl font-bold text-ambar-600">
                  nº {p.numero}
                </span>
                <div className="text-right text-xs text-grafite-600/70">
                  <p>{p.sessions?.posicao_mesa || p.sessions?.nome_cliente || '—'}</p>
                  <p className={minutos >= 15 ? 'font-bold text-red-600' : ''}>{minutos} min</p>
                </div>
              </header>

              <ul className="mt-4 space-y-2">
                {itens.map((i) => (
                  <li
                    key={i.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                      i.estado === 'pronto'
                        ? 'border-creme-300 opacity-50'
                        : 'border-creme-300'
                    }`}
                  >
                    <span className="text-sm text-grafite-900">
                      <strong className="text-ambar-600">{i.quantidade}×</strong>{' '}
                      {nomeItemPedido(i)}
                    </span>
                    <button
                      type="button"
                      disabled={i.estado === 'pronto'}
                      onClick={() => avancarItem(p, i)}
                      className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                        i.estado === 'pronto'
                          ? 'text-grafite-600/70'
                          : i.estado === 'em_preparacao'
                            ? 'bg-ambar-500 text-grafite-950 hover:bg-ambar-400'
                            : 'border border-grafite-600/40 text-grafite-600 hover:border-ambar-500'
                      }`}
                    >
                      {ESTADO_ITEM[i.estado]?.botao || i.estado}
                    </button>
                  </li>
                ))}
              </ul>

              <footer className="mt-4 flex items-center justify-between border-t border-creme-300 pt-3 text-xs uppercase tracking-widest">
                <span className="text-grafite-600/70">{ROTULO_ESTADO[p.estado]}</span>
                <span className="font-display text-sm font-bold text-grafite-600">
                  {fmt(p.total)}
                </span>
              </footer>
            </article>
          )
        })}
      </div>
    </main>
  )
}

export default Operacional
