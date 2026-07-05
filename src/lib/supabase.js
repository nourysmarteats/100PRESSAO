import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sem credenciais (ex.: ambiente ainda não configurado) o cliente fica null
// e a UI mostra o estado de indisponibilidade em vez de rebentar.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
