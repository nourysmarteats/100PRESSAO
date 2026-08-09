// 100PRESSÃO Restaurante Online — canal de encomendas próprio (take-away +
// entrega), distinto do atendimento à mesa (/cardapio). Partilha os itens da
// ementa mas usa o PREÇO ONLINE (preco_online, com fallback ao preço local).
//
// Checkout REAL: cria encomenda via RPC criar_pedido_online (o servidor
// calcula preço e portes) e cobra por IfThenPay (MB Way, Multibanco e, pelo
// gateway, cartão + Google Pay + Apple Pay) através
// das funções /api/pagamento e /api/pagamento-estado. Só pagamento online.
// A configuração (mínimo, portes, prazo, interruptor) vem do painel Admin
// "Restaurante Online" (definicoes → chave 'entrega').
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabasePublico as supabase } from '../lib/supabase'
import { fmt, ROTULO_ESTADO } from '../lib/pedidos'
import { imagemCategoria } from '../lib/imagensCategoria'
import SEOHead from '../components/SEOHead'
import FormularioFeedback from '../components/FormularioFeedback'
import logoStamp from '../assets/logo-100pressao.png'

const WHATSAPP_SUGESTAO =
  'https://wa.me/351935995011?text=' +
  encodeURIComponent('Olá 100PRESSÃO! Experimentei o restaurante online e queria deixar uma sugestão: ')

// Capa da loja: o vídeo do balcão, com o poster por baixo. O poster fica
// visível se o autoplay for bloqueado (iOS em poupança de energia) ou enquanto
// o vídeo não arranca — nunca se vê um retângulo preto.
const CAPA_VIDEO = '/quem-somos-banner.mp4'
const CAPA_URL = '/quem-somos-poster.jpg'
const ETIQUETAS = ['Cervejaria', 'Petiscos', 'Luso-brasileiro']

// Alturas do cabeçalho global (Header.jsx: logo h-16/h-20 + py-3), precisas
// para o sticky dos chips e para o destino do scroll ao saltar de categoria.
const ALTURA_HEADER = { movel: 88, grande: 104 }

// Guarda a encomenda enquanto o cliente está no gateway do IfThenPay.
const CHAVE_PAGAMENTO = '100p:pagamento-cartao'

