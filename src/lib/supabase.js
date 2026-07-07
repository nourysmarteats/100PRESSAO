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
    client = createClient(url, anonKey)
    // Cliente para páginas públicas (/cardapio, /ecran): sem persistência
    // nem refresh de sessão. Evita que a sessão de staff guardada no mesmo
    // browser interfira (o refresh de token do supabase-js pode bloquear
    // pedidos numa página que nem precisa de auth).
    clientPublico = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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
