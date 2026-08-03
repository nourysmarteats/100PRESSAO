// Inicia o pagamento de uma encomenda do Restaurante Online via IfThenPay.
// A chave do IfThenPay só existe aqui, nunca chega ao browser. O valor a
// cobrar é SEMPRE lido da encomenda na base de dados (nunca vem do browser).
// Requer env vars no Vercel:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (já existem)
//   IFTHENPAY_MBWAY_KEY        — chave MB WAY do backoffice IfThenPay
//   IFTHENPAY_MULTIBANCO_KEY   — chave Multibanco (MB) do backoffice IfThenPay
//   IFTHENPAY_GATEWAY_KEY      — chave do gateway (formato AAAA-000000), usada
//                                por cartão, Google Pay e Apple Pay
//   IFTHENPAY_CCARD_KEY        — chave Cartão de Crédito   (formato ITP-000000)
//   IFTHENPAY_GOOGLE_KEY       — chave Google Pay          (formato ITP-000000)
//   IFTHENPAY_APPLE_KEY        — chave Apple Pay           (formato ITP-000000)
//   SITE_URL (opcional)        — base dos URLs de retorno; por omissão usa o
//                                domínio do próprio pedido
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

  // ── Cartão / Google Pay / Apple Pay: gateway alojado do IfThenPay ──
  //
  // Google Pay e Apple Pay NÃO têm endpoint próprio: a documentação oficial
  // encaminha-os para a API Pay by Link & Pinpay (o gateway), declarando os
  // métodos aceites em `accounts`. Como o cartão também cabe aí, os três
  // partilham um só caminho — o cliente escolhe na página do IfThenPay, que
  // mostra Apple Pay ou Google Pay só nos dispositivos compatíveis.
  //
  // É um fluxo de REDIRECIONAMENTO: devolvemos um URL, o cliente paga no
  // domínio do IfThenPay e volta. Os dados do cartão ou da carteira nunca
  // passam por este servidor nem pelo browser do nosso site.
  //
  // O successUrl NÃO confirma o pagamento: é só para onde o cliente é enviado
  // de volta e qualquer pessoa lhe pode aceder à mão. Quem marca a encomenda
  // como paga continua a ser o callback servidor-a-servidor
  // (api/ifthenpay-callback.js), que é a fonte de verdade. O ecrã de retorno
  // limita-se a fazer polling até o callback ter chegado.
  if (metodo === 'cartao') {
    const gatewayKey = process.env.IFTHENPAY_GATEWAY_KEY
    if (!gatewayKey) {
      return res.status(500).json({ erro: 'IFTHENPAY_GATEWAY_KEY não configurada no Vercel.' })
    }

    // Só entram no `accounts` os métodos com chave configurada — assim o
    // gateway nunca oferece uma carteira que a conta ainda não tem.
    const contas = [
      ['CCARD', process.env.IFTHENPAY_CCARD_KEY],
      ['GOOGLE', process.env.IFTHENPAY_GOOGLE_KEY],
      ['APPLE', process.env.IFTHENPAY_APPLE_KEY],
    ]
      .filter(([, k]) => k)
      .map(([m, k]) => `${m}|${k}`)
      .join(';')
    if (!contas) {
      return res.status(500).json({
        erro: 'Nenhuma chave de cartão/carteira configurada no Vercel (CCARD, GOOGLE ou APPLE).',
      })
    }

    // Base do site a partir do pedido: é o domínio onde o cliente está.
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const base = process.env.SITE_URL || `${proto}://${host}`
    const volta = (estado) =>
      `${base}/restaurante?pedido=${encodeURIComponent(pedido.id)}&pag=${estado}`

    const r = await fetch(`${IFT}/gateway/pinpay/${encodeURIComponent(gatewayKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderId, // o gateway usa `id`, não `orderId`
        amount,
        description: `100PRESSAO #${orderId}`,
        accounts: contas,
        successUrl: volta('ok'),
        errorUrl: volta('erro'),
        cancelUrl: volta('cancelado'),
        // Link de uso único: evita que a mesma ligação possa ser paga duas vezes.
        otp: 'true',
        language: 'pt',
      }),
    })
    const j = await r.json().catch(() => ({}))
    const paymentUrl = j.PinpayUrl || j.pinpayUrl || j.PaymentUrl
    if (!r.ok || !paymentUrl) {
      console.error('IfThenPay gateway init', r.status, JSON.stringify(j))
      return res.status(502).json({ erro: j.Message || 'Não foi possível iniciar o pagamento.' })
    }
    await admin
      .from('orders')
      .update({ pagamento_id: j.RequestId || j.PinCode || null })
      .eq('id', pedido.id)
    return res.status(200).json({ metodo: 'cartao', paymentUrl })
  }

  return res.status(400).json({ erro: 'Método de pagamento não suportado nesta fase.' })
}
