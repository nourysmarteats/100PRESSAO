// Medição e publicidade com consentimento por finalidade (RGPD + ePrivacy,
// Lei 41/2004 art. 5.º). Duas finalidades, cada uma com o seu interruptor:
//
//   analise     → Google Analytics 4 (Consent Mode v2; o gtag.js carrega
//                 sempre a partir de index.html, mas arranca em 'denied')
//   publicidade → Pixel da Meta e Pixel do TikTok. Estes NÃO têm modo
//                 "denied": o script nem sequer é carregado sem consentimento.
//
// Nenhum dado pessoal (nome, email, telemóvel, morada) é enviado aos pixels:
// não se usa "advanced matching". Só eventos e valores de encomenda.
//
// Os IDs dos pixels vêm de variáveis de ambiente (Vercel). Sem ID, o pixel
// respectivo simplesmente não existe — pode publicar-se já sem IDs.

export const MEASUREMENT_ID = 'G-KLXQVNJZ5H'

// v2: as finalidades mudaram (entrou a publicidade), por isso quem aceitou
// só a análise na versão anterior volta a ver o aviso. A chave antiga é
// ignorada de propósito — consentimento dado para uma finalidade não vale
// para outra.
export const CONSENT_KEY = 'cookie-consent-100pressao-v2'
export const CONSENT_VERSAO = 2
export const EVENTO_ABRIR_CONSENTIMENTO = '100pressao:abrir-consentimento'

const META_PIXEL_ID = import.meta.env?.VITE_META_PIXEL_ID || ''
const TIKTOK_PIXEL_ID = import.meta.env?.VITE_TIKTOK_PIXEL_ID || ''

const noBrowser = () => typeof window !== 'undefined'

function gtag(...args) {
  if (!noBrowser() || typeof window.gtag !== 'function') return
  window.gtag(...args)
}

// Lê o valor guardado e devolve { analise, publicidade } ou null (sem
// escolha válida → mostrar aviso). Função pura, testada em analytics.test.mjs.
export function lerConsentimento(bruto) {
  if (!bruto) return null
  try {
    const c = JSON.parse(bruto)
    if (!c || c.v !== CONSENT_VERSAO) return null
    return { analise: c.analise === true, publicidade: c.publicidade === true }
  } catch {
    return null
  }
}

export function getStoredConsent() {
  try {
    return lerConsentimento(localStorage.getItem(CONSENT_KEY))
  } catch {
    return null
  }
}

let publicidadeAtiva = false

// escolha: { analise: boolean, publicidade: boolean }
export function setConsent(escolha) {
  const anterior = getStoredConsent()
  const c = { analise: escolha.analise === true, publicidade: escolha.publicidade === true }
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: CONSENT_VERSAO, ...c, em: new Date().toISOString() }),
    )
  } catch {
    /* localStorage indisponível — a sessão atual respeita a escolha na mesma */
  }
  aplicar(c)
  // Retirar a publicidade depois de a ter dado: os scripts já carregados não
  // se "descarregam", por isso recarrega-se a página para ficarem de fora.
  if (anterior?.publicidade && !c.publicidade && noBrowser()) window.location.reload()
}

function aplicar(c) {
  gtag('consent', 'update', { analytics_storage: c.analise ? 'granted' : 'denied' })
  if (c.publicidade) ativarPublicidade()
}

// Reaplica o consentimento já guardado (arranque da app).
export function applyStoredConsent() {
  const c = getStoredConsent()
  if (c) aplicar(c)
}

export function abrirPreferencias() {
  if (noBrowser()) window.dispatchEvent(new Event(EVENTO_ABRIR_CONSENTIMENTO))
}

// ── Pixels (só chamados depois de consentimento de publicidade) ──

function carregarMeta(id) {
  if (window.fbq) return
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
    if (!f._fbq) f._fbq = n
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []
    t = b.createElement(e); t.async = !0; t.src = v
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', id)
  window.fbq('track', 'PageView')
}

function carregarTikTok(id) {
  if (window.ttq) return
  /* eslint-disable */
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t
    var ttq = (w[t] = w[t] || [])
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
    ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i])
    ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e }
    ttq.load = function (e, n) {
      var r = 'https://analytics.tiktok.com/i18n/pixel/events.js'
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date()
      ttq._o = ttq._o || {}; ttq._o[e] = n || {}
      var s = d.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = r + '?sdkid=' + e + '&lib=' + t
      var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(s, a)
    }
  })(window, document, 'ttq')
  /* eslint-enable */
  window.ttq.load(id)
  window.ttq.page()
}

function ativarPublicidade() {
  if (!noBrowser() || publicidadeAtiva) return
  publicidadeAtiva = true
  if (META_PIXEL_ID) carregarMeta(META_PIXEL_ID)
  if (TIKTOK_PIXEL_ID) carregarTikTok(TIKTOK_PIXEL_ID)
}

// ── Eventos ──

// SPA: o gtag('config', ...) só mede a primeira página; as rotas seguintes
// são enviadas à mão. Os pixels também (a primeira PageView sai no load).
let primeiraPagina = true
export function trackPageview(path) {
  gtag('event', 'page_view', {
    page_path: path.split('#')[0],
    page_location: window.location.href.split('#')[0],
    page_title: document.title,
  })
  if (primeiraPagina) {
    primeiraPagina = false
    return
  }
  if (!publicidadeAtiva) return
  window.fbq?.('track', 'PageView')
  window.ttq?.page?.()
}

// Nomes normalizados → nome em cada plataforma.
const MAPA = {
  ver_ementa: { meta: 'ViewContent', tiktok: 'ViewContent', ga: 'view_item_list' },
  adicionar_carrinho: { meta: 'AddToCart', tiktok: 'AddToCart', ga: 'add_to_cart' },
  iniciar_checkout: { meta: 'InitiateCheckout', tiktok: 'InitiateCheckout', ga: 'begin_checkout' },
  compra: { meta: 'Purchase', tiktok: 'CompletePayment', ga: 'purchase' },
  // Inscrição beta concluída. Sem idEvento de propósito: o número de beta
  // tester identifica a pessoa e não sai para as plataformas.
  inscricao_beta: { meta: 'CompleteRegistration', tiktok: 'CompleteRegistration', ga: 'sign_up' },
}

// dados: { valor?, idEvento? } — valor em euros. idEvento serve para
// deduplicar (p.ex. o id da encomenda, se o ecrã de confirmação renderizar 2x).
export function trackEvento(nome, dados = {}) {
  const m = MAPA[nome]
  if (!m || !noBrowser()) return
  const valor = Number.isFinite(Number(dados.valor)) ? Number(dados.valor) : undefined
  const params = valor != null ? { value: valor, currency: 'EUR' } : {}
  gtag('event', m.ga, { ...params, ...(dados.idEvento ? { transaction_id: dados.idEvento } : {}) })
  if (!publicidadeAtiva) return
  window.fbq?.('track', m.meta, params, dados.idEvento ? { eventID: String(dados.idEvento) } : undefined)
  window.ttq?.track?.(m.tiktok, params, dados.idEvento ? { event_id: String(dados.idEvento) } : undefined)
}
