// Estado do pagamento de uma encomenda online — usado pelo browser para
// saber quando o MB Way foi confirmado (faz polling a este endpoint). Lê o
// estado na nossa base de dados; se ainda estiver pendente e for MB Way,
// pergunta ao IfThenPay como salvaguarda (caso o callback ainda não tenha
// chegado). A confirmação é idempotente (ver marcarPago).
import { createClient } from '@supabase/supabase-js'
import { marcarPago } from './_lib/pagamentos.js'

const IFT = 'https://api.ifthenpay.com'

export default async function handler(req, res) {
  const pedido_id = req.query?.pedido_id || req.body?.pedido_id
  if (!pedido_id) return res.status(400).json({ erro: 'pedido_id em falta.' })

  // Regresso do gateway com erro ou cancelamento: o browser reenvia os
  // parâmetros que o IfThenPay lhe pôs no URL. É a única pista sobre a causa
  // da falha, que de outro modo se perderia no cliente.
  if (req.query?.retorno) {
    console.log('regresso do gateway', {
      pedido_id,
      parametros: String(req.query.retorno).slice(0, 500),
    })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return res.status(500).json({ erro: 'Configuração do Supabase em falta.' })

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pedido } = await admin
    .from('orders')
    .select('id, numero, total, estado_pagamento, metodo_pagamento, pagamento_id')
    .eq('id', pedido_id)
    .single()
  if (!pedido) return res.status(404).json({ erro: 'Encomenda não encontrada.' })

  // Número e total acompanham a resposta: quem volta da página de cartão do
  // IfThenPay perdeu o estado do React e precisa deles para o ecrã final.
  // Não são dados sensíveis e só saem para quem já tem o UUID da encomenda.
  const dados = { numero: pedido.numero, total: pedido.total }

  if (pedido.estado_pagamento === 'pago') return res.status(200).json({ pago: true, ...dados })

  // Salvaguarda MB Way: pergunta diretamente ao IfThenPay.
  if (pedido.metodo_pagamento === 'mbway' && pedido.pagamento_id) {
    const key = process.env.IFTHENPAY_MBWAY_KEY
    if (key) {
      try {
        const r = await fetch(
          `${IFT}/spg/payment/mbway/status?mbWayKey=${encodeURIComponent(key)}&requestId=${encodeURIComponent(
            pedido.pagamento_id,
          )}`,
        )
        const j = await r.json().catch(() => ({}))
        // No endpoint de STATUS do MB Way, Status "000" = pago.
        if (j.Status === '000') {
          await marcarPago(admin, pedido.id)
          return res.status(200).json({ pago: true, ...dados })
        }
      } catch {
        /* mantém pendente */
      }
    }
  }

  return res.status(200).json({ pago: false, ...dados })
}
