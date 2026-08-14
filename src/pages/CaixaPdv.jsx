// PDV (Ponto de Venda) — dashboard do operador de caixa.
// Standalone: tem o seu próprio ecrã de login + PIN, sem depender do EquipaLayout.
// Dois painéis:
//   Esquerda — pedidos activos do sistema (realtime via Supabase)
//   Direita  — venda manual (picker de produtos + carrinho)
// AMBOS os painéis escrevem no /visor através do canal partilhado em
// lib/visor.js. Antes só a venda manual o fazia, o que deixava o cliente que
// pediu pelo menu QR a olhar para um ecrã de boas-vindas enquanto pagava.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useCanalVisor, linhaVisor, totalLinhas } from '../lib/visor'
import { chamarApiFaturar, definirOperador, definirTurno, turnoDesbloqueadoPor } from '../lib/equipa'
import logoStamp from '../assets/logo-100pressao.png'

// ----------------------------
// Configuração do PIN
// ----------------------------
// PIN partilhado de arranque, igual ao do EquipaLayout: só vale enquanto não
// houver PINs pessoais configurados. Assim que houver, cada conta entra com o
// seu, verificado no servidor.
const PIN_PARTILHADO = '1707'

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
// Pagamento em dinheiro — valor recebido e troco
// ----------------------------
// Notas e moedas mais usadas ao balcão. Poupam ao operador escrever o valor
// à mão, que é onde os enganos acontecem com fila à espera.
const NOTAS = [5, 10, 20, 50]

