// Callback do IfThenPay — chamado servidor-a-servidor quando um pagamento é
// confirmado (essencial para Multibanco, que é assíncrono; também dispara no
// MB Way). É a fonte de verdade da confirmação. Valida a chave anti-phishing
// e marca a encomenda como paga.
//
// Configurar no backoffice IfThenPay (Callback). Os placeholders MUDAM com o
// método — ver https://ifthenpay.com/docs/en/guides/callback/:
//
//   Multibanco / MB WAY:
//     .../api/ifthenpay-callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&payment_datetime=[PAYMENT_DATETIME]
//
//   Pay by Link & Pinpay (o nosso gateway: cartão, Google Pay, Apple Pay) —
//   repare-se que aqui é `id`, não `orderId`:
//     .../api/ifthenpay-callback?key=[ANTI_PHISHING_KEY]&id=[ID]&amount=[AMOUNT]&payment_datetime=[PAYMENT_DATETIME]&payment_method=[PAYMENT_METHOD]
//
//   Pix (aqui a chave chama-se anti_phishing_key):
//     .../api/ifthenpay-callback?anti_phishing_key=[ANTI_PHISHING_KEY]&order_id=[ORDER_ID]&amount=[AMOUNT]&payment_datetime=[PAYMENT_DATETIME]
//
// O IfThenPay só considera o callback entregue com HTTP 200; caso contrário
// repete 13 vezes (8 de 5 em 5 min, as restantes de hora a hora).
//
// Requer env var: IFTHENPAY_ANTIPHISHING_KEY (a chave anti-phishing).
import { createClient } from '@supabase/supabase-js'
import { marcarPago } from './_lib/pagamentos.js'

export default async function handler(req, res) {
  const q = req.query || {}
  // O nome do parâmetro da chave muda conforme o método: Multibanco, MB WAY,
  // cartão, carteiras e o gateway usam `key`; Payshop, Pix e débitos directos
  // usam `anti_phishing_key`. Aceitar só um deles dava 401 silencioso.
  const chave = q.key || q.anti_phishing_key || q.chave

  // Rasto de TODOS os callbacks recebidos (sem a chave), porque a alternativa
  // é o silêncio: quando um pagamento não fica confirmado, é impossível
  // distinguir "o callback não chegou" de "chegou e não deu match". A chave
  // anti-phishing é redigida — é um segredo.
  const { key: _k, anti_phishing_key: _a, chave: _c, ...visivel } = q
  console.log('ifthenpay callback recebido', JSON.stringify(visivel))

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
    console.error('callback sem orderId utilizável', JSON.stringify(visivel))
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
  if (!pedido) {
    console.error('callback para encomenda inexistente', { orderId })
    return res.status(404).send('order not found')
  }

  const marcado = await marcarPago(admin, pedido.id)
  console.log('callback processado', {
    orderId,
    metodo: q.payment_method || q.method || q.metodo || null,
    ja_estava_pago: !marcado,
  })

  // O IfThenPay só precisa de um 200 para dar o callback como entregue.
  return res.status(200).send('OK')
}
