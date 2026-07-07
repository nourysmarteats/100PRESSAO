import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'

// Promessa com prazo: se a rede/Supabase não responder, rejeita em vez de
// deixar a UI presa em "Um momento…" indefinidamente.
function comTimeout(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error('timeout')), ms),
    ),
  ])
}

/*
 * Sistema de pedidos — fase 1 (cliente).
 * Fluxo portado de ooraculo/cliente.html (sessão → menu → carrinho →
 * pagamento → acompanhamento realtime), rebrandado 100PRESSÃO e ligado
 * ao schema categories/products/sessions/orders/order_items.
 */

const fmt = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`

const METODOS_PAGAMENTO = [
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'multibanco', rotulo: 'Multibanco' },
  { id: 'mbway', rotulo: 'MB Way' },
  { id: 'cartao', rotulo: 'Cartão' },
]

const ESTADOS_PEDIDO = [
  { id: 'recebido', rotulo: 'Recebido' },
  { id: 'em_preparacao', rotulo: 'Em preparação' },
  { id: 'pronto', rotulo: 'Pronto' },
  { id: 'entregue', rotulo: 'Entregue' },
]

const ecra = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
}

function BotaoPrimario({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ambar-500 px-8 py-3 font-semibold uppercase tracking-widest text-grafite-950 transition-colors duration-200 hover:bg-ambar-400 disabled:cursor-not-allowed disabled:opacity-40 ${props.className || ''}`}
    >
      {children}
    </button>
  )
}

function ControloQuantidade({ qtd, onMais, onMenos }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onMenos}
        aria-label="Retirar um"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-creme-300 text-lg font-semibold text-grafite-800 transition-colors hover:border-ambar-500 disabled:opacity-30"
        disabled={qtd === 0}
      >
        −
      </button>
      <span className="w-6 text-center font-display text-lg font-bold text-grafite-900">
        {qtd}
      </span>
      <button
        type="button"
        onClick={onMais}
        aria-label="Adicionar um"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-grafite-900 text-lg font-semibold text-creme-50 transition-colors hover:bg-grafite-700"
      >
        +
      </button>
    </div>
  )
}

