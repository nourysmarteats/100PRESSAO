// Emissão de fatura via Vendus a pedido de um humano — botão no ecrã de Staff
// (ao fechar a conta) e no painel de Faturas (para reemitir o que falhou).
//
// A lógica de emissão vive em api/_lib/faturacao.js, partilhada com a emissão
// automática que ocorre ao confirmar um pagamento online. Aqui fica só o que é
// próprio de um pedido vindo do browser: autenticação, autorização e validação
// da entrada. A chave da API Vendus nunca chega ao browser.
//
// Requer env vars no Vercel: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// VENDUS_API_KEY (as restantes estão documentadas em api/_lib/faturacao.js).
import { createClient } from '@supabase/supabase-js'
import { emitirFatura, registarFalhaFatura } from './_lib/faturacao.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Quem chama tem de ter sessão válida e perfil ativo (staff ou admin —
  // ao contrário de /api/equipa, aqui não é preciso ser admin)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ erro: 'Sem sessão.' })
  const { data: chamador, error: erroAuth } = await admin.auth.getUser(token)
  if (erroAuth || !chamador?.user) {
    return res.status(401).json({ erro: 'Sessão inválida.' })
  }
  const { data: perfilChamador } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', chamador.user.id)
    .single()
  if (!perfilChamador?.ativo) {
    return res.status(403).json({ erro: 'Conta inativa.' })
  }

  const { pedido_id, nif } = req.body || {}
  if (!pedido_id) return res.status(400).json({ erro: 'pedido_id em falta.' })
  if (nif && !/^\d{9}$/.test(nif)) {
    return res.status(400).json({ erro: 'NIF inválido — tem de ter 9 dígitos.' })
  }

  try {
    return res.status(200).json(await emitirFatura(admin, pedido_id, { nif }))
  } catch (e) {
    await registarFalhaFatura(admin, pedido_id, e.message, nif)
    return res.status(502).json({ erro: `Vendus: ${e.message}` })
  }
}
