// Google Analytics 4 com Consent Mode v2 — por defeito tudo bloqueado
// (analytics_storage: 'denied'), só é atualizado para 'granted' depois de o
// visitante aceitar no banner (ver ConsentBanner.jsx). Isto cumpre o RGPD/
// ePrivacy: o gtag.js pode carregar sempre, mas não guarda cookies de
// identificação sem consentimento explícito.
//
// O snippet base (window.dataLayer, gtag(), consent default, carregamento
// do script) fica em index.html — este ficheiro só trata da parte
// dinâmica: atualizar consentimento e disparar page_view por rota (SPA).

export const MEASUREMENT_ID = 'G-KLXQVNJZ5H'
export const CONSENT_KEY = 'cookie-consent-100pressao'

function gtag(...args) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag(...args)
}

export function getStoredConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

// value: 'accepted' | 'declined'
export function setConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    /* localStorage indisponível (modo privado, etc.) — sem persistência,
       mas a sessão atual respeita a escolha na mesma */
  }
  gtag('consent', 'update', {
    analytics_storage: value === 'accepted' ? 'granted' : 'denied',
  })
}

// Reaplica o consentimento já guardado (chamado no arranque da app — o
// gtag() de index.html começa sempre com 'denied' por defeito)
export function applyStoredConsent() {
  const stored = getStoredConsent()
  if (stored === 'accepted') setConsent('accepted')
}

// SPA: o gtag('config', ...) só mede a primeira visualização de página.
// Rotas seguintes (React Router, sem recarregar) têm de ser enviadas à mão.
export function trackPageview(path) {
  gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
