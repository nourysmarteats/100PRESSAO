// PDV (Ponto de Venda) — dashboard do operador de caixa.
// Standalone: tem o seu próprio ecrã de login + PIN, sem depender do EquipaLayout.
// Dois painéis:
//   Esquerda — pedidos activos do sistema (realtime via Supabase)
//   Direita  — venda manual (picker de produtos + carrinho)
// O carrinho é transmitido em tempo real ao /visor via Supabase Broadcast.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabasePublico } from '../lib/supabase'
import {
  fmt,
  METODOS_PAGAMENTO,
  obterPedidosAtivos,
  nomeItemPedido,
  exigeFatura,
  beep,
} from '../lib/pedidos'
import { chamarApiFaturar } from '../lib/equipa'
import logoStamp from '../assets/logo-100pressao.png'

// ----------------------------
// Configuração do PIN
// ----------------------------
const CAIXA_KEY = 'pdv_pin_ok'
const PIN_PADRAO = import.meta.env.VITE_CAIXA_PIN || '1707'

// ----------------------------
// Utilitários de estilo
// ----------------------------
const BTN =
  'cursor-pointer rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-widest transition-colors disabled:opacity-40'
const BTN_PRIMARIO = `${BTN} bg-ambar-500 text-grafite-950 hover:bg-ambar-400`
const BTN_SECUNDARIO = `${BTN} border border-grafite-600 text-creme-300 hover:border-creme-300`
const BTN_PERIGO = `${BTN} border border-red-500/50 text-red-400 hover:border-red-400`

