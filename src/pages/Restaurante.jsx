// 100PRESSÃO Restaurante Online — canal de encomendas próprio (take-away +
// entrega), distinto do atendimento à mesa (/cardapio). Partilha os itens da
// ementa mas usa o PREÇO ONLINE (preco_online, com fallback ao preço local).
//
// Checkout REAL: cria encomenda via RPC criar_pedido_online (o servidor
// calcula preço e portes) e cobra por IfThenPay (MB Way / Multibanco) através
// das funções /api/pagamento e /api/pagamento-estado. Só pagamento online.
// A configuração (mínimo, portes, prazo, interruptor) vem do painel Admin
// "Restaurante Online" (definicoes → chave 'entrega').
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabasePublico as supabase } from '../lib/supabase'
import { fmt } from '../lib/pedidos'
import { imagemCategoria } from '../lib/imagensCategoria'
import SEOHead from '../components/SEOHead'
import FormularioFeedback from '../components/FormularioFeedback'

const WHATSAPP_SUGESTAO =
  'https://wa.me/351935995011?text=' +
  encodeURIComponent('Olá 100PRESSÃO! Experimentei o restaurante online e queria deixar uma sugestão: ')

const CONFIG_INICIAL = {
  ativo: false,
  min_encomenda: 20,
  km_gratis: 2,
  taxa_base: 1.6,
  preco_km: 0.9,
  raio_max: 12,
  prazo_preparacao: 20,
}

// Preço do canal online: usa preco_online quando definido; senão o preço local.
const precoOnline = (x) =>
  Number(x?.preco_online != null && x.preco_online !== '' ? x.preco_online : x?.preco) || 0

const BOTAO =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-ambar-500 px-7 py-3 text-sm font-semibold uppercase tracking-widest text-grafite-950 transition-colors hover:bg-ambar-400 disabled:opacity-40'
const BOTAO_SEC =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600 transition-colors hover:border-grafite-600'
const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'

