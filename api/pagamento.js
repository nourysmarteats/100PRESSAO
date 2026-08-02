// Inicia o pagamento de uma encomenda do Restaurante Online via IfThenPay.
// A chave do IfThenPay só existe aqui, nunca chega ao browser. O valor a
// cobrar é SEMPRE lido da encomenda na base de dados (nunca vem do browser).
// Requer env vars no Vercel:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (já existem)
//   IFTHENPAY_MBWAY_KEY        — chave MB WAY do backoffice IfThenPay
//   IFTHENPAY_MULTIBANCO_KEY   — chave Multibanco (MB) do backoffice IfThenPay
//   IFTHENPAY_CCARD_KEY        — chave Cartão de Crédito (só depois de contratado)
//   SITE_URL (opcional)        — base dos URLs de retorno do cartão; por
//                                omissão usa o domínio do próprio pedido
import { createClient } from '@supabase/supabase-js'

const IFT = 'https://api.ifthenpay.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }

  const { pedido_id, telefone } = req.body || {}
  if (!pedido_id) return res.status(400).json({ erro: 'pedido_id em falta.' })

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Encomenda lida no servidor — o total autoritativo vem daqui, nunca do browser.
  const { data: pedido, error } = await admin
    .from('orders')
    .select('id, numero, total, metodo_pagamento, estado_pagamento, cliente_email, cliente_telefone, canal')
    .eq('id', pedido_id)
    .single()
  if (error || !pedido) return res.status(404).json({ erro: 'Encomenda não encontrada.' })
  if (pedido.canal !== 'online') return res.status(400).json({ erro: 'Encomenda inválida.' })
  if (pedido.estado_pagamento === 'pago') return res.status(200).json({ ja_pago: true })

  const amount = Number(pedido.total).toFixed(2)
  const orderId = String(pedido.numero)
  const metodo = pedido.metodo_pagamento

  // ── MB WAY: pedido de pagamento push para o telemóvel ──
  if (metodo === 'mbway') {
    const key = process.env.IFTHENPAY_MBWAY_KEY
    if (!key) return res.status(500).json({ erro: 'IFTHENPAY_MBWAY_KEY não configurada no Vercel.' })
    const tel = String(telefone || pedido.cliente_telefone || '').replace(/\D/g, '').slice(-9)
    if (!/^\d{9}$/.test(tel)) return res.status(400).json({ erro: 'Telemóvel inválido para MB Way.' })

    const r = await fetch(`${IFT}/spg/payment/mbway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mbWayKey: key,
        orderId,
        amount,
        mobileNumber: `351#${tel}`,
        email: pedido.cliente_email || '',
        description: `100PRESSAO #${orderId}`,
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.Status !== '000') {
      console.error('IfThenPay MB Way init', r.status, JSON.stringify(j))
      return res.status(502).json({ erro: j.Message || 'Não foi possível iniciar o MB Way.' })
    }
    await admin.from('orders').update({ pagamento_id: j.RequestId }).eq('id', pedido.id)
    return res.status(200).json({ metodo: 'mbway', requestId: j.RequestId })
  }

  // ── Multibanco: gera referência; pagamento confirma por callback ──
  if (metodo === 'multibanco') {
    const key = process.env.IFTHENPAY_MULTIBANCO_KEY
    if (!key) return res.status(500).json({ erro: 'IFTHENPAY_MULTIBANCO_KEY não configurada no Vercel.' })

    const r = await fetch(`${IFT}/multibanco/reference/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mbKey: key, orderId, amount, description: `100PRESSAO #${orderId}` }),
    })
    const j = await r.json().catch(() => ({}))
    const entidade = j.Entity || j.Entidade
    const referencia = j.Reference || j.Referencia
    if (!r.ok || !entidade || !referencia) {
      console.error('IfThenPay Multibanco init', r.status, JSON.stringify(j))
      return res.status(502).json({ erro: j.Message || 'Não foi possível gerar a referência Multibanco.' })
    }
    const ref = { entidade, referencia, valor: amount }
    await admin
      .from('orders')
      .update({ pagamento_ref: ref, pagamento_id: j.RequestId || null })
      .eq('id', pedido.id)
    return res.status(200).json({ metodo: 'multibanco', ...ref })
  }

  // ── Cartão de crédito/débito: página alojada do IfThenPay ──
  //
  // Ao contrário do MB Way e do Multibanco, o cartão é um fluxo de
  // REDIRECIONAMENTO: devolvemos um PaymentUrl, o cliente vai introduzir os
  // dados do cartão na página do IfThenPay e volta ao site. Os dados do cartão
  // nunca passam por este servidor nem pelo browser do nosso site — é o
  // IfThenPay que os recolhe, no domínio deles.
  //
  // O successUrl NÃO confirma o pagamento: é só para onde o cliente é enviado
  // de volta e qualquer pessoa lhe pode aceder à mão. Quem marca a encomenda
  // como paga continua a ser o callback servidor-a-servidor
  // (api/ifthenpay-callback.js), que é a fonte de verdade. O ecrã de retorno
  // limita-se a fazer polling até o callback ter chegado.
  if (metodo === 'cartao') {
    const key = process.env.IFTHENPAY_CCARD_KEY
    if (!key) {
      return res.status(500).json({ erro: 'IFTHENPAY_CCARD_KEY não configurada no Vercel.' })
    }

    // Base do site a partir do pedido: é o domínio onde o cliente está.
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const base = process.env.SITE_URL || `${proto}://${host}`
    const volta = (estado) =>
      `${base}/restaurante?pedido=${encodeURIComponent(pedido.id)}&pag=${estado}`

    const r = await fetch(`https://ifthenpay.com/api/creditcard/init/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId, // numero da encomenda (máx. 15 alfanuméricos)
        amount,
        successUrl: volta('ok'),
        errorUrl: volta('erro'),
        cancelUrl: volta('cancelado'),
        language: 'pt',
      }),
    })
    const j = await r.json().catch(() => ({}))
    const paymentUrl = j.PaymentUrl || j.paymentUrl
    // Neste endpoint, Status "0" = pedido aceite (difere do MB Way, que usa "000").
    if (!r.ok || String(j.Status ?? '') !== '0' || !paymentUrl) {
      console.error('IfThenPay cartão init', r.status, JSON.stringify(j))
      return res.status(502).json({ erro: j.Message || 'Não foi possível iniciar o pagamento por cartão.' })
    }
    await admin
      .from('orders')
      .update({ pagamento_id: j.RequestId || null })
      .eq('id', pedido.id)
    return res.status(200).json({ metodo: 'cartao', paymentUrl })
  }

  return res.status(400).json({ erro: 'Método de pagamento não suportado nesta fase.' })
}