// ----------------------------
// Relógio
// ----------------------------
function Relogio() {
  const [hora, setHora] = useState('')
  useEffect(() => {
    const tick = () =>
      setHora(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-display text-xl font-bold text-creme-300">{hora}</span>
}

// ----------------------------
// Ecrã de login (sem EquipaLayout)
// ----------------------------
function Login({ aoEntrar }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    setOcupado(false)
    if (error) {
      setErro('Credenciais inválidas.')
    } else {
      aoEntrar()
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-grafite-950 px-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-grafite-700 bg-grafite-900 p-8"
      >
        <img src={logoStamp} alt="100PRESSÃO" className="mx-auto h-20 w-20 rounded-full mix-blend-lighten" />
        <h1 className="mt-4 text-center font-display text-lg font-bold uppercase tracking-tight text-creme-50">
          PDV — Acesso
        </h1>
        <label className="mt-6 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-grafite-600 bg-grafite-800 px-4 py-3 text-creme-50 outline-none focus:border-ambar-500"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-500">Password</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-grafite-600 bg-grafite-800 px-4 py-3 text-creme-50 outline-none focus:border-ambar-500"
          />
        </label>
        <p className="mt-3 h-5 text-sm text-red-400" role="alert">{erro}</p>
        <button type="submit" disabled={ocupado} className={`mt-4 w-full ${BTN_PRIMARIO}`}>
          {ocupado ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ----------------------------
// Gate de PIN
// ----------------------------
function PinGate({ aoDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)

  function verificar(valor) {
    setPin(valor)
    setErro(false)
    if (valor.length < 4) return
    if (valor === PIN_PADRAO) {
      sessionStorage.setItem(CAIXA_KEY, 'sim')
      aoDesbloquear()
    } else {
      setErro(true)
      setTimeout(() => setPin(''), 600)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-grafite-950">
      <img src={logoStamp} alt="100PRESSÃO" className="h-24 w-24 rounded-full mix-blend-lighten" />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-creme-500/60">
        PIN do PDV
      </p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => verificar(e.target.value.replace(/\D/g, ''))}
        autoFocus
        aria-label="PIN"
        className={`w-40 rounded-xl border bg-grafite-800 px-4 py-4 text-center font-display text-3xl tracking-[0.5em] text-creme-50 outline-none transition-colors focus:border-ambar-500 ${erro ? 'border-red-500' : 'border-grafite-600'}`}
      />
      <p className="h-5 text-sm text-red-400" role="alert">
        {erro ? 'PIN incorreto' : ''}
      </p>
    </div>
  )
}

// ----------------------------
// Painel de pedidos activos
// ----------------------------
function PainelPedidos({ onFaturar }) {
  const [pedidos, setPedidos] = useState([])
  const [aProcessar, setAProcessar] = useState(null)
  const [aviso, setAviso] = useState('')
  const pedidosRef = useRef([])
  pedidosRef.current = pedidos

  const carregar = useCallback(async () => {
    const r = await obterPedidosAtivos(supabase)
    if (!r.error) setPedidos(r.data)
  }, [])

  useEffect(() => {
    carregar()
    if (!supabase) return
    const canal = supabase
      .channel('pdv-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        beep([660, 880])
        carregar()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  async function receberPagamento(pedido, metodo) {
    setAProcessar(pedido.id)
    setAviso('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          metodo_pagamento: metodo,
          estado_pagamento: 'pago',
          estado: 'entregue',
        })
        .eq('id', pedido.id)
      if (error) throw new Error(error.message)

      if (exigeFatura(metodo)) {
        try {
          const r = await chamarApiFaturar({ pedido_id: pedido.id })
          setAviso(`✓ Pago · Fatura ${r.numero || ''} emitida`)
        } catch (eFatura) {
          setAviso(`✓ Pago · Fatura falhou: ${eFatura.message}`)
        }
      } else {
        setAviso('✓ Pago · Sem fatura (dinheiro)')
      }
      onFaturar?.()
      carregar()
    } catch (e) {
      setAviso(`Erro: ${e.message}`)
    }
    setAProcessar(null)
    setTimeout(() => setAviso(''), 5000)
  }

  if (!supabase) {
    return (
      <p className="p-6 text-creme-500/60 text-sm">
        Sistema indisponível — configuração Supabase em falta.
      </p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ambar-500">
        Pedidos activos
      </h2>
      {aviso && (
        <p className="mb-3 rounded-xl border border-ambar-500/30 bg-ambar-500/10 px-4 py-2 text-sm text-ambar-400">
          {aviso}
        </p>
      )}
      {pedidos.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-creme-500/40 text-sm uppercase tracking-widest">
          Sem pedidos pendentes
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-3 pr-1">
          {pedidos.map((p) => {
            const total = Number(p.total || 0)
            const ocupa = aProcessar === p.id
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-grafite-700 bg-grafite-900 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-bold text-ambar-500">
                    nº {p.numero}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-creme-500/60">
                    {p.sessions?.posicao_mesa || p.sessions?.nome_cliente || 'Balcão'}
                  </span>
                </div>

                {p.order_items?.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t border-grafite-700 pt-2">
                    {p.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between text-sm text-creme-300">
                        <span>
                          {item.quantidade}× {nomeItemPedido(item)}
                        </span>
                        <span className="text-creme-500/60">{fmt(item.preco_unitario * item.quantidade)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-2xl font-bold text-creme-50">
                    {fmt(total)}
                  </span>
                  {!ocupa && (
                    <div className="flex gap-2 flex-wrap justify-end">
                      {METODOS_PAGAMENTO.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!!aProcessar}
                          onClick={() => receberPagamento(p, m.id)}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-40 ${
                            m.id === 'dinheiro'
                              ? 'border-creme-500/40 text-creme-400 hover:border-ambar-500 hover:text-ambar-400'
                              : 'border-ambar-500/60 text-ambar-400 hover:border-ambar-400 hover:bg-ambar-500/10'
                          }`}
                        >
                          {m.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                  {ocupa && (
                    <span className="text-xs font-semibold uppercase tracking-widest text-ambar-500/60">
                      A processar…
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ----------------------------
// Painel de venda manual
// ----------------------------
function PainelVendaManual() {
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [catAtiva, setCatAtiva] = useState(null)
  const [carrinho, setCarrinho] = useState({}) // { product_id: { nome, preco, quantidade } }
  const [metodo, setMetodo] = useState('dinheiro')
  const [pedirNif, setPedirNif] = useState(false)
  const [nif, setNif] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const canalVisorRef = useRef(null)
  const db = supabasePublico || supabase

  // Carregar categorias e produtos
  useEffect(() => {
    if (!db) return
    async function carregar() {
      const [rCat, rProd] = await Promise.all([
        db.from('categories').select('id, nome, visivel').order('ordem'),
        db.from('products').select('id, nome, preco, category_id, visivel, disponivel').order('nome'),
      ])
      const cats = (rCat.data || []).filter((c) => c.visivel !== false)
      const prods = (rProd.data || []).filter((p) => p.visivel !== false && p.disponivel !== false)
      setCategorias(cats)
      setProdutos(prods)
      if (cats.length > 0) setCatAtiva(cats[0].id)
    }
    carregar()
  }, [db])

  // Canal de broadcast para o visor
  useEffect(() => {
    const sb = supabasePublico || supabase
    if (!sb) return
    const canal = sb.channel('pdv-visor')
    canal.subscribe()
    canalVisorRef.current = canal
    return () => sb.removeChannel(canal)
  }, [])

  // Broadcast do carrinho sempre que muda
  useEffect(() => {
    const canal = canalVisorRef.current
    if (!canal) return
    const itens = Object.values(carrinho)
    canal.send({
      type: 'broadcast',
      event: 'carrinho',
      payload: {
        itens,
        total: itens.reduce((s, i) => s + i.preco * i.quantidade, 0),
      },
    })
  }, [carrinho])

  function adicionar(produto) {
    setCarrinho((prev) => {
      const atual = prev[produto.id] || { nome: produto.nome, preco: Number(produto.preco || 0), product_id: produto.id, quantidade: 0 }
      return { ...prev, [produto.id]: { ...atual, quantidade: atual.quantidade + 1 } }
    })
  }

  function remover(produtoId) {
    setCarrinho((prev) => {
      const atual = prev[produtoId]
      if (!atual || atual.quantidade <= 1) {
        const { [produtoId]: _, ...resto } = prev
        return resto
      }
      return { ...prev, [produtoId]: { ...atual, quantidade: atual.quantidade - 1 } }
    })
  }

  function limparCarrinho() {
    setCarrinho({})
    setNif('')
    setPedirNif(false)
  }

  const itensCarrinho = Object.values(carrinho)
  const totalCarrinho = itensCarrinho.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const temItens = itensCarrinho.length > 0
  const precisaFatura = exigeFatura(metodo)

  async function concluirVenda() {
    if (!temItens) return
    setOcupado(true)
    setAviso('')
    try {
      const sb = supabasePublico || supabase

      // 1. Criar sessão de balcão
      const { data: sessao, error: errSessao } = await sb.rpc('criar_sessao', {
        p_nome: 'Balcão',
        p_mesa: 'PDV',
      })
      if (errSessao) throw new Error(`Sessão: ${errSessao.message}`)

      const sessionId = Array.isArray(sessao) ? sessao[0]?.id : sessao?.id
      if (!sessionId) throw new Error('Não foi possível criar sessão de balcão.')

      // 2. Criar pedido
      const itensRpc = itensCarrinho.map((i) => ({
        product_id: i.product_id,
        variant_id: null,
        combo_id: null,
        quantidade: i.quantidade,
      }))
      const { data: order, error: errOrder } = await sb.rpc('criar_pedido', {
        p_session_id: sessionId,
        p_metodo: metodo,
        p_itens: itensRpc,
      })
      if (errOrder) throw new Error(`Pedido: ${errOrder.message}`)

      const orderId = Array.isArray(order) ? order[0]?.id : order?.id
      if (!orderId) throw new Error('Pedido criado sem ID.')

      // 3. Marcar como pago + entregue imediatamente
      const authSb = supabase // usar cliente autenticado para update
      if (authSb) {
        await authSb.from('orders').update({
          estado_pagamento: 'pago',
          estado: 'entregue',
          metodo_pagamento: metodo,
        }).eq('id', orderId)
      }

      // 4. Emitir fatura se necessário
      if (precisaFatura || (metodo === 'dinheiro' && nif)) {
        try {
          const r = await chamarApiFaturar({ pedido_id: orderId, nif: nif || undefined })
          setAviso(`✓ Venda concluída · Fatura ${r.numero || ''} emitida`)
        } catch (eFatura) {
          setAviso(`✓ Venda concluída · Fatura falhou: ${eFatura.message}`)
        }
      } else {
        setAviso('✓ Venda concluída')
      }

      // 5. Broadcast "venda_concluida" para o visor
      canalVisorRef.current?.send({ type: 'broadcast', event: 'venda_concluida', payload: {} })
      limparCarrinho()
    } catch (e) {
      setAviso(`Erro: ${e.message}`)
    }
    setOcupado(false)
    setTimeout(() => setAviso(''), 6000)
  }

  const produtosDaCat = produtos.filter((p) => String(p.category_id) === String(catAtiva))

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ambar-500">
        Venda manual
      </h2>

      {/* Tabs de categorias */}
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatAtiva(c.id)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
              catAtiva === c.id
                ? 'bg-ambar-500 text-grafite-950'
                : 'border border-grafite-600 text-creme-400 hover:border-creme-300'
            }`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      {/* Grelha de produtos */}
      <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {produtosDaCat.map((p) => {
          const qtd = carrinho[p.id]?.quantidade || 0
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => adicionar(p)}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors ${
                qtd > 0
                  ? 'border-ambar-500/60 bg-ambar-500/10 text-creme-50'
                  : 'border-grafite-600 text-creme-400 hover:border-creme-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold leading-tight">{p.nome}</span>
                {qtd > 0 && (
                  <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ambar-500 font-display text-sm font-bold text-grafite-950">
                    {qtd}
                  </span>
                )}
              </div>
              <span className="mt-0.5 block text-xs text-creme-500/60">{fmt(p.preco)}</span>
            </button>
          )
        })}
        {produtosDaCat.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-creme-500/40">
            Sem produtos nesta categoria
          </p>
        )}
      </div>

      {/* Carrinho */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-grafite-700 bg-grafite-900 p-4">
        {itensCarrinho.length === 0 ? (
          <p className="text-center text-sm text-creme-500/40">Carrinho vazio</p>
        ) : (
          <ul className="space-y-2">
            {itensCarrinho.map((item) => (
              <li key={item.product_id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-creme-300">
                  {item.quantidade}× {item.nome}
                </span>
                <span className="font-display text-sm font-bold text-creme-50">
                  {fmt(item.preco * item.quantidade)}
                </span>
                <button
                  type="button"
                  onClick={() => remover(item.product_id)}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-grafite-600 text-xs text-creme-500 hover:border-red-400 hover:text-red-400"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => adicionar({ id: item.product_id, nome: item.nome, preco: item.preco })}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-grafite-600 text-xs text-creme-500 hover:border-ambar-400 hover:text-ambar-400"
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Total + método + conclusão */}
      {temItens && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-widest text-creme-500/60">
              Total
            </span>
            <span className="font-display text-3xl font-bold text-ambar-400">
              {fmt(totalCarrinho)}
            </span>
          </div>

          {/* Método de pagamento */}
          <div className="flex gap-2 flex-wrap">
            {METODOS_PAGAMENTO.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetodo(m.id)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  metodo === m.id
                    ? 'bg-ambar-500 text-grafite-950'
                    : 'border border-grafite-600 text-creme-400 hover:border-creme-300'
                }`}
              >
                {m.rotulo}
              </button>
            ))}
          </div>

          {/* NIF (só para dinheiro, opcional) */}
          {metodo === 'dinheiro' && (
            <div>
              {!pedirNif ? (
                <button
                  type="button"
                  onClick={() => setPedirNif(true)}
                  className="text-xs font-semibold uppercase tracking-widest text-creme-500/50 hover:text-creme-300 cursor-pointer"
                >
                  + Emitir fatura com NIF
                </button>
              ) : (
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="NIF (opcional)"
                  autoFocus
                  className="w-full rounded-xl border border-grafite-600 bg-grafite-800 px-3 py-2 text-sm text-creme-50 outline-none focus:border-ambar-500"
                />
              )}
            </div>
          )}

          {aviso && (
            <p className="rounded-xl border border-ambar-500/30 bg-ambar-500/10 px-3 py-2 text-sm text-ambar-400">
              {aviso}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={limparCarrinho}
              className={`${BTN_PERIGO} flex-1 text-xs`}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={concluirVenda}
              disabled={ocupado || !temItens}
              className={`${BTN_PRIMARIO} flex-1`}
            >
              {ocupado ? 'A processar…' : 'Concluir venda'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------
// PDV principal
// ----------------------------
function Pdv({ aoBloquear }) {
  return (
    <div className="flex min-h-dvh flex-col bg-grafite-950">
      {/* Barra de topo */}
      <header className="flex items-center justify-between border-b border-grafite-700 px-6 py-3">
        <div className="flex items-center gap-3">
          <img src={logoStamp} alt="" className="h-9 w-9 rounded-full mix-blend-lighten" />
          <span className="font-display text-base font-bold uppercase tracking-tight text-creme-50">
            100PRESSÃO PDV
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Relogio />
          <Link
            to="/visor"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-full border border-grafite-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-creme-400 hover:border-creme-300 transition-colors"
          >
            Visor
          </Link>
          <button
            type="button"
            onClick={aoBloquear}
            className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-creme-500/50 hover:text-creme-300 transition-colors"
          >
            Bloquear
          </button>
        </div>
      </header>

      {/* Dois painéis */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Painel esquerdo — pedidos activos */}
        <div className="flex-1 overflow-y-auto border-r border-grafite-700 p-5">
          <PainelPedidos />
        </div>

        {/* Painel direito — venda manual */}
        <div className="w-96 shrink-0 overflow-y-auto p-5">
          <PainelVendaManual />
        </div>
      </div>
    </div>
  )
}

// ----------------------------
// Componente raiz — orquestra estados
// ----------------------------
function CaixaPdv() {
  // null = a verificar, false = sem auth, true = com auth
  const [autenticado, setAutenticado] = useState(null)
  const [desbloqueado, setDesbloqueado] = useState(
    () => sessionStorage.getItem(CAIXA_KEY) === 'sim',
  )

  useEffect(() => {
    if (!supabase) {
      setAutenticado(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setAutenticado(!!data?.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setAutenticado(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function bloquear() {
    sessionStorage.removeItem(CAIXA_KEY)
    setDesbloqueado(false)
  }

  // A carregar
  if (autenticado === null) {
    return <div className="min-h-dvh bg-grafite-950" />
  }

  // Sem Supabase ou sem auth → login
  if (!supabase || !autenticado) {
    return <Login aoEntrar={() => setAutenticado(true)} />
  }

  // Autenticado mas bloqueado → PIN
  if (!desbloqueado) {
    return <PinGate aoDesbloquear={() => setDesbloqueado(true)} />
  }

  // Tudo ok → PDV
  return <Pdv aoBloquear={bloquear} />
}

export default CaixaPdv
