import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem credenciais válidas (vazias ou placeholders) o cliente fica null e a
// UI mostra o estado de indisponibilidade em vez de rebentar — createClient
// lança se o URL não for válido.
let client = null
let clientPublico = null
if (url?.startsWith('http') && anonKey) {
  try {
    // Em /empresa e /estafeta quem lê o link de entrada (#access_token) é o cliente
    // isolado dessas páginas; o cliente da equipa não o pode apanhar primeiro.
    const paginaExterna =
      typeof window !== 'undefined' && /^\/(empresa|estafeta)(\/|$)/.test(window.location.pathname)
    client = createClient(url, anonKey, { auth: { detectSessionInUrl: !paginaExterna } })
    // Cliente para páginas públicas (/cardapio, /ecran): sem persistência
    // nem refresh de sessão. Evita que a sessão de staff guardada no mesmo
    // browser interfira (o refresh de token do supabase-js pode bloquear
    // pedidos numa página que nem precisa de auth).
    clientPublico = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-publico',
      },
    })
  } catch {
    client = null
    clientPublico = null
  }
}

export const supabase = client
export const supabasePublico = clientPublico

// Sessões de quem NÃO é da equipa, cada uma na sua gaveta (storageKey própria):
// uma empresa ou um estafeta com sessão aberta no mesmo browser nunca se mistura
// com a sessão de staff, nem o contrário.
function clienteIsolado(storageKey, lerLinkDeEntrada) {
  if (!url?.startsWith('http') || !anonKey) return null
  try {
    return createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: lerLinkDeEntrada, storageKey },
    })
  } catch {
    return null
  }
}
const emBrowser = typeof window !== 'undefined'
// Só o cliente da empresa lê o link de entrada do email, e só em /empresa.
export const supabaseEmpresa = emBrowser
  ? clienteIsolado('sb-empresa', /^\/empresa(\/|$)/.test(window.location.pathname))
  : null
export const supabaseEstafeta = emBrowser ? clienteIsolado('sb-estafeta', false) : null