function PagamentoDinheiro({
  total,
  recebido,
  aoMudarRecebido,
  aoConfirmar,
  aoCancelar,
  rotuloCancelar = 'Voltar',
  ocupado,
}) {
  const valor = Number(String(recebido).replace(',', '.')) || 0
  const troco = valor - total
  const suficiente = valor >= total && valor > 0

  // Sugere a nota imediatamente acima do total, mais as seguintes.
  const sugestoes = useMemo(() => {
    const arredondado = Math.ceil(total)
    const lista = [arredondado, ...NOTAS.filter((n) => n > total)]
    return [...new Set(lista)].slice(0, 4)
  }, [total])

  return (
    <div className="space-y-3 rounded-2xl border border-grafite-700 bg-grafite-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-creme-500/60">
          Valor recebido
        </span>
        <span className="font-display text-sm font-bold text-creme-500/60">A pagar {fmt(total)}</span>
      </div>

      <input
        type="text"
        inputMode="decimal"
        value={recebido}
        onChange={(e) => aoMudarRecebido(e.target.value.replace(/[^\d.,]/g, ''))}
        placeholder="0,00"
        autoFocus
        aria-label="Valor recebido em dinheiro"
        className="w-full rounded-xl border border-grafite-600 bg-grafite-800 px-4 py-3 text-center font-display text-3xl font-bold text-creme-50 outline-none focus:border-ambar-500"
      />

      <div className="flex flex-wrap gap-2">
        {sugestoes.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => aoMudarRecebido(n.toFixed(2).replace('.', ','))}
            className="cursor-pointer rounded-full border border-grafite-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-creme-400 transition-colors hover:border-ambar-400 hover:text-ambar-400"
          >
            {fmt(n)}
          </button>
        ))}
      </div>

      <div
        className={`flex items-center justify-between rounded-xl px-4 py-3 ${
          suficiente ? 'bg-ambar-500/10 text-ambar-400' : 'bg-grafite-800 text-creme-500/40'
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-widest">Troco</span>
        <span className="font-display text-2xl font-bold">{suficiente ? fmt(troco) : '—'}</span>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={aoCancelar} className={`${BTN_SECUNDARIO} flex-1 text-xs`}>
          {rotuloCancelar}
        </button>
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={!suficiente || ocupado}
          className={`${BTN_PRIMARIO} flex-1 text-xs`}
        >
          {ocupado ? 'A processar…' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) {
      setOcupado(false)
      setErro('Credenciais inválidas.')
      return
    }

    // Autenticar não chega: uma conta desativada no Admin continua a ter
    // credenciais válidas. Sem esta verificação, desativar um funcionário
    // deixava de o afastar da caixa — continuava a vender e a receber dinheiro.
    // É a mesma regra do EquipaLayout, que este ecrã não pode contrariar.
    const { data: perfil } = await supabase
      .from('perfis')
      .select('id, nome, ativo')
      .eq('id', data.user.id)
      .maybeSingle()
    if (perfil && perfil.ativo === false) {
      await supabase.auth.signOut()
      setOcupado(false)
      setErro('Conta desativada. Fala com a gerência.')
      return
    }
    setOcupado(false)
    aoEntrar()
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
// O PIN é verificado no servidor pela RPC verificar_pin (SECURITY DEFINER,
// com travão de força bruta) — o hash nunca chega ao browser. A versão anterior
// comparava no browser contra VITE_CAIXA_PIN, e as variáveis VITE_ são
// embutidas no bundle público: o PIN da caixa lia-se com o DevTools aberto.
//
// Só o PIN da própria conta desbloqueia. O PIN é um cadeado, não uma
// identidade — a identidade vem do login, e é ela que assina o audit_log.
function PinGate({ sessaoId, aoDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)
  const [mensagem, setMensagem] = useState('')
  // O pin_hash não é legível pelo browser — o estado dos PINs vem da RPC
  // pin_estado, como no EquipaLayout.
  const [estadoPin, setEstadoPin] = useState(null)

  useEffect(() => {
    supabase.rpc('pin_estado').then(({ data, error }) => {
      const e = Array.isArray(data) ? data[0] : data
      setEstadoPin(error || !e ? { tem_pin_proprio: false, existem_pins: false } : e)
    })
  }, [])

  const usaProprio = !!estadoPin?.tem_pin_proprio
  const temPins = !!estadoPin?.existem_pins

  async function verificar(valor) {
    setPin(valor)
    setErro(false)
    setMensagem('')
    if (valor.length < 4) return

    if (usaProprio) {
      const { data, error } = await supabase.rpc('verificar_pin', { p_pin: valor })
      if (error) {
        setMensagem(error.message || 'Erro a verificar o PIN.')
        setErro(true)
        setPin('')
        return
      }
      const perfil = Array.isArray(data) ? data[0] : data
      if (perfil?.id && perfil.id === sessaoId) {
        aoDesbloquear()
        return
      }
    } else if (!temPins && valor === PIN_PARTILHADO) {
      // Antes de haver PINs pessoais configurados, vale o PIN de arranque —
      // mesma tolerância que o EquipaLayout, para não trancar ninguém fora.
      aoDesbloquear()
      return
    }
    setErro(true)
    setTimeout(() => setPin(''), 600)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-grafite-950">
      <img src={logoStamp} alt="100PRESSÃO" className="h-24 w-24 rounded-full mix-blend-lighten" />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-creme-500/60">
        {usaProprio ? 'O teu PIN pessoal' : 'PIN do turno'}
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
        {mensagem || (erro ? 'PIN incorreto' : '')}
      </p>
    </div>
  )
}

// ----------------------------
// Painel de pedidos activos
// ----------------------------
// Nota (Leandro, teste de 2026-08-14): pedidos que chegam por aqui vêm do menu
// QR, com o cliente sentado à mesa. Não passam pelo visor de propósito — o
// visor é do balcão, para quem está de pé à frente do operador.
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

  async function receberPagamento(pedido, metodoPag) {
    setAProcessar(pedido.id)
    setAviso('')
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          metodo_pagamento: metodoPag,
          estado_pagamento: 'pago',
          estado: 'entregue',
        })
        .eq('id', pedido.id)
      if (error) throw new Error(error.message)

      if (exigeFatura(metodoPag)) {
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
              <li key={p.id} className="rounded-2xl border border-grafite-700 bg-grafite-900 p-4">
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
                        <span className="text-creme-500/60">
                          {fmt(item.preco_unitario * item.quantidade)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-2xl font-bold text-creme-50">{fmt(total)}</span>
                  {!ocupa && (
                    <div className="flex flex-wrap justify-end gap-2">
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
function PainelVendaManual({ emitir, limpar, emitirConcluida }) {
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [variantes, setVariantes] = useState([])
  const [combos, setCombos] = useState([])
  const [erroCarga, setErroCarga] = useState('')
  const [catAtiva, setCatAtiva] = useState(null)
  // Chave do carrinho: 'p:<id>' | 'v:<id>' | 'c:<id>' — um produto com
  // variantes nunca se mistura com o produto base.
  const [carrinho, setCarrinho] = useState({})
  const [metodo, setMetodo] = useState('dinheiro')
  const [pedirNif, setPedirNif] = useState(false)
  const [nif, setNif] = useState('')
  const [recebido, setRecebido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  // Só devolvemos o visor ao estado neutro se este painel chegou a escrever
  // nele — senão, esvaziar o carrinho manual apagava o pedido que o painel da
  // esquerda tinha posto no ecrã do cliente.
  const escreveuNoVisorRef = useRef(false)
  const db = supabasePublico || supabase

  // Carregar categorias, produtos, variantes e combos.
  //
  // A versão anterior pedia a coluna `visivel` na tabela `products` — coluna
  // que não existe (só `categories` a tem). O Postgres devolvia erro, o
  // `.data` vinha null e o painel ficava com as categorias e zero produtos,
  // sem qualquer aviso. Daí o erro ser silencioso: agora falhas de
  // carregamento aparecem no ecrã.
  useEffect(() => {
    if (!db) return
    async function carregar() {
      const [rCat, rProd, rVar, rCombos] = await Promise.all([
        db.from('categories').select('id, nome, visivel, ordem').order('ordem'),
        db
          .from('products')
          .select('id, nome, preco, category_id, disponivel')
          .eq('disponivel', true)
          .order('ordem'),
        db
          .from('product_variants')
          .select('id, product_id, nome, preco, disponivel')
          .eq('disponivel', true)
          .order('ordem'),
        db
          .from('combos')
          .select('id, nome, preco, category_id, disponivel')
          .eq('disponivel', true)
          .order('ordem'),
      ])

      const falha = rCat.error || rProd.error
      if (falha) {
        setErroCarga(falha.message)
        return
      }
      setErroCarga('')

      // 'Ingredientes' é matéria-prima de stock, não se vende ao balcão.
      const cats = (rCat.data || []).filter(
        (c) => c.visivel !== false && c.nome?.toLowerCase() !== 'ingredientes',
      )
      const idsCats = new Set(cats.map((c) => c.id))
      setCategorias(cats)
      setProdutos((rProd.data || []).filter((p) => idsCats.has(p.category_id)))
      setVariantes(rVar.error ? [] : rVar.data || [])
      setCombos(rCombos.error ? [] : (rCombos.data || []).filter((c) => idsCats.has(c.category_id)))
      if (cats.length > 0) setCatAtiva((atual) => atual ?? cats[0].id)
    }
    carregar()
  }, [db])

  // Espelha o carrinho no visor sempre que algo muda — itens, método, NIF,
  // dinheiro entregue. É o que o cliente vê enquanto o operador marca.
  useEffect(() => {
    const linhas = Object.values(carrinho)
    if (linhas.length === 0) {
      if (escreveuNoVisorRef.current) {
        escreveuNoVisorRef.current = false
        limpar()
      }
      return
    }
    escreveuNoVisorRef.current = true
    const itens = linhas.map((i) => linhaVisor(i.chave, i.nome, i.quantidade, i.preco * i.quantidade))
    const total = totalLinhas(itens)
    const valorRecebido = Number(String(recebido).replace(',', '.')) || 0
    const temTroco = metodo === 'dinheiro' && valorRecebido >= total && valorRecebido > 0
    emitir({
      itens,
      total,
      origem: 'manual',
      metodo,
      pedirNif: metodo === 'dinheiro' && pedirNif,
      recebido: temTroco ? valorRecebido : null,
      troco: temTroco ? valorRecebido - total : null,
      aProcessar: ocupado,
    })
  }, [carrinho, metodo, pedirNif, recebido, ocupado, emitir, limpar])

  // `vendavel` é a forma única de produto simples, variante e combo. O preço
  // vem sempre da linha certa — o servidor revalida em criar_pedido, mas o
  // operador e o cliente têm de ver o mesmo valor no ecrã.
  function adicionar(vendavel) {
    setCarrinho((prev) => {
      const atual = prev[vendavel.chave] || { ...vendavel, quantidade: 0 }
      return { ...prev, [vendavel.chave]: { ...atual, quantidade: atual.quantidade + 1 } }
    })
  }

  function remover(chave) {
    setCarrinho((prev) => {
      const atual = prev[chave]
      if (!atual || atual.quantidade <= 1) {
        const { [chave]: _, ...resto } = prev
        return resto
      }
      return { ...prev, [chave]: { ...atual, quantidade: atual.quantidade - 1 } }
    })
  }

  function limparCarrinho() {
    setCarrinho({})
    setNif('')
    setPedirNif(false)
    setRecebido('')
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
        product_id: i.product_id || null,
        variant_id: i.variant_id || null,
        combo_id: i.combo_id || null,
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

      // 3. Marcar como pago + entregue imediatamente.
      //
      // O erro deste update NÃO pode ser ignorado. A linha do pedido já existe
      // e o gatilho de stock já descontou; se a marcação falhar em silêncio,
      // fica uma venda cobrada que o sistema não sabe que foi paga, a
      // faturação a seguir rebenta com "ainda não está pago", e o operador lê
      // "✓ Venda concluída" na mesma. Dinheiro na gaveta, venda em limbo.
      if (!supabase) throw new Error('Sessão expirada — volta a entrar para fechar a venda.')
      const { error: errPago } = await supabase
        .from('orders')
        .update({
          estado_pagamento: 'pago',
          estado: 'entregue',
          metodo_pagamento: metodo,
        })
        .eq('id', orderId)
      if (errPago) {
        throw new Error(
          `Venda nº ${(Array.isArray(order) ? order[0]?.numero : order?.numero) ?? orderId} criada mas NÃO marcada como paga: ${errPago.message}. ` +
            'Fecha-a pelo Staff antes de continuar.',
        )
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

      // 5. Agradecimento no visor, com o troco quando há dinheiro pelo meio
      const valorRecebido = Number(String(recebido).replace(',', '.')) || 0
      const troco =
        metodo === 'dinheiro' && valorRecebido >= totalCarrinho ? valorRecebido - totalCarrinho : null
      escreveuNoVisorRef.current = false
      emitirConcluida({ troco })
      limparCarrinho()
    } catch (e) {
      setAviso(`Erro: ${e.message}`)
    }
    setOcupado(false)
    setTimeout(() => setAviso(''), 6000)
  }

  // Lista de botões da categoria activa. Um produto com variantes desaparece
  // e dá lugar às suas variantes — assim o Almoço PF já não pode ser vendido
  // ao preço base de 8,40 € quando o prato real custa 12,90 €.
  const vendaveisDaCat = useMemo(() => {
    const daCat = produtos.filter((p) => String(p.category_id) === String(catAtiva))
    const lista = []
    daCat.forEach((p) => {
      const suas = variantes.filter((v) => String(v.product_id) === String(p.id))
      if (suas.length === 0) {
        lista.push({
          chave: `p:${p.id}`,
          nome: p.nome,
          preco: Number(p.preco || 0),
          product_id: p.id,
        })
        return
      }
      suas.forEach((v) => {
        lista.push({
          chave: `v:${v.id}`,
          nome: `${p.nome} · ${v.nome}`,
          preco: Number(v.preco || 0),
          product_id: p.id,
          variant_id: v.id,
        })
      })
    })
    combos
      .filter((c) => String(c.category_id) === String(catAtiva))
      .forEach((c) => {
        lista.push({
          chave: `c:${c.id}`,
          nome: `Combo ${c.nome}`,
          preco: Number(c.preco || 0),
          combo_id: c.id,
        })
      })
    return lista
  }, [produtos, variantes, combos, catAtiva])

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

      {/* Falha de carregamento — visível, em vez de uma grelha vazia sem explicação */}
      {erroCarga && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Não foi possível carregar a ementa: {erroCarga}
        </p>
      )}

      {/* Grelha de produtos */}
      <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 xl:grid-cols-3">
        {vendaveisDaCat.map((v) => {
          const qtd = carrinho[v.chave]?.quantidade || 0
          return (
            <button
              key={v.chave}
              type="button"
              onClick={() => adicionar(v)}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors ${
                qtd > 0
                  ? 'border-ambar-500/60 bg-ambar-500/10 text-creme-50'
                  : 'border-grafite-600 text-creme-400 hover:border-creme-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold leading-tight">{v.nome}</span>
                {qtd > 0 && (
                  <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ambar-500 font-display text-sm font-bold text-grafite-950">
                    {qtd}
                  </span>
                )}
              </div>
              <span className="mt-0.5 block text-xs text-creme-500/60">{fmt(v.preco)}</span>
            </button>
          )
        })}
        {!erroCarga && vendaveisDaCat.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-creme-500/40 xl:col-span-3">
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
              <li key={item.chave} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-creme-300">
                  {item.quantidade}× {item.nome}
                </span>
                <span className="font-display text-sm font-bold text-creme-50">
                  {fmt(item.preco * item.quantidade)}
                </span>
                <button
                  type="button"
                  onClick={() => remover(item.chave)}
                  aria-label={`Retirar um ${item.nome}`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-grafite-600 text-xs text-creme-500 hover:border-red-400 hover:text-red-400"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => adicionar(item)}
                  aria-label={`Juntar um ${item.nome}`}
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
                onClick={() => {
                  setMetodo(m.id)
                  setRecebido('')
                }}
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

          {/* Numerário passa pelo ecrã de troco; o resto fecha directamente. */}
          {metodo === 'dinheiro' ? (
            <PagamentoDinheiro
              total={totalCarrinho}
              recebido={recebido}
              aoMudarRecebido={setRecebido}
              aoConfirmar={concluirVenda}
              aoCancelar={limparCarrinho}
              rotuloCancelar="Limpar"
              ocupado={ocupado}
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------
// PDV principal
// ----------------------------
function Pdv({ aoBloquear }) {
  // Um único canal para o PDV inteiro — partilhado pelos dois painéis, para
  // que o visor nunca receba dois estados em conflito.
  const { emitir, limpar, emitirConcluida } = useCanalVisor()

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

      {/* Dois painéis, meio a meio. O da venda manual estava fixo em 384 px, o
          que o deixava estreito num ecrã de balcão enquanto sobrava espaço à
          esquerda. `min-w-0` é o que impede um item de nome comprido de
          empurrar a divisão. */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Painel esquerdo — pedidos activos */}
        <div className="min-w-0 flex-1 overflow-y-auto border-r border-grafite-700 p-5">
          <PainelPedidos />
        </div>

        {/* Painel direito — venda manual */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <PainelVendaManual emitir={emitir} limpar={limpar} emitirConcluida={emitirConcluida} />
        </div>
      </div>
    </div>
  )
}

// ----------------------------
// Componente raiz — orquestra estados
// ----------------------------
function CaixaPdv() {
  // null = a verificar, false = sem auth, objeto = sessão válida
  const [sessao, setSessao] = useState(null)
  const [autenticado, setAutenticado] = useState(null)
  // O desbloqueio do turno é partilhado com o resto da equipa (mesma chave do
  // EquipaLayout), para quem já desbloqueou o turno não ter de repetir o PIN ao
  // passar do Staff para a caixa.
  const [desbloqueado, setDesbloqueado] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setAutenticado(false)
      return
    }
    const aplicar = (s) => {
      setSessao(s || null)
      setAutenticado(!!s)
      setDesbloqueado(!!s && turnoDesbloqueadoPor() === s.user.id)
    }
    supabase.auth.getSession().then(({ data }) => aplicar(data?.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => aplicar(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Uma conta pode ser desativada com a caixa aberta. Revalidar de tempos a
  // tempos fecha a janela entre o clique no Admin e o afastamento efetivo —
  // senão a única barreira seria o próximo login, que pode ser só amanhã.
  useEffect(() => {
    if (!sessao) return
    const rever = async () => {
      const { data: perfil } = await supabase
        .from('perfis')
        .select('ativo')
        .eq('id', sessao.user.id)
        .maybeSingle()
      if (perfil && perfil.ativo === false) {
        definirTurno(null)
        definirOperador(null)
        await supabase.auth.signOut()
      }
    }
    rever()
    const id = setInterval(rever, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [sessao])

  function bloquear() {
    definirTurno(null)
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
    return (
      <PinGate
        sessaoId={sessao?.user?.id}
        aoDesbloquear={() => {
          // Quem está ao balcão passa a ficar identificado — é esta marca que
          // o audit_log usa para saber quem fez cada venda.
          definirTurno(sessao.user.id)
          definirOperador({ id: sessao.user.id, nome: sessao.user.email || 'Equipa' })
          setDesbloqueado(true)
        }}
      />
    )
  }

  // Tudo ok → PDV
  return <Pdv aoBloquear={bloquear} />
}

export default CaixaPdv
