// Helpers da área da equipa: PIN pessoal, operador de turno, auditoria e
// chamadas à função de servidor de gestão de contas.
import { createContext, useContext } from 'react'
import { supabase } from './supabase'

export const OPERADOR_KEY = 'operador_turno'

// Contexto com o perfil da conta autenticada ({ papel, nome, ... } | null)
export const PerfilContext = createContext(null)
export const usePerfil = () => useContext(PerfilContext)

// Mesmo formato do hash gerado no servidor: sha256("<user_id>:<pin>")
export async function hashPin(userId, pin) {
  const dados = new TextEncoder().encode(`${userId}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', dados)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function operadorAtual() {
  try {
    return JSON.parse(sessionStorage.getItem(OPERADOR_KEY))
  } catch {
    return null
  }
}

export function definirOperador(operador) {
  if (operador) sessionStorage.setItem(OPERADOR_KEY, JSON.stringify(operador))
  else sessionStorage.removeItem(OPERADOR_KEY)
}

// Auditoria: regista quem (conta + operador de turno) fez o quê. Nunca
// bloqueia a operação principal — falha em silêncio se a tabela não existir.
export async function registarAuditoria(acao, detalhe = null) {
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    await supabase.from('audit_log').insert({
      user_id: user?.id || null,
      email: user?.email || null,
      operador: operadorAtual()?.nome || null,
      acao,
      detalhe,
    })
  } catch {
    /* sem auditoria disponível */
  }
}

// Ações de gestão de contas — passam pela Vercel Function (service role)
export async function chamarApiEquipa(corpo) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  const resp = await fetch('/api/equipa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json.erro || 'Erro no servidor.')
  return json
}