function Restaurante() {
  const [params] = useSearchParams()
  const preview = params.get('preview') != null

  const [config, setConfig] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [combos, setCombos] = useState([])
  const [variantes, setVariantes] = useState({})
  const [carrinho, setCarrinho] = useState({})
  const [fase, setFase] = useState('menu') // menu | checkout | pagamento | confirmado

  // Checkout
  const [tipo, setTipo] = useState('entrega') // entrega | levar
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [morada, setMorada] = useState('')
  const [distSim, setDistSim] = useState('') // distância (km): calculada pelo mapa ou escrita
  const [calculando, setCalculando] = useState(false)
  const [erroDist, setErroDist] = useState('')
  const [metodo, setMetodo] = useState('mbway')
  const [idade, setIdade] = useState(false) // 18+ (Brandão E)
  const [aceito, setAceito] = useState(false) // Condições de Venda (Brandão J)

  // Pagamento
  const [pedido, setPedido] = useState(null) // { id, numero, total, portes }
  const [refMB, setRefMB] = useState(null) // { entidade, referencia, valor }
  const [aFinalizar, setAFinalizar] = useState(false)
  const [erroPag, setErroPag] = useState('')

  // Configuração do canal (mínimo, portes, prazo, interruptor)
  useEffect(() => {
    supabase
      .from('definicoes')
      .select('valor')
      .eq('chave', 'entrega')
      .maybeSingle()
      .then(({ data }) => setConfig({ ...CONFIG_INICIAL, ...(data?.valor || {}) }))
  }, [])

  // Ementa (mesma origem do /cardapio; cada consulta isolada)
  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [rCat, rProd, rCombos, rVar] = await Promise.all([
        supabase.from('categories').select('*').order('ordem'),
        supabase.from('products').select('*, categories(id, nome)').eq('disponivel', true).order('ordem'),
        supabase.from('combos').select('*, combo_items(quantidade, products(nome))').eq('disponivel', true).order('ordem'),
        supabase.from('product_variants').select('*').eq('disponivel', true).order('ordem'),
      ])
      if (!ativo) return
      const ocultas = new Set((rCat.data || []).filter((c) => c.visivel === false).map((c) => c.id))
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

  const resolverChave = useCallback(
    (chave) => {
      const partes = chave.split(':')
      if (partes[0] === 'c') {
        const combo = combos.find((c) => String(c.id) === partes[1])
        return combo ? { nome: `Combo ${combo.nome}`, preco: precoOnline(combo), alergenios: null } : null
      }
      const p = produtos.find((x) => String(x.id) === partes[1])
      if (!p) return null
      const v = partes[2] === 'v' ? (variantes[p.id] || []).find((x) => String(x.id) === partes[3]) : null
      if (partes[2] === 'v' && !v) return null
      return {
        nome: v ? `${p.nome} ${v.nome}` : p.nome,
        preco: precoOnline(v || p),
        alergenios: p.alergenios || null,
      }
    },
    [produtos, combos, variantes],
  )

  // Linhas do carrinho já resolvidas (nome, preço, alergénios, quantidade)
  const linhas = useMemo(
    () =>
      Object.entries(carrinho)
        .map(([chave, qtd]) => ({ chave, qtd, ...(resolverChave(chave) || {}) }))
        .filter((l) => l.nome),
    [carrinho, resolverChave],
  )

  const subtotal = useMemo(() => linhas.reduce((s, l) => s + l.preco * l.qtd, 0), [linhas])
  const nItens = Object.values(carrinho).reduce((s, q) => s + q, 0)

  const cfg = config || CONFIG_INICIAL
  const distancia = Number(String(distSim).replace(',', '.')) || 0
  // Portes: grátis até km_gratis; acima, taxa_base + preco_km × (km − km_gratis).
  const portes = useMemo(() => {
    if (tipo !== 'entrega' || distancia <= Number(cfg.km_gratis || 0)) return 0
    return Number(cfg.taxa_base || 0) + (distancia - Number(cfg.km_gratis || 0)) * Number(cfg.preco_km || 0)
  }, [tipo, distancia, cfg])
  const total = subtotal + portes
  const abaixoMinimo = tipo === 'entrega' && subtotal < Number(cfg.min_encomenda || 0)
  const foraDoRaio = tipo === 'entrega' && distancia > Number(cfg.raio_max || 0)

  async function calcularDistancia() {
    if (!morada.trim()) {
      setErroDist('Escreve a morada primeiro.')
      return
    }
    setCalculando(true)
    setErroDist('')
    try {
      const resp = await fetch('/api/distancia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origem: { lat: cfg.loja_lat, lng: cfg.loja_lng }, morada }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErroDist(json.erro || 'Não foi possível calcular a distância.')
        return
      }
      setDistSim(String(json.km))
    } catch {
      setErroDist('Erro ao calcular a distância.')
    } finally {
      setCalculando(false)
    }
  }

  const mudar = (chave, delta) =>
    setCarrinho((c) => {
      const q = (c[chave] || 0) + delta
      const novo = { ...c }
      if (q <= 0) delete novo[chave]
      else novo[chave] = q
      return novo
    })

  const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const telValido = /^\d{9}$/.test(telefone)

  const podeFinalizar =
    nItens > 0 &&
    !abaixoMinimo &&
    !foraDoRaio &&
    nome.trim() &&
    telValido &&
    emailValido &&
    (tipo === 'levar' || morada.trim()) &&
    metodo &&
    idade &&
    aceito

  // ── Criar encomenda + iniciar pagamento ──
  async function finalizar() {
    if (!podeFinalizar || aFinalizar) return
    setAFinalizar(true)
    setErroPag('')
    try {
      const itens = Object.entries(carrinho).map(([chave, qtd]) => {
        const partes = chave.split(':')
        if (partes[0] === 'c') return { combo_id: partes[1], quantidade: qtd }
        return {
          product_id: partes[1],
          variant_id: partes[2] === 'v' ? partes[3] : null,
          quantidade: qtd,
        }
      })

      const { data, error } = await supabase
        .rpc('criar_pedido_online', {
          p_nome: nome.trim(),
          p_telefone: telefone,
          p_email: email.trim(),
          p_tipo: tipo,
          p_morada: tipo === 'entrega' ? morada.trim() : null,
          p_distancia: tipo === 'entrega' ? distancia : 0,
          p_metodo: metodo,
          p_idade_ok: idade,
          p_aceitou: aceito,
          p_itens: itens,
        })
        .single()

      if (error || !data) {
        setErroPag('Não foi possível criar a encomenda. Confirma os dados e tenta de novo.')
        setAFinalizar(false)
        return
      }

      setPedido(data)
      setFase('pagamento')

      // Inicia o pagamento no servidor (chave IfThenPay nunca vem ao browser).
      const resp = await fetch('/api/pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: data.id, telefone }),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErroPag(j.erro || 'Não foi possível iniciar o pagamento.')
        return
      }
      if (j.metodo === 'multibanco') setRefMB({ entidade: j.entidade, referencia: j.referencia, valor: j.valor })
    } catch {
      setErroPag('Erro de ligação. Tenta novamente.')
    } finally {
      setAFinalizar(false)
    }
  }

  // ── Polling do estado do pagamento (fase 'pagamento') ──
  const intervaloRef = useRef(null)
  useEffect(() => {
    if (fase !== 'pagamento' || !pedido) return
    let vivo = true
    async function verificar() {
      try {
        const r = await fetch(`/api/pagamento-estado?pedido_id=${pedido.id}`)
        const j = await r.json().catch(() => ({}))
        if (vivo && j.pago) {
          setFase('confirmado')
        }
      } catch {
        /* tenta na próxima */
      }
    }
    verificar()
    intervaloRef.current = setInterval(verificar, 4000)
    return () => {
      vivo = false
      clearInterval(intervaloRef.current)
    }
  }, [fase, pedido])

  // ── Gate: só visível com o interruptor ligado (ou ?preview) ──
  if (config && !cfg.ativo && !preview) {
    return (
      <main className="bg-creme-50 text-grafite-800">
        <SEOHead title="Restaurante Online | 100PRESSÃO" description="Encomende do 100PRESSÃO." path="/restaurante" />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-4xl font-bold uppercase text-grafite-900">Restaurante Online</h1>
          <p className="mt-4 text-lg text-grafite-600">
            Em breve vais poder encomendar aqui, para entrega e levantamento. Enquanto
            preparamos, passa por cá ou fala connosco.
          </p>
          <Link to="/home" className={`${BOTAO} mt-8`}>Ver a casa</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead title="Restaurante Online | 100PRESSÃO" description="Encomende do 100PRESSÃO para entrega ou levantamento." path="/restaurante" />
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cobre-600">Restaurante Online</p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">Encomendar</h1>
          </div>
          <p className="text-sm text-grafite-600/70">Entrega e levantamento · sem taxas de plataforma</p>
        </header>

        {preview && !cfg.ativo && (
          <div className="mt-5 rounded-xl border border-ambar-500/50 bg-ambar-500/10 px-4 py-3 text-sm text-grafite-800">
            <strong>Pré-visualização.</strong> O canal ainda está desligado para o público, mas
            o checkout é real: encomendas criadas aqui são reais e cobradas.
          </div>
        )}

        {/* ── MENU ── */}
        {fase === 'menu' && (
          <div className="mt-8 space-y-8">
            {categorias.map((cat) => {
              const prods = produtos.filter((p) => p.category_id === cat.id)
              const cbs = combos.filter((c) => c.category_id === cat.id)
              if (prods.length === 0 && cbs.length === 0) return null
              return (
                <section key={cat.id}>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">{cat.nome}</h2>
                  <div className="mt-4 space-y-3">
                    {cbs.map((c) => (
                      <ItemLinha key={`c:${c.id}`} nome={`Combo ${c.nome}`} descricao={c.descricao} preco={precoOnline(c)} imagem={c.imagem_url || imagemCategoria(cat.nome)} qtd={carrinho[`c:${c.id}`] || 0} onAdd={() => mudar(`c:${c.id}`, 1)} onSub={() => mudar(`c:${c.id}`, -1)} />
                    ))}
                    {prods.map((p) => {
                      const vs = variantes[p.id] || []
                      if (vs.length > 0) {
                        return vs.map((v) => (
                          <ItemLinha key={`p:${p.id}:v:${v.id}`} nome={`${p.nome} ${v.nome}`} descricao={p.descricao} preco={precoOnline(v)} imagem={p.imagem_url || imagemCategoria(cat.nome)} qtd={carrinho[`p:${p.id}:v:${v.id}`] || 0} onAdd={() => mudar(`p:${p.id}:v:${v.id}`, 1)} onSub={() => mudar(`p:${p.id}:v:${v.id}`, -1)} />
                        ))
                      }
                      return (
                        <ItemLinha key={`p:${p.id}`} nome={p.nome} descricao={p.descricao} preco={precoOnline(p)} imagem={p.imagem_url || imagemCategoria(cat.nome)} qtd={carrinho[`p:${p.id}`] || 0} onAdd={() => mudar(`p:${p.id}`, 1)} onSub={() => mudar(`p:${p.id}`, -1)} />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* ── CHECKOUT ── */}
        {fase === 'checkout' && (
          <div className="mt-8 space-y-6">
            <button type="button" onClick={() => setFase('menu')} className="text-sm font-semibold uppercase tracking-widest text-cobre-600">← Voltar à ementa</button>

            {/* Tipo */}
            <div className="rounded-2xl border border-creme-300 bg-white/70 p-6">
              <h2 className="font-display text-lg font-bold uppercase text-grafite-600">Como queres receber?</h2>
              <div className="mt-3 flex gap-3">
                {[{ id: 'entrega', r: 'Entrega' }, { id: 'levar', r: 'Levantar' }].map((o) => (
                  <button key={o.id} type="button" onClick={() => setTipo(o.id)} className={tipo === o.id ? BOTAO : BOTAO_SEC}>{o.r}</button>
                ))}
              </div>
              {tipo === 'entrega' && (
                <p className="mt-3 text-xs text-grafite-600/70">
                  Grátis até {cfg.km_gratis} km; acima, {fmt(cfg.taxa_base)} + {fmt(cfg.preco_km)}/km, até {cfg.raio_max} km. Encomenda mínima {fmt(cfg.min_encomenda)}.
                </p>
              )}
              <p className="mt-2 text-xs text-grafite-600/70">
                Preparação em cerca de {cfg.prazo_preparacao} min{tipo === 'entrega' ? ', mais o tempo de entrega conforme a distância.' : ' (avisamos quando estiver pronto para levantar).'}
              </p>
            </div>

            {/* Dados */}
            <div className="rounded-2xl border border-creme-300 bg-white/70 p-6">
              <h2 className="font-display text-lg font-bold uppercase text-grafite-600">Os teus dados</h2>
              <label className="mt-3 block text-sm font-semibold uppercase tracking-widest text-ambar-600">Nome
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} placeholder="O teu nome" />
              </label>
              <label className="mt-3 block text-sm font-semibold uppercase tracking-widest text-ambar-600">Telemóvel
                <input value={telefone} onChange={(e) => setTelefone(e.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="numeric" className={CAMPO} placeholder="9xx xxx xxx" />
              </label>
              <label className="mt-3 block text-sm font-semibold uppercase tracking-widest text-ambar-600">Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={CAMPO} placeholder="para a confirmação da encomenda" />
              </label>
              {tipo === 'entrega' && (
                <>
                  <label className="mt-3 block text-sm font-semibold uppercase tracking-widest text-ambar-600">Morada de entrega
                    <input value={morada} onChange={(e) => setMorada(e.target.value)} className={CAMPO} placeholder="Rua, número, andar, código postal" />
                  </label>
                  <div className="mt-3">
                    <span className="block text-sm font-semibold uppercase tracking-widest text-ambar-600">Distância (km)</span>
                    <div className="mt-1 flex gap-2">
                      <input value={distSim} onChange={(e) => setDistSim(e.target.value)} inputMode="decimal" aria-label="Distância em km" className={`${CAMPO} mt-0 flex-1`} placeholder="calcula pela morada ou escreve" />
                      <button type="button" onClick={calcularDistancia} disabled={calculando} className={BOTAO_SEC}>
                        {calculando ? 'A calcular…' : 'Calcular'}
                      </button>
                    </div>
                    {erroDist && <p className="mt-1 text-sm text-red-600">{erroDist}</p>}
                  </div>
                </>
              )}
            </div>

            {/* Pagamento */}
            <div className="rounded-2xl border border-creme-300 bg-white/70 p-6">
              <h2 className="font-display text-lg font-bold uppercase text-grafite-600">Pagamento online</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[{ id: 'mbway', r: 'MB Way' }, { id: 'multibanco', r: 'Multibanco' }].map((m) => (
                  <button key={m.id} type="button" onClick={() => setMetodo(m.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-widest ${metodo === m.id ? 'border-ambar-500 bg-ambar-500/15 text-grafite-900' : 'border-creme-300 text-grafite-600/70'}`}>{m.r}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-grafite-600/70">
                {metodo === 'mbway'
                  ? 'Recebes um pedido de pagamento na app MB WAY, no número acima.'
                  : 'Geramos uma referência Multibanco; a encomenda entra na cozinha assim que pagares.'}
              </p>
            </div>

            {/* Resumo + alergénios (Brandão C) */}
            <div className="rounded-2xl border border-creme-300 bg-white/70 p-6">
              <h2 className="font-display text-lg font-bold uppercase text-grafite-600">Resumo</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {linhas.map((l) => (
                  <li key={l.chave} className="border-b border-creme-200 pb-2 last:border-0">
                    <div className="flex justify-between text-grafite-800">
                      <span>{l.qtd}× {l.nome}</span>
                      <span>{fmt(l.preco * l.qtd)}</span>
                    </div>
                    {l.alergenios && (
                      <p className="mt-0.5 text-xs text-grafite-600/70">Alergénios: {l.alergenios}</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between text-sm text-grafite-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {tipo === 'entrega' && <div className="mt-1 flex justify-between text-sm text-grafite-600"><span>Portes {portes === 0 ? '(grátis)' : ''}</span><span>{fmt(portes)}</span></div>}
              <div className="mt-2 flex justify-between border-t border-creme-300 pt-2 font-display text-lg font-bold text-grafite-900"><span>Total</span><span>{fmt(total)}</span></div>
              {abaixoMinimo && <p className="mt-2 text-sm text-red-600">Encomenda mínima de {fmt(cfg.min_encomenda)} para entrega. Faltam {fmt(cfg.min_encomenda - subtotal)}.</p>}
              {foraDoRaio && <p className="mt-2 text-sm text-red-600">Fora da área de entrega (máx. {cfg.raio_max} km). Escolhe levantamento ou uma morada mais próxima.</p>}
              <p className="mt-3 text-xs text-grafite-600/70">
                Informação de alergénios por petisco acima; para dúvidas específicas, fala connosco antes de encomendar.
              </p>
            </div>

            {/* Confirmações legais (Brandão E + J) */}
            <div className="rounded-2xl border border-creme-300 bg-white/70 p-6 space-y-3">
              <label className="flex items-start gap-3 text-sm text-grafite-700">
                <input type="checkbox" checked={idade} onChange={(e) => setIdade(e.target.checked)} className="mt-1 h-4 w-4 accent-ambar-500" />
                <span>Confirmo que tenho <strong>18 anos ou mais</strong> (a encomenda pode incluir bebidas alcoólicas).</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-grafite-700">
                <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1 h-4 w-4 accent-ambar-500" />
                <span>Li e aceito as <Link to="/condicoes-venda" target="_blank" className="font-semibold text-cobre-600 underline-offset-4 hover:underline">Condições de Venda</Link>.</span>
              </label>
            </div>

            {erroPag && <p className="text-sm text-red-600">{erroPag}</p>}

            <button type="button" disabled={!podeFinalizar || aFinalizar} onClick={finalizar} className={`${BOTAO} w-full`}>
              {aFinalizar ? 'A processar…' : `Encomenda com obrigação de pagar · ${fmt(total)}`}
            </button>
          </div>
        )}

        {/* ── PAGAMENTO ── */}
        {fase === 'pagamento' && pedido && (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/70 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-cobre-600">Encomenda nº {pedido.numero}</p>
            {metodo === 'mbway' ? (
              <>
                <p className="mt-3 font-display text-2xl font-bold uppercase text-ambar-600">Confirma na app MB WAY</p>
                <p className="mt-3 text-grafite-600">
                  Enviámos um pedido de <strong>{fmt(pedido.total)}</strong> para o telemóvel <strong>{telefone}</strong>.
                  Abre a app MB WAY e confirma. Esta página avança sozinha quando o pagamento for aceite.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-grafite-600/70">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-ambar-500" /> À espera da confirmação…
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 font-display text-2xl font-bold uppercase text-ambar-600">Referência Multibanco</p>
                {refMB ? (
                  <div className="mx-auto mt-4 max-w-xs rounded-xl border border-creme-300 bg-creme-50 p-5 text-left">
                    <p className="flex justify-between"><span className="text-grafite-600/70">Entidade</span><strong className="tracking-widest">{refMB.entidade}</strong></p>
                    <p className="mt-2 flex justify-between"><span className="text-grafite-600/70">Referência</span><strong className="tracking-widest">{refMB.referencia}</strong></p>
                    <p className="mt-2 flex justify-between"><span className="text-grafite-600/70">Valor</span><strong>{fmt(pedido.total)}</strong></p>
                  </div>
                ) : (
                  <p className="mt-4 text-grafite-600/70">A gerar referência…</p>
                )}
                <p className="mt-4 text-grafite-600">
                  Paga por Multibanco ou homebanking. Assim que o pagamento entrar, recebes um email de
                  confirmação e a encomenda vai para a cozinha. Podes fechar esta página.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-grafite-600/70">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-ambar-500" /> A aguardar pagamento…
                </div>
              </>
            )}
            {erroPag && <p className="mt-4 text-sm text-red-600">{erroPag}</p>}
          </div>
        )}

        {/* ── CONFIRMADO ── */}
        {fase === 'confirmado' && pedido && (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/70 p-8 text-center">
            <p className="font-display text-2xl font-bold uppercase text-ambar-600">Encomenda nº {pedido.numero} confirmada ✓</p>
            <p className="mt-3 text-grafite-600">
              Obrigado, {nome || 'cliente'}! Recebemos o pagamento de {fmt(pedido.total)} e já estamos a preparar.
              Enviámos a confirmação para {email}.
              {tipo === 'entrega'
                ? ' Vamos a caminho assim que estiver pronto.'
                : ` Podes levantar no restaurante em cerca de ${cfg.prazo_preparacao} min.`}
            </p>
            <button type="button" onClick={() => { setCarrinho({}); setPedido(null); setRefMB(null); setFase('menu') }} className={`${BOTAO} mt-6`}>Nova encomenda</button>

            <div className="mt-8 border-t border-creme-300 pt-6 text-left">
              <p className="text-center text-sm text-grafite-600">
                Deixa a tua sugestão aqui ou
                {' '}
                <a href={WHATSAPP_SUGESTAO} target="_blank" rel="noopener noreferrer" className="font-semibold text-cobre-600 underline-offset-4 hover:underline">
                  pelo WhatsApp
                </a>.
              </p>
              <FormularioFeedback />
            </div>
          </div>
        )}
      </div>

      {/* Barra do carrinho */}
      {fase === 'menu' && nItens > 0 && (
        <div className="sticky bottom-0 border-t border-creme-300 bg-creme-50/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
            <span className="text-sm text-grafite-600">{nItens} {nItens === 1 ? 'item' : 'itens'} · <strong className="text-grafite-900">{fmt(subtotal)}</strong></span>
            <button type="button" onClick={() => setFase('checkout')} className={BOTAO}>Rever pedido →</button>
          </div>
        </div>
      )}
    </main>
  )
}

function ItemLinha({ nome, descricao, preco, imagem, qtd, onAdd, onSub }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-creme-300 bg-white/70 p-3">
      {imagem && <img src={imagem} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-grafite-900">{nome}</p>
        {descricao && <p className="truncate text-sm text-grafite-600/70">{descricao}</p>}
        <p className="mt-0.5 font-display font-bold text-cobre-600">{fmt(preco)}</p>
      </div>
      <div className="flex items-center gap-2">
        {qtd > 0 && (
          <>
            <button type="button" aria-label="Remover um" onClick={onSub} className="h-8 w-8 rounded-full border border-creme-300 text-grafite-600">−</button>
            <span className="w-5 text-center font-semibold">{qtd}</span>
          </>
        )}
        <button type="button" aria-label="Adicionar um" onClick={onAdd} className="h-8 w-8 rounded-full bg-ambar-500 font-bold text-grafite-950">+</button>
      </div>
    </div>
  )
}

export default Restaurante
