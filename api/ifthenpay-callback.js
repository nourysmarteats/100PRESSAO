// Callback do IfThenPay — chamado servidor-a-servidor quando um pagamento é
// confirmado (essencial para Multibanco, que é assíncrono; também dispara no
// MB Way). É a fonte de verdade da confirmação. Valida a chave anti-phishing
// e marca a encomenda como paga.
//
// Configurar no backoffice IfThenPay (Callback), com esta URL e placeholders:
//   https://www.100pressao.pt/api/ifthenpay-callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&method=[METHOD]&requestId=[REQUEST_ID]
//
// Requer env var: IFTHENPAY_ANTIPHISHING_KEY (a chave anti-phishing).
import { createClient } from '@supabase/supabase-js'
import { marcarPago } from './_lib/pagamentos.js'

export default async function handler(req, res) {
  const q = req.query || {}
  const chave = q.key || q.chave

  const antiPhishing = process.env.IFTHENPAY_ANTIPHISHING_KEY
  if (!antiPhishing) {
    console.error('IFTHENPAY_ANTIPHISHING_KEY não configurada')
    return res.status(500).send('config missing')
  }
  if (chave !== antiPhishing) {
    return res.status(401).send('unauthorized')
  }

  const orderId = q.orderId || q.order_id || q.id
  if (!orderId || !/^\d+$/.test(String(orderId))) {
    return res.status(400).send('missing/invalid orderId')
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return res.status(500).send('supabase config missing')

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: pedido } = await admin
    .from('orders')
    .select('id, estado_pagamento')
    .eq('numero', Number(orderId))
    .eq('canal', 'online')
    .single()
  if (!pedido) return res.status(404).send('order not found')

  await marcarPago(admin, pedido.id)

  // O IfThenPay só precisa de um 200 para dar o callback como entregue.
  return res.status(200).send('OK')
}
