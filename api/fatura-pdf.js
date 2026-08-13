// Recupera o PDF de uma fatura já emitida. Existe porque o Vendus nem sempre
// devolve o endereço do documento no momento da emissão — sem isto, uma fatura
// nossa só se alcançava entrando no backoffice do Vendus.
import { createClient } from '@supabase/supabase-js'
import { obterPdf } from './_lib/faturacao.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não suportado' })

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ erro: 'Sem sessão.' })
  const { data: chamador, error: erroAuth } = await admin.auth.getUser(token)
  if (erroAuth || !chamador?.user) return res.status(401).json({ erro: 'Sessão inválida.' })
  const { data: perfil } = await admin
    .from('perfis')
    .select('ativo')
    .eq('id', chamador.user.id)
    .single()
  if (!perfil?.ativo) return res.status(403).json({ erro: 'Conta inativa.' })

  const { pedido_id } = req.body || {}
  if (!pedido_id) return res.status(400).json({ erro: 'pedido_id em falta.' })

  try {
    return res.status(200).json(await obterPdf(admin, pedido_id))
  } catch (e) {
    return res.status(502).json({ erro: e.message })
  }
}