function Cardapio() {
  const [fase, setFase] = useState('entrada') // entrada | menu | checkout | acompanhar
  const [nome, setNome] = useState('')
  const [mesa, setMesa] = useState('')
  const [sessao, setSessao] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [catAtiva, setCatAtiva] = useState('todas')
  const [subOrigem, setSubOrigem] = useState('todas') // sub-filtro de Petiscos
  const [carrinho, setCarrinho] = useState({}) // productId -> quantidade
  const [metodo, setMetodo] = useState(null)
  const [pedido, setPedido] = useState(null) // { id, numero, estado, total, itens }
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  const indisponivel = !supabase

  // Pré-carrega cardápio em fundo (como no original) para acelerar a entrada
  useEffect(() => {
    if (!supabase) return
    let ativo = true
    async function carregar() {
      const [rCat, rProd] = await Promise.all([
        supabase.from('categories').select('*').order('ordem'),
        supabase
          .from('products')
          .select('*, categories(id, nome)')
          .eq('disponivel', true)
          .order('ordem'),
      ])
      if (!ativo) return
      if (!rCat.error) setCategorias(rCat.data)
      if (!rProd.error) setProdutos(rProd.data)
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  // Realtime: acompanhar o estado do pedido submetido
  useEffect(() => {
    if (!supabase || !pedido?.id) return
    const canal = supabase
      .channel(`pedido-${pedido.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${pedido.id}` },
        (payload) => {
          setPedido((p) => (p ? { ...p, estado: payload.new.estado } : p))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [pedido?.id])

  function mostrarAviso(msg) {
    setAviso(msg)
    setTimeout(() => setAviso(''), 3500)
  }

  const totalCarrinho = useMemo(
    () =>
      Object.entries(carrinho).reduce((soma, [id, qtd]) => {
        const p = produtos.find((x) => String(x.id) === String(id))
        return soma + (p ? p.preco * qtd : 0)
      }, 0),
    [carrinho, produtos],
  )
  const contagemCarrinho = useMemo(
    () => Object.values(carrinho).reduce((a, b) => a + b, 0),
    [carrinho],
  )

  function alterarQtd(id, delta) {
    setCarrinho((c) => {
      const qtd = Math.max(0, (c[id] || 0) + delta)
      const novo = { ...c }
      if (qtd === 0) delete novo[id]
      else novo[id] = qtd
      return novo
    })
  }

  async function iniciarSessao(e) {
    e.preventDefault()
    if (!nome.trim() || ocupado) return
    setOcupado(true)
    try {
      const { data, error } = await comTimeout(
        supabase
          .from('sessions')
          .insert({ nome_cliente: nome.trim(), posicao_mesa: mesa.trim() || null })
          .select()
          .single(),
      )
      if (error) {
        mostrarAviso('Não foi possível iniciar. Tenta novamente.')
        return
      }
      setSessao(data)
      setFase('menu')
    } catch {
      mostrarAviso('A ligação está lenta. Tenta novamente.')
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarPedido() {
    if (!metodo || contagemCarrinho === 0 || ocupado) return
    setOcupado(true)
    try {
      const { data: order, error: erroPedido } = await comTimeout(
        supabase
          .from('orders')
          .insert({
            session_id: sessao.id,
            estado: 'recebido',
            metodo_pagamento: metodo,
            estado_pagamento: 'pendente',
            total: totalCarrinho,
          })
          .select()
          .single(),
      )

      if (erroPedido) {
        mostrarAviso('Erro ao criar o pedido. Tenta novamente.')
        return
      }

      const itens = Object.entries(carrinho).map(([id, qtd]) => {
        const p = produtos.find((x) => String(x.id) === String(id))
        return {
          order_id: order.id,
          product_id: p.id,
          quantidade: qtd,
          preco_unitario: p.preco,
        }
      })

      const { error: erroItens } = await comTimeout(
        supabase.from('order_items').insert(itens),
      )
      if (erroItens) {
        mostrarAviso('Erro ao registar os itens. Chama alguém da equipa.')
        return
      }

      aoConcluir(order, itens)
    } catch {
      mostrarAviso('A ligação está lenta. Tenta novamente.')
    } finally {
      setOcupado(false)
    }
  }

  function aoConcluir(order, itens) {
    setPedido({
      id: order.id,
      numero: order.numero,
      estado: order.estado,
      total: totalCarrinho,
      itens: itens.map((i) => ({
        ...i,
        nome: produtos.find((p) => p.id === i.product_id)?.nome,
      })),
    })
    setFase('acompanhar')
  }

  function novoPedido() {
    setCarrinho({})
    setMetodo(null)
    setPedido(null)
    setFase('menu')
  }

  const categoriaPetiscos = categorias.find((c) => c.nome === 'Petiscos')
  const emPetiscos =
    categoriaPetiscos && String(catAtiva) === String(categoriaPetiscos.id)

  const produtosFiltrados = produtos.filter((p) => {
    if (catAtiva !== 'todas' && String(p.category_id) !== String(catAtiva)) return false
    if (emPetiscos && subOrigem !== 'todas' && p.origem !== subOrigem) return false
    return true
  })

  const grupos = useMemo(() => {
    const g = new Map()
    produtosFiltrados.forEach((p) => {
      const chave = p.categories?.nome || 'Outros'
      if (!g.has(chave)) g.set(chave, [])
      g.get(chave).push(p)
    })
    return [...g.entries()]
  }, [produtosFiltrados])

  const indiceEstado = pedido
    ? ESTADOS_PEDIDO.findIndex((e) => e.id === pedido.estado)
    : -1

  return (
    <main className="bg-creme-50 text-grafite-800">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
          Cardápio
        </h1>

        {indisponivel && (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/60 p-8 text-center">
            <p className="text-lg text-grafite-600">
              Os pedidos não estão disponíveis de momento. Volta a tentar daqui a pouco.
            </p>
          </div>
        )}

        {!indisponivel && (
          <AnimatePresence mode="wait">
            {/* ── ENTRADA ── */}
            {fase === 'entrada' && (
              <motion.form
                key="entrada"
                variants={ecra}
                initial="hidden"
                animate="show"
                exit="exit"
                onSubmit={iniciarSessao}
                className="mt-10 rounded-2xl border border-creme-300 bg-white/70 p-8"
              >
                <p className="text-lg text-grafite-600">
                  Diz-nos quem és e faz o teu pedido daqui — nós avisamos quando estiver pronto.
                </p>
                <label className="mt-6 block">
                  <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                    Nome *
                  </span>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Como te chamamos?"
                    className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-lg text-grafite-900 outline-none focus:border-ambar-500"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                    Mesa / lugar (opcional)
                  </span>
                  <input
                    type="text"
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                    placeholder="Ex.: Mesa 3, balcão…"
                    className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-lg text-grafite-900 outline-none focus:border-ambar-500"
                  />
                </label>
                <BotaoPrimario type="submit" disabled={!nome.trim() || ocupado} className="mt-8 w-full">
                  {ocupado ? 'Um momento…' : 'Ver o cardápio'}
                </BotaoPrimario>
              </motion.form>
            )}

            {/* ── MENU ── */}
            {fase === 'menu' && (
              <motion.div key="menu" variants={ecra} initial="hidden" animate="show" exit="exit">
                <p className="mt-2 text-grafite-600">
                  Olá, <strong className="text-grafite-900">{sessao?.nome_cliente}</strong>
                  {sessao?.posicao_mesa ? ` · ${sessao.posicao_mesa}` : ''}
                </p>

                {/* Categorias */}
                <div className="sticky top-24 z-20 -mx-6 mt-6 flex gap-2 overflow-x-auto bg-creme-50/95 px-6 py-3 backdrop-blur">
                  {[{ id: 'todas', nome: 'Tudo' }, ...categorias].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCatAtiva(c.id)
                        setSubOrigem('todas')
                      }}
                      className={`shrink-0 cursor-pointer rounded-full border px-5 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors ${
                        String(catAtiva) === String(c.id)
                          ? 'border-grafite-900 bg-grafite-900 text-creme-50'
                          : 'border-creme-300 bg-white/60 text-grafite-600 hover:border-grafite-600'
                      }`}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>

                {/* Sub-filtro por origem, só dentro de Petiscos */}
                {emPetiscos && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {[
                      { id: 'todas', nome: 'Todos' },
                      { id: 'Portugues', nome: 'Portugueses' },
                      { id: 'Brasileiro', nome: 'Brasileiros' },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSubOrigem(o.id)}
                        className={`shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                          subOrigem === o.id
                            ? 'border-ambar-600 bg-ambar-500/20 text-grafite-900'
                            : 'border-creme-300 bg-white/60 text-grafite-600 hover:border-ambar-600'
                        }`}
                      >
                        {o.nome}
                      </button>
                    ))}
                  </div>
                )}

                {produtos.length === 0 && (
                  <div className="mt-8 rounded-2xl border border-creme-300 bg-white/60 p-8 text-center text-grafite-600">
                    O cardápio está a ser preparado — volta já de seguida.
                  </div>
                )}

                <div className="mt-6 space-y-10 pb-28">
                  {grupos.map(([nomeGrupo, itens]) => (
                    <section key={nomeGrupo}>
                      <h2 className="font-display text-2xl font-bold uppercase text-cobre-600">
                        {nomeGrupo}
                      </h2>
                      <div className="mt-4 space-y-4">
                        {itens.map((p) => (
                          <article
                            key={p.id}
                            className="overflow-hidden rounded-xl border border-creme-300 bg-white/70"
                          >
                            {p.imagem_url && (
                              <img
                                src={p.imagem_url}
                                alt={p.nome}
                                loading="lazy"
                                className="aspect-[16/9] w-full object-cover"
                              />
                            )}
                            <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-display text-lg font-bold uppercase text-grafite-900">
                                  {p.nome}
                                </h3>
                                {(p.estilo || p.abv != null) && (
                                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-ambar-600">
                                    {[p.estilo, p.abv != null ? `${Number(p.abv).toFixed(1)}% ABV` : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>
                                )}
                                {p.descricao && (
                                  <p className="mt-2 text-sm leading-relaxed text-grafite-600">
                                    {p.descricao}
                                  </p>
                                )}
                                {p.alergenios && (
                                  <p className="mt-2 text-xs uppercase tracking-widest text-grafite-600/70">
                                    Alergénios: {p.alergenios}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 font-display text-lg font-bold text-cobre-600">
                                {fmt(p.preco)}
                              </span>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <ControloQuantidade
                                qtd={carrinho[p.id] || 0}
                                onMais={() => alterarQtd(p.id, 1)}
                                onMenos={() => alterarQtd(p.id, -1)}
                              />
                            </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {/* Barra do carrinho */}
                <AnimatePresence>
                  {contagemCarrinho > 0 && (
                    <motion.div
                      initial={{ y: 80, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 80, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="fixed inset-x-0 bottom-0 z-30 border-t border-creme-300 bg-creme-50/95 px-6 py-4 backdrop-blur"
                    >
                      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
                        <span className="text-grafite-600">
                          {contagemCarrinho} {contagemCarrinho === 1 ? 'item' : 'itens'} ·{' '}
                          <strong className="text-grafite-900">{fmt(totalCarrinho)}</strong>
                        </span>
                        <BotaoPrimario onClick={() => setFase('checkout')}>
                          Rever pedido
                        </BotaoPrimario>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── CHECKOUT ── */}
            {fase === 'checkout' && (
              <motion.div key="checkout" variants={ecra} initial="hidden" animate="show" exit="exit">
                <button
                  type="button"
                  onClick={() => setFase('menu')}
                  className="mt-2 cursor-pointer text-sm font-semibold uppercase tracking-widest text-cobre-600 hover:text-cobre-500"
                >
                  ← Voltar ao cardápio
                </button>

                <div className="mt-6 rounded-2xl border border-creme-300 bg-white/70 p-6">
                  <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                    O teu pedido
                  </h2>
                  <ul className="mt-4 divide-y divide-creme-300">
                    {Object.entries(carrinho).map(([id, qtd]) => {
                      const p = produtos.find((x) => String(x.id) === String(id))
                      if (!p) return null
                      return (
                        <li key={id} className="flex items-center justify-between gap-4 py-3">
                          <div>
                            <p className="font-semibold text-grafite-900">{p.nome}</p>
                            <p className="text-sm text-grafite-600">{fmt(p.preco)} cada</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <ControloQuantidade
                              qtd={qtd}
                              onMais={() => alterarQtd(id, 1)}
                              onMenos={() => alterarQtd(id, -1)}
                            />
                            <span className="w-20 text-right font-display font-bold text-cobre-600">
                              {fmt(p.preco * qtd)}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-creme-300 pt-4">
                    <span className="font-display text-lg font-bold uppercase text-grafite-900">
                      Total
                    </span>
                    <span className="font-display text-xl font-bold text-cobre-600">
                      {fmt(totalCarrinho)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-creme-300 bg-white/70 p-6">
                  <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                    Pagamento
                  </h2>
                  <p className="mt-1 text-sm text-grafite-600">
                    Pagas quando o pedido for entregue — isto só nos diz como preferes.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {METODOS_PAGAMENTO.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodo(m.id)}
                        className={`min-h-12 cursor-pointer rounded-xl border px-4 py-3 font-semibold uppercase tracking-widest transition-colors ${
                          metodo === m.id
                            ? 'border-ambar-500 bg-ambar-500/15 text-grafite-900'
                            : 'border-creme-300 bg-creme-50 text-grafite-600 hover:border-grafite-600'
                        }`}
                      >
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                <BotaoPrimario
                  onClick={confirmarPedido}
                  disabled={!metodo || contagemCarrinho === 0 || ocupado}
                  className="mt-8 w-full"
                >
                  {ocupado ? 'A enviar…' : 'Confirmar pedido'}
                </BotaoPrimario>
              </motion.div>
            )}

            {/* ── ACOMPANHAR ── */}
            {fase === 'acompanhar' && pedido && (
              <motion.div key="acompanhar" variants={ecra} initial="hidden" animate="show" exit="exit">
                <div className="mt-8 rounded-2xl border border-creme-300 bg-white/70 p-8 text-center">
                  <p className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                    Pedido{pedido.numero ? ` nº ${pedido.numero}` : ''} recebido
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-bold uppercase text-grafite-900">
                    Obrigado, {sessao?.nome_cliente}!
                  </h2>

                  {/* Stepper de estado */}
                  <ol className="mx-auto mt-8 max-w-md space-y-0" aria-label="Estado do pedido">
                    {ESTADOS_PEDIDO.map((e, i) => {
                      const feito = i < indiceEstado
                      const atual = i === indiceEstado
                      return (
                        <li key={e.id} className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-colors duration-500 ${
                                feito
                                  ? 'border-cobre-600 bg-cobre-600 text-creme-50'
                                  : atual
                                    ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                                    : 'border-creme-300 bg-creme-50 text-grafite-600/50'
                              }`}
                            >
                              {feito ? '✓' : i + 1}
                            </span>
                            {i < ESTADOS_PEDIDO.length - 1 && (
                              <span
                                className={`h-8 w-0.5 ${feito ? 'bg-cobre-600' : 'bg-creme-300'}`}
                              />
                            )}
                          </div>
                          <span
                            className={`pt-1.5 font-semibold uppercase tracking-widest ${
                              atual
                                ? 'text-grafite-900'
                                : feito
                                  ? 'text-cobre-600'
                                  : 'text-grafite-600/50'
                            }`}
                          >
                            {e.rotulo}
                            {atual && e.id === 'pronto' && ' — vem buscar!'}
                          </span>
                        </li>
                      )
                    })}
                  </ol>

                  <ul className="mx-auto mt-8 max-w-md divide-y divide-creme-300 border-t border-creme-300 text-left">
                    {pedido.itens.map((i) => (
                      <li key={i.product_id} className="flex justify-between py-2 text-grafite-600">
                        <span>
                          {i.quantidade}× {i.nome}
                        </span>
                        <span>{fmt(i.preco_unitario * i.quantidade)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between py-3 font-display font-bold text-grafite-900">
                      <span>Total</span>
                      <span>{fmt(pedido.total)}</span>
                    </li>
                  </ul>

                  {pedido.estado === 'entregue' && (
                    <BotaoPrimario onClick={novoPedido} className="mt-8">
                      Fazer novo pedido
                    </BotaoPrimario>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Aviso/toast */}
        <AnimatePresence>
          {aviso && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-grafite-900 px-6 py-3 text-sm text-creme-50 shadow-lg"
            >
              {aviso}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

export default Cardapio
