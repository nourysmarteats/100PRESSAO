// Notificações push do despacho de entregas (Web Push, gratuito) — decisão D14 da ata de 2026-10-12.
//
//   acao "oferta"        → avisa os estafetas a quem uma entrega acabou de ser oferecida;
//   acao "sem-estafeta"  → avisa os admins de que ninguém aceitou uma entrega a tempo (D11).
//
// Quem chama tem de ser da equipa (sessão de staff). O conteúdo da notificação nunca leva
// dados do cliente: só "há uma entrega" e o número — o resto vê-se dentro da app.
//
// Env na Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (gerados com `npx web-push generate-vapid-keys`),
// e a mesma chave pública em VITE_VAPID_PUBLIC_KEY para o browser.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } }

async function enviar(admin, userIds, payload) {
  if (!userIds.length) return 0
  const { data: subs } = await admin.from('push_subscricoes').select('id, endpoint, p256dh, auth').in('user_id', userIds)
  let n = 0
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 120, urgency: 'high' },
      )
      n++
    } catch (e) {
      // 404/410: a subscrição morreu (app desinstalada, permissão retirada) — limpa-se.
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('push_subscricoes').delete().eq('id', s.id)
    }
  }
  return n
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não suportado' })
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!url || !serviceKey) return res.status(500).json({ erro: 'Configuração do servidor em falta.' })
  if (!pub || !priv) return res.status(200).json({ enviadas: 0, aviso: 'Notificações ainda não configuradas (chaves VAPID).' })
  webpush.setVapidDetails('mailto:geral@100pressao.pt', pub, priv)

  const admin = createClient(url, serviceKey, opcoes)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ erro: 'Sem sessão.' })
  const { data: chamador } = await admin.auth.getUser(token)
  if (!chamador?.user) return res.status(401).json({ erro: 'Sessão inválida.' })
  const { data: perfil } = await admin.from('perfis').select('ativo').eq('id', chamador.user.id).single()
  if (!perfil?.ativo) return res.status(403).json({ erro: 'Reservado à equipa.' })

  const { acao, order_id: orderId } = req.body || {}
  const { data: pedido } = await admin.from('orders').select('id, numero, entrega_estado').eq('id', orderId).single()
  if (!pedido) return res.status(404).json({ erro: 'Encomenda não encontrada.' })

  try {
    if (acao === 'oferta') {
      const { data: ofertas } = await admin
        .from('entregas_ofertas')
        .select('estafetas ( user_id )')
        .eq('order_id', orderId)
        .eq('estado', 'oferecida')
      const ids = (ofertas || []).map((o) => o.estafetas?.user_id).filter(Boolean)
      const enviadas = await enviar(admin, ids, {
        titulo: 'Nova entrega 100PRESSÃO',
        corpo: 'Há uma entrega para recolher. Abre a app para aceitar ou recusar.',
        url: '/estafeta',
        etiqueta: `oferta-${pedido.numero}`,
      })
      return res.status(200).json({ enviadas })
    }

    if (acao === 'sem-estafeta') {
      if (pedido.entrega_estado !== 'sem_estafeta') return res.status(200).json({ enviadas: 0 })
      // Um alerta por encomenda, mesmo com vários ecrãs de Staff abertos.
      const { count } = await admin
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('acao', 'alerta_sem_estafeta')
        .eq('detalhe->>order_id', orderId)
        .gte('criado_em', new Date(Date.now() - 15 * 60000).toISOString())
      if (count) return res.status(200).json({ enviadas: 0, repetido: true })
      await admin.from('audit_log').insert({ acao: 'alerta_sem_estafeta', detalhe: { order_id: orderId } })
      const { data: admins } = await admin.from('perfis').select('id').eq('papel', 'admin').eq('ativo', true)
      const enviadas = await enviar(admin, (admins || []).map((a) => a.id), {
        titulo: `Entrega n.º ${pedido.numero} sem estafeta`,
        corpo: 'Ninguém aceitou a tempo. Abre o Staff para chamar de novo.',
        url: '/staff',
        etiqueta: `sem-estafeta-${pedido.numero}`,
      })
      return res.status(200).json({ enviadas })
    }

    return res.status(400).json({ erro: 'Ação desconhecida.' })
  } catch (e) {
    console.error('push-despacho', e?.message || e)
    return res.status(500).json({ erro: 'Erro interno.' })
  }
}
