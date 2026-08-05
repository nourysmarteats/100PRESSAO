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
//   IFTHENPAY_PIX_KEY          — chave Pix                (formato ITP-000000)
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

  const { pedido_id, telefone, cpf, carteira } = req.body || {}
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

    // O cliente já escolheu no nosso checkout entre cartão, Apple Pay e Google
    // Pay, por isso o gateway abre directamente no método escolhido em vez de
    // voltar a perguntar. `carteira` vazia = cartão, e nesse caso oferecem-se
    // todos os disponíveis (serve também de retrocompatibilidade).
    const DISPONIVEIS = [
      ['CCARD', process.env.IFTHENPAY_CCARD_KEY],
      ['GOOGLE', process.env.IFTHENPAY_GOOGLE_KEY],
      ['APPLE', process.env.IFTHENPAY_APPLE_KEY],
    ].filter(([, k]) => k)

    const so = carteira === 'apple' ? 'APPLE' : carteira === 'google' ? 'GOOGLE' : null
    const escolhidas = so ? DISPONIVEIS.filter(([m]) => m === so) : DISPONIVEIS
    if (so && escolhidas.length === 0) {
      return res.status(500).json({
        erro: `Chave do ${so === 'APPLE' ? 'Apple Pay' : 'Google Pay'} não configurada no Vercel.`,
      })
    }
    // O IfThenPay exige um formato exacto nas chaves: ITP-000000 nos métodos e
    // AAAA-000000 no gateway. Com uma chave fora do formato, a API responde 200
    // e devolve um link — mas o link não tem métodos lá dentro e o cliente vê
    // "não encontrámos os dados para pagamento". Mais vale falhar aqui, com uma
    // mensagem que diz o que corrigir, do que mandar quem quer pagar para uma
    // página morta.
    if (!/^[A-Z]{4}-\d{6}$/.test(gatewayKey)) {
      console.error('IFTHENPAY_GATEWAY_KEY fora do formato AAAA-000000')
      return res.status(500).json({
        erro: 'Configuração de pagamento inválida. Já estamos a tratar disso — usa MB Way ou Multibanco.',
      })
    }
    const malFormadas = escolhidas.filter(([, k]) => !/^[A-Z]{3}-\d{6}$/.test(k)).map(([m]) => m)
    if (malFormadas.length > 0) {
      console.error('Chaves IfThenPay fora do formato ITP-000000:', malFormadas.join(', '))
      return res.status(500).json({
        erro: 'Configuração de pagamento inválida. Já estamos a tratar disso — usa MB Way ou Multibanco.',
      })
    }

    const contas = escolhidas.map(([m, k]) => `${m}|${k}`).join(';')
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
        // Nomes em snake_case — é o que a API espera. Em camelCase são
        // silenciosamente ignorados e o cliente nunca regressa ao site.
        success_url: volta('ok'),
        error_url: volta('erro'),
        cancel_url: volta('cancelado'),
        // Link de uso único: evita que a mesma ligação possa ser paga duas vezes.
        otp: 'true',
        lang: 'pt',
      }),
    })
    const j = await r.json().catch(() => ({}))

    console.log('gateway iniciado', {
      encomenda: orderId,
      metodos: escolhidas.map(([m]) => m).join(','),
      pin: j.PinCode || null,
    })

    // A resposta traz três campos: RedirectUrl (a página de pagamento online),
    // PinpayUrl (o serviço PINPAY, por código PIN, para vendas ao telefone) e
    // PinCode. Para o cliente pagar no site é o RedirectUrl — o PinpayUrl leva
    // a uma página que não sabe resolver o pagamento e mostra "dados não
    // encontrados".
    const paymentUrl = j.RedirectUrl || j.redirectUrl
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

  // ── Pix: pagamento instantâneo brasileiro ──
  //
  // Serve a comunidade brasileira que a casa já atrai. Tem exigências que os
  // métodos portugueses não têm: o IfThenPay obriga a CPF, nome, email e
  // telemóvel do cliente, e o telemóvel vai no formato indicativo#numero.
  //
  // ATENÇÃO À MOEDA: o Pix liquida em reais. Enquanto não estiver confirmado
  // com o IfThenPay se o `amount` vai em euros (convertido por eles) ou já em
  // BRL, este método não deve ser ligado — enviar euros num campo esperado em
  // reais cobraria cerca de um sexto do preço.
  if (metodo === 'pix') {
    const key = process.env.IFTHENPAY_PIX_KEY
    if (!key) return res.status(500).json({ erro: 'IFTHENPAY_PIX_KEY não configurada no Vercel.' })

    const cpfLimpo = String(cpf || '').replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ erro: 'CPF inválido. São 11 dígitos.' })
    }
    const cpfFormatado = `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`

    const tel = String(telefone || pedido.cliente_telefone || '').replace(/\D/g, '').slice(-9)
    if (!/^\d{9}$/.test(tel)) return res.status(400).json({ erro: 'Telemóvel inválido.' })

    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0]
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const base = process.env.SITE_URL || `${proto}://${host}`

    const r = await fetch(`${IFT}/pix/init/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount,
        customerCPF: cpfFormatado,
        customerName: (pedido.cliente_nome || 'Cliente').slice(0, 150),
        customerEmail: pedido.cliente_email || '',
        customerPhone: `351#${tel}`,
        redirectUrl: `${base}/restaurante?pedido=${encodeURIComponent(pedido.id)}&pag=ok`,
        description: `100PRESSAO #${orderId}`,
      }),
    })
    const j = await r.json().catch(() => ({}))
    // Neste endpoint a chave do estado vem em minúsculas ("status"), ao
    // contrário do MB Way e do Multibanco.
    const paymentUrl = j.paymentUrl || j.PaymentUrl
    if (!r.ok || String(j.status ?? j.Status ?? '') !== '0' || !paymentUrl) {
      console.error('IfThenPay Pix init', r.status, JSON.stringify(j))
      return res.status(502).json({ erro: j.message || j.Message || 'Não foi possível iniciar o Pix.' })
    }
    await admin
      .from('orders')
      .update({ pagamento_id: j.requestId || j.RequestId || null })
      .eq('id', pedido.id)
    return res.status(200).json({ metodo: 'pix', paymentUrl })
  }

  return res.status(400).json({ erro: 'Método de pagamento não suportado nesta fase.' })
}
