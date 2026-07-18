import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import SEOHead from '../components/SEOHead'
import { SEO_PAGES } from '../seo/pages'

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

const LUGARES = [
  { rotulo: 'Mesa', opcoes: Array.from({ length: 6 }, (_, i) => `Mesa ${i + 1}`) },
  { rotulo: 'Salão', opcoes: Array.from({ length: 8 }, (_, i) => `Salão ${i + 1}`) },
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
  const [combos, setCombos] = useState([])
  const [variantes, setVariantes] = useState({}) // product_id -> [variantes]
  const [banner, setBanner] = useState('')
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
      // Combos e variantes podem ainda não existir no schema (migração v2)
      // — cada consulta falha isolada sem afetar o resto do cardápio
      const [rCat, rProd, rCombos, rVar] = await Promise.all([
        supabase.from('categories').select('*').order('ordem'),
        supabase
          .from('products')
          .select('*, categories(id, nome)')
          .eq('disponivel', true)
          .order('ordem'),
        supabase
          .from('combos')
          .select('*, combo_items(quantidade, products(nome))')
          .eq('disponivel', true)
          .order('ordem'),
        supabase
          .from('product_variants')
          .select('*')
          .eq('disponivel', true)
          .order('ordem'),
      ])
      if (!ativo) return
      // Categorias ocultas (visivel=false) saem do cardápio, junto com os
      // seus produtos; visivel !== false tolera a coluna ainda não existir
      const ocultas = new Set(
        (rCat.data || []).filter((c) => c.visivel === false).map((c) => c.id),
      )
      if (!rCat.error) setCategorias(rCat.data.filter((c) => !ocultas.has(c.id)))
      if (!rProd.error) setProdutos(rProd.data.filter((p) => !ocultas.has(p.category_id)))
      if (!rCombos.error) setCombos(rCombos.data.filter((c) => !ocultas.has(c.category_id)))
      if (!rVar.error) {
        const porProduto = {}
        rVar.data.forEach((v) => {
          ;(porProduto[v.product_id] = porProduto[v.product_id] || []).push(v)
        })
        setVariantes(porProduto)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  // Aviso operacional (item 6 da v2): faixa configurável no admin, com
  // atualização em tempo real — sem reload manual
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('definicoes')
      .select('valor')
      .eq('chave', 'banner')
      .single()
      .then(({ data, error }) => {
        if (!error && typeof data?.valor === 'string') setBanner(data.valor)
      })
    const canal = supabase
      .channel('definicoes-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'definicoes', filter: 'chave=eq.banner' },
        (payload) =>
          setBanner(typeof payload.new?.valor === 'string' ? payload.new.valor : ''),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
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

  // Chaves do carrinho: "p:<id>" (produto), "p:<id>:v:<id>" (variante),
  // "c:<id>" (combo) — resolve para nome/preço/refs num só sítio
  const resolverChave = useCallback(
    (chave) => {
      const partes = chave.split(':')
      if (partes[0] === 'c') {
        const combo = combos.find((c) => String(c.id) === partes[1])
        return combo ? { nome: `Combo ${combo.nome}`, preco: combo.preco, combo } : null
      }
      const p = produtos.find((x) => String(x.id) === partes[1])
      if (!p) return null
      const v =
        partes[2] === 'v'
          ? (variantes[p.id] || []).find((x) => String(x.id) === partes[3])
          : null
      if (partes[2] === 'v' && !v) return null
      return {
        nome: v ? `${p.nome} ${v.nome}` : p.nome,
        preco: v ? v.preco : p.preco,
        produto: p,
        variante: v,
      }
    },
    [produtos, combos, variantes],
  )

  const totalCarrinho = useMemo(
    () =>
      Object.entries(carrinho).reduce((soma, [chave, qtd]) => {
        const r = resolverChave(chave)
        return soma + (r ? r.preco * qtd : 0)
      }, 0),
    [carrinho, resolverChave],
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
          .insert({ nome_cliente: nome.trim(), posicao_mesa: mesa })
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

      // Combos entram como linha própria (combo_id); variantes levam
      // variant_id. As colunas novas só vão no insert quando usadas, para
      // o fluxo antigo continuar a funcionar antes da migração v2.
      const entradas = Object.entries(carrinho)
        .map(([chave, qtd]) => ({ r: resolverChave(chave), qtd }))
        .filter((e) => e.r)
      const itens = entradas.map(({ r, qtd }) => {
        const item = {
          order_id: order.id,
          product_id: r.produto?.id ?? null,
          quantidade: qtd,
          preco_unitario: r.preco,
        }
        if (r.variante) item.variant_id = r.variante.id
        if (r.combo) item.combo_id = r.combo.id
        return item
      })

      const { error: erroItens } = await comTimeout(
        supabase.from('order_items').insert(itens),
      )
      if (erroItens) {
        mostrarAviso('Erro ao registar os itens. Chama alguém da equipa.')
        return
      }

      aoConcluir(order, entradas)
    } catch {
      mostrarAviso('A ligação está lenta. Tenta novamente.')
    } finally {
      setOcupado(false)
    }
  }

  function aoConcluir(order, entradas) {
    setPedido({
      id: order.id,
      numero: order.numero,
      estado: order.estado,
      total: totalCarrinho,
      itens: entradas.map(({ r, qtd }) => ({
        nome: r.nome,
        quantidade: qtd,
        preco_unitario: r.preco,
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

  // Combos filtram pela categoria ativa; sem categoria ficam na secção
  // própria "Combos" (visível só em "Tudo")
  const combosFiltrados = combos.filter(
    (c) => catAtiva === 'todas' || String(c.category_id) === String(catAtiva),
  )

  const grupos = useMemo(() => {
    const g = new Map()
    const grupo = (chave) => {
      if (!g.has(chave)) g.set(chave, { produtos: [], combos: [] })
      return g.get(chave)
    }
    combosFiltrados.forEach((c) => {
      const nomeCat = categorias.find((x) => String(x.id) === String(c.category_id))?.nome
      grupo(nomeCat || 'Combos').combos.push(c)
    })
    produtosFiltrados.forEach((p) => {
      grupo(p.categories?.nome || 'Outros').produtos.push(p)
    })
    return [...g.entries()]
  }, [produtosFiltrados, combosFiltrados, categorias])

  const indiceEstado = pedido
    ? ESTADOS_PEDIDO.findIndex((e) => e.id === pedido.estado)
    : -1

  return (
    <main className="bg-creme-50 text-grafite-800">
      {/* Manifest próprio (scope/start_url = /cardapio) — permite "Adicionar
          ao ecrã principal" instalar só o cardápio como app isolada, sem
          ser preciso empacotar o site inteiro numa PWA separada. */}
      <SEOHead {...SEO_PAGES.cardapio} manifest="/cardapio.webmanifest" />
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
          Ementa
        </h1>

        {/* Aviso operacional configurado no admin (tempo real) */}
        {banner && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-ambar-500/50 bg-ambar-500/15 px-4 py-3 font-semibold text-grafite-900"
          >
            {banner}
          </div>
        )}

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
                  Diz-nos quem és e faz o teu pedido daqui. Nós avisamos quando estiver pronto.
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
                    Mesa / lugar
                  </span>
                  <select
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-lg text-grafite-900 outline-none focus:border-ambar-500"
                  >
                    <option value="" disabled>
                      Escolhe a mesa ou o salão
                    </option>
                    {LUGARES.map((grupo) => (
                      <optgroup key={grupo.rotulo} label={grupo.rotulo}>
                        {grupo.opcoes.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <BotaoPrimario type="submit" disabled={!nome.trim() || !mesa || ocupado} className="mt-8 w-full">
                  {ocupado ? 'Um momento…' : 'Ver a ementa'}
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

                {produtos.length === 0 && combos.length === 0 && (
                  <div className="mt-8 rounded-2xl border border-creme-300 bg-white/60 p-8 text-center text-grafite-600">
                    A ementa está a ser preparada. Volta já de seguida.
                  </div>
                )}

                <div className="mt-6 space-y-10 pb-28">
                  {grupos.map(([nomeGrupo, grupo]) => (
                    <section key={nomeGrupo}>
                      <h2 className="font-display text-2xl font-bold uppercase text-cobre-600">
                        {nomeGrupo}
                      </h2>
                      <div className="mt-4 space-y-4">
                        {/* Combos primeiro: conjunto a preço fixo */}
                        {grupo.combos.map((c) => (
                          <article
                            key={`combo-${c.id}`}
                            className="overflow-hidden rounded-xl border-2 border-ambar-500/50 bg-white/70"
                          >
                            {c.imagem_url && (
                              <img
                                src={c.imagem_url}
                                alt={c.nome}
                                loading="lazy"
                                className="aspect-[16/9] w-full object-cover"
                              />
                            )}
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <span className="rounded-full bg-ambar-500/20 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-cobre-600">
                                    Combo
                                  </span>
                                  <h3 className="mt-1.5 font-display text-lg font-bold uppercase text-grafite-900">
                                    {c.nome}
                                  </h3>
                                  {c.descricao && (
                                    <p className="mt-2 text-sm leading-relaxed text-grafite-600">
                                      {c.descricao}
                                    </p>
                                  )}
                                  <p className="mt-2 text-xs uppercase tracking-widest text-grafite-600/70">
                                    {c.combo_items
                                      ?.map((i) => `${i.quantidade}× ${i.products?.nome || '?'}`)
                                      .join(' + ')}
                                  </p>
                                </div>
                                <span className="shrink-0 font-display text-lg font-bold text-cobre-600">
                                  {fmt(c.preco)}
                                </span>
                              </div>
                              <div className="mt-4 flex justify-end">
                                <ControloQuantidade
                                  qtd={carrinho[`c:${c.id}`] || 0}
                                  onMais={() => alterarQtd(`c:${c.id}`, 1)}
                                  onMenos={() => alterarQtd(`c:${c.id}`, -1)}
                                />
                              </div>
                            </div>
                          </article>
                        ))}

                        {grupo.produtos.map((p) => (
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
                                {variantes[p.id]?.length
                                  ? `desde ${fmt(Math.min(...variantes[p.id].map((v) => Number(v.preco))))}`
                                  : fmt(p.preco)}
                              </span>
                            </div>
                            {variantes[p.id]?.length ? (
                              /* Variantes de tamanho: uma linha por opção */
                              <ul className="mt-4 space-y-2 border-t border-creme-300 pt-3">
                                {variantes[p.id].map((v) => (
                                  <li
                                    key={v.id}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="text-sm text-grafite-800">
                                      {v.nome} ·{' '}
                                      <strong className="text-cobre-600">{fmt(v.preco)}</strong>
                                    </span>
                                    <ControloQuantidade
                                      qtd={carrinho[`p:${p.id}:v:${v.id}`] || 0}
                                      onMais={() => alterarQtd(`p:${p.id}:v:${v.id}`, 1)}
                                      onMenos={() => alterarQtd(`p:${p.id}:v:${v.id}`, -1)}
                                    />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-4 flex justify-end">
                                <ControloQuantidade
                                  qtd={carrinho[`p:${p.id}`] || 0}
                                  onMais={() => alterarQtd(`p:${p.id}`, 1)}
                                  onMenos={() => alterarQtd(`p:${p.id}`, -1)}
                                />
                              </div>
                            )}
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
                  ← Voltar à ementa
                </button>

                <div className="mt-6 rounded-2xl border border-creme-300 bg-white/70 p-6">
                  <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                    O teu pedido
                  </h2>
                  <ul className="mt-4 divide-y divide-creme-300">
                    {Object.entries(carrinho).map(([chave, qtd]) => {
                      const r = resolverChave(chave)
                      if (!r) return null
                      return (
                        <li key={chave} className="flex items-center justify-between gap-4 py-3">
                          <div>
                            <p className="font-semibold text-grafite-900">{r.nome}</p>
                            <p className="text-sm text-grafite-600">{fmt(r.preco)} cada</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <ControloQuantidade
                              qtd={qtd}
                              onMais={() => alterarQtd(chave, 1)}
                              onMenos={() => alterarQtd(chave, -1)}
                            />
                            <span className="w-20 text-right font-display font-bold text-cobre-600">
                              {fmt(r.preco * qtd)}
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
                    Pagas quando o pedido for entregue. Isto só nos diz como preferes.
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
                            {atual && e.id === 'pronto' && ': vem buscar!'}
                          </span>
                        </li>
                      )
                    })}
                  </ol>

                  <ul className="mx-auto mt-8 max-w-md divide-y divide-creme-300 border-t border-creme-300 text-left">
                    {pedido.itens.map((i) => (
                      <li key={i.nome} className="flex justify-between py-2 text-grafite-600">
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
