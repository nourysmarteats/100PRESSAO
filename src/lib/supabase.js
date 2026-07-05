import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem credenciais válidas (vazias ou placeholders) o cliente fica null e a
// UI mostra o estado de indisponibilidade em vez de rebentar — createClient
// lança se o URL não for válido.
let client = null
if (url?.startsWith('http') && anonKey) {
  try {
    client = createClient(url, anonKey)
  } catch {
    client = null
  }
}

export const supabase = client