const CONFIG_INICIAL = {
  ativo: false,
  cartao_ativo: false,
  pix_ativo: false,
  dinheiro_ativo: false,
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
const CARTAO = 'rounded-2xl border border-creme-300 bg-white/70'

// Há combos gravados já com "Combo" no nome ("Combo Português") e outros sem.
// Prefixar às cegas dava "Combo Combo Português".
const nomeCombo = (c) =>
  /^combo\b/i.test((c?.nome || '').trim()) ? c.nome : `Combo ${c?.nome || ''}`

// Pesquisa tolerante a acentos: "almoco" encontra "Almoço", "pao" encontra "Pão".
const semAcentos = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

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

  // Navegação da loja (ementa)
  const [busca, setBusca] = useState('')
  const [catAtiva, setCatAtiva] = useState(null)
  const [itemAberto, setItemAberto] = useState(null)
  const refsSecoes = useRef({})
  const navRef = useRef(null)

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
  const [carteira, setCarteira] = useState(null) // null | 'apple' | 'google'
  const [cpf, setCpf] = useState('') // só para Pix
  const [idade, setIdade] = useState(false) // 18+ (Brandão E)
  const [aceito, setAceito] = useState(false) // Condições de Venda (Brandão J)

  // Pagamento
  const [pedido, setPedido] = useState(null) // { id, numero, total, portes }
  const [refMB, setRefMB] = useState(null) // { entidade, referencia, valor }
  const [aFinalizar, setAFinalizar] = useState(false)
  const [erroPag, setErroPag] = useState('')
  const [confirmacaoLenta, setConfirmacaoLenta] = useState(false)
  const [estadoPedido, setEstadoPedido] = useState('recebido')

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
        return combo ? { nome: nomeCombo(combo), preco: precoOnline(combo), alergenios: null } : null
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

  // Ementa normalizada: um item por produto (as variantes passam a ser opções
  // dentro da folha, como nas plataformas, em vez de uma linha cada).
  const seccoes = useMemo(() => {
    return categorias
      .map((cat) => {
        const itens = []
        combos
          .filter((c) => c.category_id === cat.id)
          .forEach((c) =>
            itens.push({
              ref: `c:${c.id}`,
              chave: `c:${c.id}`,
              nome: nomeCombo(c),
              descricao: c.descricao,
              imagem: c.imagem_url || imagemCategoria(cat.nome),
              preco: precoOnline(c),
              opcoes: [],
            }),
          )
        produtos
          .filter((p) => p.category_id === cat.id)
          .forEach((p) => {
            const opcoes = (variantes[p.id] || []).map((v) => ({
              id: v.id,
              nome: v.nome,
              preco: precoOnline(v),
              chave: `p:${p.id}:v:${v.id}`,
            }))
            itens.push({
              ref: `p:${p.id}`,
              chave: opcoes.length ? null : `p:${p.id}`,
              nome: p.nome,
              descricao: p.descricao,
              imagem: p.imagem_url || imagemCategoria(cat.nome),
              preco: opcoes.length ? Math.min(...opcoes.map((o) => o.preco)) : precoOnline(p),
              opcoes,
            })
          })
        return { id: cat.id, nome: cat.nome, itens }
      })
      .filter((s) => s.itens.length > 0)
  }, [categorias, produtos, combos, variantes])

  const seccoesVisiveis = useMemo(() => {
    const termo = semAcentos(busca).trim()
    if (!termo) return seccoes
    return seccoes
      .map((s) => ({
        ...s,
        itens: s.itens.filter(
          (i) => semAcentos(i.nome).includes(termo) || semAcentos(i.descricao).includes(termo),
        ),
      }))
      .filter((s) => s.itens.length > 0)
  }, [seccoes, busca])

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

  const mudar = useCallback(
    (chave, delta) =>
      setCarrinho((c) => {
        const q = (c[chave] || 0) + delta
        const novo = { ...c }
        if (q <= 0) delete novo[chave]
        else novo[chave] = q
        return novo
      }),
    [],
  )

  // Quantidade já no carrinho para um item da lista (soma as variantes).
  const qtdDoItem = useCallback(
    (item) =>
      item.opcoes.length
        ? item.opcoes.reduce((s, o) => s + (carrinho[o.chave] || 0), 0)
        : carrinho[item.chave] || 0,
    [carrinho],
  )

  // ── Scroll-spy dos chips de categoria ──
  useEffect(() => {
    if (fase !== 'menu' || seccoesVisiveis.length === 0) return
    const alturaChips = navRef.current?.getBoundingClientRect().height || 56
    const topo = (window.innerWidth >= 640 ? ALTURA_HEADER.grande : ALTURA_HEADER.movel) + alturaChips
    const observador = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visiveis[0]) setCatAtiva(visiveis[0].target.dataset.cat)
      },
      { rootMargin: `-${topo + 8}px 0px -65% 0px`, threshold: 0 },
    )
    seccoesVisiveis.forEach((s) => {
      const el = refsSecoes.current[s.id]
      if (el) observador.observe(el)
    })
    return () => observador.disconnect()
  }, [fase, seccoesVisiveis])

  // O chip ativo acompanha o scroll dentro da própria barra.
  useEffect(() => {
    if (!catAtiva || !navRef.current) return
    navRef.current
      .querySelector(`[data-chip="${catAtiva}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [catAtiva])

  function irParaCategoria(id) {
    const el = refsSecoes.current[id]
    if (!el) return
    const alturaChips = navRef.current?.getBoundingClientRect().height || 56
    const topo = (window.innerWidth >= 640 ? ALTURA_HEADER.grande : ALTURA_HEADER.movel) + alturaChips
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - topo - 12,
      behavior: 'smooth',
    })
    setCatAtiva(String(id))
  }

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
    (metodo !== 'pix' || cpf.replace(/\D/g, '').length === 11) &&
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

      // Dinheiro: não há nada a cobrar agora — a encomenda já foi criada em
      // 'na_entrega' e segue direta para a cozinha. Ainda assim passa pelo
      // servidor, porque é de lá que sai o email de confirmação, que as
      // Condições de Venda exigem em qualquer encomenda à distância.
      if (metodo === 'dinheiro') {
        await fetch('/api/pagamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedido_id: data.id }),
        }).catch(() => {})
        setFase('confirmado')
        return
      }

      setFase('pagamento')

      // Inicia o pagamento no servidor (chave IfThenPay nunca vem ao browser).
      const resp = await fetch('/api/pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: data.id, telefone, cpf, carteira }),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setErroPag(j.erro || 'Não foi possível iniciar o pagamento.')
        return
      }
      if (j.metodo === 'multibanco') setRefMB({ entidade: j.entidade, referencia: j.referencia, valor: j.valor })

      // Cartão: o cliente sai do site para a página do IfThenPay. Guarda-se o
      // essencial da encomenda para o ecrã de regresso conseguir mostrá-la
      // (o estado do React não sobrevive à navegação).
      if ((j.metodo === 'cartao' || j.metodo === 'pix') && j.paymentUrl) {
        try {
          sessionStorage.setItem(
            CHAVE_PAGAMENTO,
            JSON.stringify({ id: data.id, numero: data.numero, total: data.total, tipo, email: email.trim(), metodo }),
          )
        } catch {
          /* sessionStorage indisponível: o regresso usa só o ?pedido= */
        }
        window.location.href = j.paymentUrl
        return
      }
    } catch {
      setErroPag('Erro de ligação. Tenta novamente.')
    } finally {
      setAFinalizar(false)
    }
  }

  // ── Polling do estado do pagamento (fase 'pagamento') ──
  //
  // A confirmação vem do callback servidor-a-servidor do IfThenPay; isto só
  // observa a nossa base de dados à espera dela. Se o callback não chegar (por
  // exemplo, por não estar activado no backoffice para o método usado), o
  // cliente não pode ficar eternamente com um indicador a girar depois de ter
  // pago — ao fim de 2 minutos assume-se confirmação lenta e diz-se-lhe o que
  // esperar, com o número da encomenda como referência.
  const intervaloRef = useRef(null)
  useEffect(() => {
    if (fase !== 'pagamento' || !pedido) return
    let vivo = true
    let tentativas = 0
    const MAX_TENTATIVAS = 30 // 30 × 4s = 2 minutos

    async function verificar() {
      try {
        const r = await fetch(`/api/pagamento-estado?pedido_id=${pedido.id}`)
        const j = await r.json().catch(() => ({}))
        if (!vivo) return
        // Quem volta da página de cartão pode não ter o número/total em memória.
        if (j.numero != null && pedido.numero == null) {
          setPedido((p) => (p ? { ...p, numero: j.numero, total: j.total } : p))
        }
        if (j.pago) {
          setConfirmacaoLenta(false)
          setFase('confirmado')
          return
        }
      } catch {
        /* tenta na próxima */
      }
      if (!vivo) return
      tentativas += 1
      if (tentativas >= MAX_TENTATIVAS) {
        setConfirmacaoLenta(true)
        clearInterval(intervaloRef.current)
      }
    }

    setConfirmacaoLenta(false)
    verificar()
    intervaloRef.current = setInterval(verificar, 4000)
    return () => {
      vivo = false
      clearInterval(intervaloRef.current)
    }
  }, [fase, pedido])

  // ── Acompanhar a encomenda depois de confirmada ──
  // Quem pagou uma entrega quer saber quando a comida saiu. Usa a RPC
  // estado_pedido, que devolve só o estado — o UUID da encomenda serve de
  // credencial e nenhum dado pessoal sai da base de dados.
  useEffect(() => {
    if (fase !== 'confirmado' || !pedido?.id) return
    if (estadoPedido === 'entregue') return
    let vivo = true
    async function ver() {
      const { data, error } = await supabase.rpc('estado_pedido', { p_id: pedido.id })
      if (!vivo || error || !data) return
      setEstadoPedido(data)
    }
    ver()
    const relogio = setInterval(ver, 15000)
    const aoVoltar = () => document.visibilityState === 'visible' && ver()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [fase, pedido?.id, estadoPedido])

  // ── Regresso da página de cartão do IfThenPay ──
  // O cliente volta a /restaurante?pedido=<id>&pag=ok|erro|cancelado. O "ok"
  // não é prova de pagamento (o URL é acessível à mão): serve só para retomar
  // o ecrã de espera. Quem confirma é o callback, e o polling acima é que
  // deteta a confirmação na nossa base de dados.
  useEffect(() => {
    const idPedido = params.get('pedido')
    const resultado = params.get('pag')
    if (!idPedido || !resultado) return

    let guardado = null
    try {
      guardado = JSON.parse(sessionStorage.getItem(CHAVE_PAGAMENTO) || 'null')
    } catch {
      guardado = null
    }
    sessionStorage.removeItem?.(CHAVE_PAGAMENTO)

    setMetodo('cartao')
    setPedido(guardado?.id === idPedido ? guardado : { id: idPedido, numero: null, total: null })
    if (guardado?.tipo) setTipo(guardado.tipo)
    if (guardado?.email) setEmail(guardado.email)

    if (resultado === 'ok') {
      setFase('pagamento')
    } else {
      // O IfThenPay pode juntar detalhe do erro aos parâmetros de regresso.
      // Sem isto perde-se a única pista sobre PORQUE falhou o pagamento — o
      // servidor regista-o para ficar no log junto ao resto do fluxo.
      try {
        const query = new URLSearchParams(window.location.search).toString()
        fetch(
          `/api/pagamento-estado?pedido_id=${encodeURIComponent(idPedido)}&retorno=${encodeURIComponent(query)}`,
        ).catch(() => {})
      } catch {
        /* diagnóstico é acessório: nunca deve partir o ecrã */
      }

      setFase('pagamento')
      setErroPag(
        resultado === 'cancelado'
          ? 'Cancelaste o pagamento. A encomenda fica por pagar — podes tentar de novo.'
          : 'O pagamento por cartão não foi concluído. Não te foi cobrado nada.',
      )
    }
    // Só à chegada; a partir daqui o fluxo normal assume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <SEOHead title="Restaurante Online | 100PRESSÃO" description="Encomende do 100PRESSÃO para entrega ou levantamento." path="/restaurante" manifest="/restaurante.webmanifest" />
      <CabecalhoLoja tipo={tipo} cfg={cfg} />

      <div className="mx-auto max-w-6xl px-6">
        {/* Canal: entrega ou levantamento. No topo (e não só no checkout) porque
            é o que decide portes e mínimo — o cliente tem de o ver antes de escolher.
            Fora da ementa fica escondido: o checkout tem o seu próprio seletor. */}
        <div className={`${CARTAO} mt-5 flex-wrap items-center gap-3 p-4 shadow-sm sm:gap-4 ${fase === 'menu' ? 'flex' : 'hidden'}`}>
          <div className="flex rounded-full bg-creme-100 p-1">
            {[
              { id: 'entrega', r: 'Entrega' },
              { id: 'levar', r: 'Levantar' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setTipo(o.id)}
                aria-pressed={tipo === o.id}
                className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                  tipo === o.id ? 'bg-ambar-500 text-grafite-950' : 'text-grafite-600 hover:text-grafite-900'
                }`}
              >
                {o.r}
              </button>
            ))}
          </div>
          <p className="text-sm text-grafite-600/80">
            {tipo === 'entrega' ? (
              <>
                Portes grátis até <strong className="text-grafite-900">{cfg.km_gratis} km</strong>; acima,{' '}
                {fmt(cfg.taxa_base)} + {fmt(cfg.preco_km)}/km · mínimo{' '}
                <strong className="text-grafite-900">{fmt(cfg.min_encomenda)}</strong> · entregamos até {cfg.raio_max} km
              </>
            ) : (
              <>
                Levantamento no Mercado Municipal de Carnaxide ·{' '}
                <strong className="text-grafite-900">sem mínimo</strong>
              </>
            )}
          </p>
        </div>

        {preview && !cfg.ativo && (
          <div className="mt-4 rounded-xl border border-ambar-500/50 bg-ambar-500/10 px-4 py-3 text-sm text-grafite-800">
            <strong>Pré-visualização.</strong> O canal ainda está desligado para o público, mas
            o checkout é real: encomendas criadas aqui são reais e cobradas.
          </div>
        )}
      </div>

      {/* ── MENU ── */}
      {fase === 'menu' && (
        <>
          {/* Chips de categoria — sticky por baixo do cabeçalho global */}
          <div
            ref={navRef}
            className="sticky top-[5.5rem] z-30 mt-6 border-y border-creme-300 bg-creme-50/95 backdrop-blur sm:top-[6.5rem]"
          >
            <div className="mx-auto max-w-6xl px-6">
              <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {seccoesVisiveis.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-chip={String(s.id)}
                    onClick={() => irParaCategoria(s.id)}
                    className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 font-display text-sm font-bold uppercase tracking-wide transition-colors ${
                      String(s.id) === catAtiva
                        ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                        : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
                    }`}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl gap-10 px-6 pb-32 lg:grid lg:grid-cols-[1fr_22rem] lg:pb-16">
            <div className="min-w-0">
              {/* Pesquisa dentro da loja */}
              <div className="relative mt-6">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-grafite-600/50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  type="search"
                  aria-label="Pesquisar na ementa"
                  placeholder="Pesquisar na ementa"
                  className="w-full rounded-full border border-creme-300 bg-white/70 py-3 pl-12 pr-4 text-grafite-900 outline-none placeholder:text-grafite-600/50 focus:border-ambar-500"
                />
              </div>

              {/* Ementa vazia por pesquisa é diferente de ementa ainda a chegar */}
              {seccoesVisiveis.length === 0 &&
                (busca.trim() ? (
                  <p className="mt-10 text-center text-grafite-600">
                    Sem resultados para <strong className="text-grafite-900">“{busca}”</strong>.
                  </p>
                ) : (
                  <p className="mt-10 text-center text-grafite-600/70">A carregar a ementa…</p>
                ))}

              <div className="mt-8 space-y-10">
                {seccoesVisiveis.map((s) => (
                  <section
                    key={s.id}
                    data-cat={String(s.id)}
                    ref={(el) => {
                      refsSecoes.current[s.id] = el
                    }}
                  >
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">
                      {s.nome}
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {s.itens.map((item) => (
                        <CartaoItem
                          key={item.ref}
                          item={item}
                          qtd={qtdDoItem(item)}
                          onAbrir={() => setItemAberto(item)}
                          onAdicionar={() => (item.opcoes.length ? setItemAberto(item) : mudar(item.chave, 1))}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            {/* Carrinho fixo no desktop — abaixo do cabeçalho (6.5rem) + chips (~3.5rem) */}
            <aside className="hidden lg:block">
              <div className="sticky top-[11rem] mt-6">
                <ResumoCarrinho
                  linhas={linhas}
                  mudar={mudar}
                  subtotal={subtotal}
                  minimo={Number(cfg.min_encomenda || 0)}
                  tipo={tipo}
                  abaixoMinimo={abaixoMinimo}
                  onAvancar={() => setFase('checkout')}
                />
              </div>
            </aside>
          </div>
        </>
      )}

      <div className="mx-auto max-w-3xl px-6 pb-12 sm:pb-16">
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
              <h2 className="font-display text-lg font-bold uppercase text-grafite-600">Pagamento</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { id: 'mbway', r: 'MB Way', metodo: 'mbway', carteira: null },
                  { id: 'multibanco', r: 'Multibanco', metodo: 'multibanco', carteira: null },
                  // Cartão, Apple Pay e Google Pay vão todos ao gateway do
                  // IfThenPay, mas com entradas próprias: são marcas que o
                  // cliente reconhece e escolhe à vista, não escondidas dentro
                  // de "Cartão". Na base de dados continuam a ser 'cartao'.
                  ...(cfg.cartao_ativo
                    ? [
                        { id: 'cartao', r: 'Cartão', metodo: 'cartao', carteira: null },
                        // Aparece sempre, por decisão do Leandro. Num
                        // dispositivo sem Apple Pay o gateway mostra o cartão,
                        // porque o servidor envia sempre CCARD como alternativa.
                        { id: 'apple', r: 'Apple Pay', metodo: 'cartao', carteira: 'apple' },
                        { id: 'google', r: 'Google Pay', metodo: 'cartao', carteira: 'google' },
                      ]
                    : []),
                  // Pix: liquida em reais, para clientes com conta brasileira.
                  ...(cfg.pix_ativo ? [{ id: 'pix', r: 'Pix', metodo: 'pix', carteira: null }] : []),
                  // Dinheiro: sem pagamento online — a encomenda é confirmada
                  // logo e paga-se ao receber.
                  ...(cfg.dinheiro_ativo
                    ? [{ id: 'dinheiro', r: 'Dinheiro', metodo: 'dinheiro', carteira: null }]
                    : []),
                ].map((m) => {
                  const ativo = metodo === m.metodo && carteira === m.carteira
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMetodo(m.metodo)
                        setCarteira(m.carteira)
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-widest ${ativo ? 'border-ambar-500 bg-ambar-500/15 text-grafite-900' : 'border-creme-300 text-grafite-600/70'}`}
                    >
                      {m.r}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-grafite-600/70">
                {metodo === 'mbway'
                  ? 'Recebes um pedido de pagamento na app MB WAY, no número acima.'
                  : metodo === 'cartao'
                    ? carteira === 'apple'
                      ? 'Vais para a página segura do IfThenPay e confirmas com Apple Pay, por Face ID ou Touch ID. Voltas aqui no fim.'
                      : carteira === 'google'
                        ? 'Vais para a página segura do IfThenPay e confirmas com Google Pay. Voltas aqui no fim.'
                        : 'Vais para a página segura do IfThenPay para introduzir o cartão Visa ou Mastercard. Voltas aqui no fim.'
                    : metodo === 'dinheiro'
                      ? tipo === 'entrega'
                        ? 'Pagas em dinheiro ao estafeta, na entrega. Tem o valor certo, se puderes.'
                        : 'Pagas em dinheiro no restaurante, ao levantar.'
                    : metodo === 'pix'
                      ? 'Pagamento instantâneo brasileiro. Precisas de conta num banco do Brasil e do teu CPF.'
                      : 'Geramos uma referência Multibanco; a encomenda entra na cozinha assim que pagares.'}
              </p>
              {metodo === 'pix' && (
                <label className="mt-3 block text-sm font-semibold uppercase tracking-widest text-ambar-600">
                  CPF
                  <input
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/[^\d.-]/g, '').slice(0, 14))}
                    inputMode="numeric"
                    className={CAMPO}
                    placeholder="000.000.000-00"
                  />
                  <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-grafite-600/70">
                    Exigido pelo Pix para identificar quem paga.
                  </span>
                </label>
              )}
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
            <p className="text-xs font-semibold uppercase tracking-widest text-cobre-600">
              {pedido.numero ? `Encomenda nº ${pedido.numero}` : 'A tua encomenda'}
            </p>
            {metodo === 'cartao' ? (
              <>
                <p className="mt-3 font-display text-2xl font-bold uppercase text-ambar-600">
                  {erroPag ? 'Pagamento não concluído' : 'A confirmar o pagamento'}
                </p>
                {!erroPag && !confirmacaoLenta && (
                  <>
                    <p className="mt-3 text-grafite-600">
                      Obrigado! Estamos a confirmar o pagamento. Assim que entrar,
                      recebes um email de confirmação e a encomenda vai para a cozinha.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-grafite-600/70">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-ambar-500" /> À espera da confirmação…
                    </div>
                  </>
                )}
                {/* Confirmação a demorar: nunca deixar o cliente que já pagou
                    sem saber o que se passou nem a quem falar. */}
                {!erroPag && confirmacaoLenta && (
                  <>
                    <p className="mt-3 text-grafite-600">
                      A confirmação do banco está a demorar mais do que o costume.
                      {pedido.numero ? ` Guarda o número da encomenda (${pedido.numero}).` : ''}{' '}
                      <strong className="text-grafite-900">Se o pagamento foi feito, não voltes a pagar.</strong>{' '}
                      Assim que a confirmação chegar, recebes o email e preparamos a encomenda.
                    </p>
                    <p className="mt-3 text-sm text-grafite-600/70">
                      Se em 15 minutos não receberes nada, fala connosco — resolvemos na hora.
                    </p>
                    <a
                      href={`https://wa.me/351935995011?text=${encodeURIComponent(
                        `Olá 100PRESSÃO! Paguei a encomenda${pedido.numero ? ` nº ${pedido.numero}` : ''} por cartão mas ainda não recebi confirmação.`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${BOTAO} mt-5`}
                    >
                      Falar connosco no WhatsApp
                    </a>
                  </>
                )}
                {erroPag && (
                  <button type="button" onClick={() => { setErroPag(''); setPedido(null); setRefMB(null); setFase('checkout') }} className={`${BOTAO} mt-6`}>
                    Voltar ao pagamento
                  </button>
                )}
              </>
            ) : metodo === 'mbway' ? (
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
              Obrigado, {nome || 'cliente'}!{' '}
              {metodo === 'dinheiro' ? (
                <>
                  Já estamos a preparar.{' '}
                  <strong className="text-grafite-900">
                    Pagas {fmt(pedido.total)} em dinheiro {tipo === 'entrega' ? 'na entrega' : 'ao levantar'}.
                  </strong>
                </>
              ) : (
                `Recebemos o pagamento de ${fmt(pedido.total)} e já estamos a preparar.`
              )}{' '}
              Enviámos a confirmação para {email}.
              {tipo === 'entrega'
                ? ' Vamos a caminho assim que estiver pronto.'
                : ` Podes levantar no restaurante em cerca de ${cfg.prazo_preparacao} min.`}
            </p>
            <Acompanhamento estado={estadoPedido} entrega={tipo === 'entrega'} />

            <button type="button" onClick={() => { setCarrinho({}); setPedido(null); setRefMB(null); setEstadoPedido('recebido'); setFase('menu') }} className={`${BOTAO} mt-6`}>Nova encomenda</button>

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

      {/* Folha do produto (bottom sheet no telemóvel, caixa centrada no desktop) */}
      {itemAberto && (
        <FolhaItem
          key={itemAberto.ref}
          item={itemAberto}
          carrinho={carrinho}
          onFechar={() => setItemAberto(null)}
          onConfirmar={(chave, qtd) => {
            mudar(chave, qtd)
            setItemAberto(null)
          }}
        />
      )}

      {/* Barra do carrinho — telemóvel/tablet (no desktop há o painel lateral) */}
      {fase === 'menu' && nItens > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-creme-300 bg-creme-50/95 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-6xl px-6 py-3">
            {abaixoMinimo && <BarraProgresso subtotal={subtotal} minimo={Number(cfg.min_encomenda || 0)} />}
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-sm text-grafite-600">{nItens} {nItens === 1 ? 'item' : 'itens'} · <strong className="text-grafite-900">{fmt(subtotal)}</strong></span>
              <button type="button" onClick={() => setFase('checkout')} className={BOTAO}>Rever pedido →</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── Acompanhamento da encomenda ──
// O 'a caminho' só faz sentido em entrega ao domicílio; no levantamento a
// comida não anda, fica à espera no balcão.
function Acompanhamento({ estado, entrega }) {
  const passos = entrega
    ? ['recebido', 'em_preparacao', 'pronto', 'a_caminho', 'entregue']
    : ['recebido', 'em_preparacao', 'pronto', 'entregue']
  const atual = passos.indexOf(estado)

  return (
    <ol className="mt-6 flex items-center justify-center gap-1.5" aria-label="Estado da encomenda">
      {passos.map((p, i) => {
        const feito = atual >= i
        const agora = atual === i
        return (
          <li key={p} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`h-1.5 w-full rounded-full transition-colors ${
                feito ? 'bg-ambar-500' : 'bg-creme-300'
              }`}
            />
            <span
              className={`text-center text-[0.6rem] font-semibold uppercase leading-tight tracking-wider ${
                agora ? 'text-grafite-900' : feito ? 'text-grafite-600/70' : 'text-grafite-600/40'
              }`}
            >
              {p === 'entregue' && !entrega ? 'Levantado' : ROTULO_ESTADO[p]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Cabeçalho da loja: capa, carimbo e barra de info ──
function CabecalhoLoja({ tipo, cfg }) {
  const videoRef = useRef(null)
  const [videoAtivo, setVideoAtivo] = useState(false)

  // iOS/Android podem ignorar o autoplay declarativo (ex.: modo poupança de
  // bateria); repetir via API dá uma segunda oportunidade sem afetar o desktop.
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const informacoes = [
    {
      rotulo: 'Preparação',
      valor: `~${cfg.prazo_preparacao} min`,
    },
    {
      rotulo: tipo === 'entrega' ? 'Portes' : 'Levantamento',
      valor: tipo === 'entrega' ? `Grátis até ${cfg.km_gratis} km` : 'Sem custo',
    },
    {
      rotulo: 'Mínimo',
      valor: tipo === 'entrega' ? fmt(cfg.min_encomenda) : 'Sem mínimo',
    },
  ]

  return (
    <header>
      <div className="relative h-44 overflow-hidden bg-grafite-900 sm:h-60">
        {/* Poster sempre presente por baixo; o vídeo aparece em fade quando toca */}
        <img src={CAPA_URL} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <video
          ref={videoRef}
          src={CAPA_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={CAPA_URL}
          aria-hidden="true"
          onPlaying={() => setVideoAtivo(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoAtivo ? 'opacity-70' : 'opacity-0'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-grafite-950/90 via-grafite-950/30 to-grafite-950/50" />
      </div>
      <div className="mx-auto max-w-6xl px-6">
        {/* Carimbo a cavalo na capa, como o avatar da loja nas plataformas.
            `relative` é obrigatório: a capa é posicionada e, sem isto, pintava
            por cima da metade superior do carimbo. */}
        <img
          src={logoStamp}
          alt="Logótipo 100PRESSÃO"
          width="640"
          height="640"
          className="relative -mt-14 h-24 w-24 rounded-full border-4 border-creme-50 bg-grafite-900 sm:h-28 sm:w-28"
        />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-cobre-600">
          Restaurante Online
        </p>
        <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-tight text-grafite-900 sm:text-4xl">
          100PRESSÃO Draft House
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-grafite-600/80">
          {ETIQUETAS.map((e, i) => (
            <span key={e}>
              {i > 0 && <span className="mr-2 text-creme-500">·</span>}
              {e}
            </span>
          ))}
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {informacoes.map((i) => (
            <div key={i.rotulo}>
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-cobre-600">{i.rotulo}</dt>
              <dd className="font-display text-lg font-bold text-grafite-900">{i.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}

// ── Card do item: texto à esquerda, foto à direita, botão + sobre a foto ──
function CartaoItem({ item, qtd, onAbrir, onAdicionar }) {
  return (
    <div
      className={`${CARTAO} relative flex cursor-pointer items-stretch gap-4 p-3 transition-colors hover:border-ambar-500`}
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAbrir()
        }
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="font-semibold leading-tight text-grafite-900">{item.nome}</p>
        {item.descricao && (
          <p className="mt-1 line-clamp-2 text-sm text-grafite-600/70">{item.descricao}</p>
        )}
        <p className="mt-1.5 font-display font-bold text-cobre-600">
          {item.opcoes.length > 0 && (
            <span className="text-xs uppercase tracking-widest text-grafite-600/60">desde </span>
          )}
          {fmt(item.preco)}
        </p>
      </div>
      <div className="relative shrink-0">
        {item.imagem && (
          <img src={item.imagem} alt="" loading="lazy" className="h-24 w-24 rounded-xl object-cover" />
        )}
        <button
          type="button"
          aria-label={`Adicionar ${item.nome}`}
          onClick={(e) => {
            e.stopPropagation()
            onAdicionar()
          }}
          className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-ambar-500 font-display text-xl font-bold text-grafite-950 shadow-md transition-colors hover:bg-ambar-400"
        >
          +
        </button>
        {qtd > 0 && (
          <span className="absolute -left-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-grafite-900 px-1.5 text-xs font-bold text-creme-50">
            {qtd}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Folha do produto: foto grande, opções (variantes) e quantidade ──
function FolhaItem({ item, carrinho, onFechar, onConfirmar }) {
  const [opcao, setOpcao] = useState(item.opcoes[0] || null)
  const [qtd, setQtd] = useState(1)

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') onFechar()
    }
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [onFechar])

  const chave = item.opcoes.length ? opcao?.chave : item.chave
  const preco = item.opcoes.length ? opcao?.preco || 0 : item.preco
  const jaNoCarrinho = chave ? carrinho[chave] || 0 : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-grafite-950/60 backdrop-blur-sm sm:items-center"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.nome}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-creme-50 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="relative">
          {item.imagem ? (
            <img src={item.imagem} alt="" className="h-48 w-full object-cover sm:rounded-t-3xl" />
          ) : (
            <div className="h-16" />
          )}
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-creme-50/90 text-lg font-bold text-grafite-900 shadow"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">{item.nome}</h2>
          {item.descricao && <p className="mt-2 text-grafite-600">{item.descricao}</p>}

          {item.opcoes.length > 0 && (
            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-cobre-600">Escolhe uma opção</legend>
              <div className="mt-3 space-y-2">
                {item.opcoes.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      opcao?.id === o.id ? 'border-ambar-500 bg-ambar-500/10' : 'border-creme-300 bg-white/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="opcao"
                      checked={opcao?.id === o.id}
                      onChange={() => setOpcao(o)}
                      className="h-4 w-4 accent-ambar-500"
                    />
                    <span className="flex-1 text-grafite-900">{o.nome}</span>
                    <span className="font-display font-bold text-cobre-600">{fmt(o.preco)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {jaNoCarrinho > 0 && (
            <p className="mt-4 text-sm text-grafite-600/70">Já tens {jaNoCarrinho} no carrinho.</p>
          )}

          {/* Ação colada ao fundo da folha: com descrições longas ou muitas
              opções, o botão tem de continuar alcançável sem rolar até ao fim. */}
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center gap-4 border-t border-creme-300 bg-creme-50 px-6 py-4">
            <Contador qtd={qtd} onSub={() => setQtd((q) => Math.max(1, q - 1))} onAdd={() => setQtd((q) => q + 1)} />
            <button
              type="button"
              disabled={!chave}
              onClick={() => onConfirmar(chave, qtd)}
              className={`${BOTAO} flex-1`}
            >
              Adicionar · {fmt(preco * qtd)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Carrinho do desktop ──
function ResumoCarrinho({ linhas, mudar, subtotal, minimo, tipo, abaixoMinimo, onAvancar }) {
  return (
    <div className={`${CARTAO} p-5`}>
      <h2 className="font-display text-lg font-bold uppercase tracking-tight text-grafite-900">O teu pedido</h2>
      {linhas.length === 0 ? (
        <p className="mt-3 text-sm text-grafite-600/70">O carrinho está vazio. Escolhe da ementa ao lado.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-creme-300">
            {linhas.map((l) => (
              <li key={l.chave} className="flex items-center gap-2 py-3">
                <Contador pequeno qtd={l.qtd} onSub={() => mudar(l.chave, -1)} onAdd={() => mudar(l.chave, 1)} />
                <span className="min-w-0 flex-1 truncate text-sm text-grafite-900">{l.nome}</span>
                <span className="text-sm font-semibold text-grafite-900">{fmt(l.preco * l.qtd)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-creme-300 pt-3 font-display text-lg font-bold text-grafite-900">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {tipo === 'entrega' && abaixoMinimo && (
            <div className="mt-3">
              <BarraProgresso subtotal={subtotal} minimo={minimo} />
            </div>
          )}
          <button type="button" onClick={onAvancar} className={`${BOTAO} mt-4 w-full`}>
            Rever pedido →
          </button>
        </>
      )}
    </div>
  )
}

// ── Progresso até ao mínimo de encomenda ──
function BarraProgresso({ subtotal, minimo }) {
  const pct = minimo > 0 ? Math.min(100, (subtotal / minimo) * 100) : 100
  return (
    <div>
      <p className="text-xs text-grafite-600">
        Faltam <strong className="text-grafite-900">{fmt(minimo - subtotal)}</strong> para o mínimo de entrega.
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-creme-300">
        <div className="h-full rounded-full bg-ambar-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Contador de quantidade reutilizável ──
function Contador({ qtd, onSub, onAdd, pequeno }) {
  const tamanho = pequeno ? 'h-7 w-7 text-sm' : 'h-9 w-9'
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Remover um"
        onClick={onSub}
        className={`${tamanho} cursor-pointer rounded-full border border-creme-300 text-grafite-600 transition-colors hover:border-grafite-600`}
      >
        −
      </button>
      <span className={`text-center font-semibold ${pequeno ? 'w-4 text-sm' : 'w-5'}`}>{qtd}</span>
      <button
        type="button"
        aria-label="Adicionar um"
        onClick={onAdd}
        className={`${tamanho} cursor-pointer rounded-full bg-ambar-500 font-bold text-grafite-950 transition-colors hover:bg-ambar-400`}
      >
        +
      </button>
    </div>
  )
}

export default Restaurante
