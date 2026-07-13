// Emissão de fatura via Vendus — botão "Emitir Fatura" no ecrã de Staff,
// só quando o cliente pede (opção 2 do Daniel: sob pedido, não automático
// em todos os pedidos). A chave da API Vendus só existe aqui, nunca chega
// ao browser. Requer env vars no Vercel:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (já existem)
//   VENDUS_API_KEY        — gerar em Vendus: Configuração > Utilizadores > API
//   VENDUS_MODE           — 'tests' (default, seguro) ou 'normal' (real).
//                           Só mudar para 'normal' depois de validar que a
//                           integração está correta — em 'tests' o Vendus
//                           não emite documentos fiscais verdadeiros.
//   VENDUS_REGISTER_ID    — opcional, só se a conta tiver mais do que um POS.
import { createClient } from '@supabase/supabase-js'

const VENDUS_BASE = 'https://www.vendus.pt/ws/v1.1'

// Produtos/combos de 100PRESSÃO ainda não estão sincronizados com o
// catálogo do Vendus, por isso cada item vai "avulso" (só por título).
// tax_id por defeito 'NOR' (taxa normal, 23%) — CONFIRMAR com a
// contabilista se algum produto deve ter taxa reduzida antes de ligar
// isto a sério (VENDUS_MODE=normal).
const TAX_ID_DEFAULT = 'NOR'

// Método de pagamento interno → "type" oficial do Vendus. Os IDs de cada
// método são específicos da conta, por isso vão-se buscar à API em vez de
// serem fixos aqui.
const TIPO_VENDUS_POR_METODO = {
  dinheiro: 'NU',
  multibanco: 'MB',
  mbway: 'MBWAY',
  cartao: 'CD',
}

function nomeItem(item) {
  if (item.combos?.nome) return `Combo ${item.combos.nome}`
  const variante = item.product_variants?.nome ? ` ${item.product_variants.nome}` : ''
  return `${item.products?.nome || 'Artigo'}${variante}`
}

async function vendusFetch(path, apiKey, options = {}) {
  const resp = await fetch(`${VENDUS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    // Log completo no servidor — o erro que chega ao browser é só um
    // resumo, isto fica nos Vercel Logs para diagnóstico
    console.error(`Vendus ${options.method || 'GET'} ${path} -> ${resp.status}`, JSON.stringify(json))
    const msg = json?.error || json?.message || `Vendus respondeu ${resp.status}`
    throw new Error(msg)
  }
  return json
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vendusKey = process.env.VENDUS_API_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }
  if (!vendusKey) {
    return res.status(500).json({
      erro: 'VENDUS_API_KEY não configurada no Vercel (Settings → Environment Variables).',
    })
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

  // Busca o pedido completo no servidor — nunca confiar em totais vindos
  // do browser para um documento fiscal
  const { data: pedido, error: erroPedido } = await admin
    .from('orders')
    .select(`*, order_items ( *, products ( nome ), product_variants ( nome ), combos ( nome ) )`)
    .eq('id', pedido_id)
    .single()
  if (erroPedido || !pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' })

  if (pedido.fatura_documento_id) {
    // Já foi emitida — devolve a existente em vez de duplicar
    return res.status(200).json({
      ok: true,
      ja_existia: true,
      documento_id: pedido.fatura_documento_id,
      numero: pedido.fatura_documento_numero,
      url: pedido.fatura_url,
    })
  }

  if (pedido.estado !== 'entregue' || !pedido.metodo_pagamento) {
    return res.status(400).json({ erro: 'O pedido ainda não está marcado como pago.' })
  }

  const tipoVendus = TIPO_VENDUS_POR_METODO[pedido.metodo_pagamento]
  if (!tipoVendus) {
    return res
      .status(400)
      .json({ erro: `Método de pagamento sem mapeamento Vendus: ${pedido.metodo_pagamento}` })
  }

  try {
    // 1. Descobrir o ID do método de pagamento nesta conta Vendus (é
    // específico da conta, por isso não pode ser fixo no código)
    const metodos = await vendusFetch('/documents/paymentmethods/', vendusKey)
    const lista = Array.isArray(metodos) ? metodos : metodos?.data || []
    const metodo = lista.find((m) => m.type === tipoVendus && m.status !== 'off')
    if (!metodo) {
      throw new Error(`Sem método de pagamento "${tipoVendus}" ativo na conta Vendus.`)
    }

    // 2. Montar os itens — a Vendus exige id OU reference em cada item
    // (title sozinho não chega); usamos o id interno como reference.
    // Como o produto ainda não existe no catálogo Vendus, é criado
    // automaticamente na primeira fatura com esta reference.
    const items = pedido.order_items.map((i) => ({
      reference: `100P-${i.product_id || i.combo_id || i.id}`,
      title: nomeItem(i),
      qty: Number(i.quantidade),
      gross_price: Number(i.preco_unitario),
      tax_id: TAX_ID_DEFAULT,
    }))

    const corpo = {
      type: 'FR', // Fatura-Recibo — já foi pago na entrega
      mode: process.env.VENDUS_MODE === 'normal' ? 'normal' : 'tests',
      output: 'pdf_url',
      external_reference: `100PRESSAO-${pedido.numero}`,
      tx_id: pedido.id, // idempotência também do lado do Vendus
      items,
      payments: [{ id: metodo.id, amount: Number(pedido.total) }],
      ...(nif ? { client: { fiscal_id: nif } } : {}),
      ...(process.env.VENDUS_REGISTER_ID
        ? { register_id: Number(process.env.VENDUS_REGISTER_ID) }
        : {}),
    }

    const doc = await vendusFetch('/documents/', vendusKey, {
      method: 'POST',
      body: JSON.stringify(corpo),
    })

    await admin
      .from('orders')
      .update({
        fatura_pedida: true,
        fatura_nif: nif || null,
        fatura_documento_id: String(doc.id),
        fatura_documento_numero: doc.number || null,
        fatura_url: doc.output || null,
        fatura_erro: null,
        fatura_criado_em: new Date().toISOString(),
      })
      .eq('id', pedido_id)

    return res.status(200).json({
      ok: true,
      documento_id: doc.id,
      numero: doc.number,
      url: doc.output,
      modo_teste: corpo.mode === 'tests',
    })
  } catch (e) {
    await admin
      .from('orders')
      .update({ fatura_pedida: true, fatura_nif: nif || null, fatura_erro: e.message })
      .eq('id', pedido_id)
    return res.status(502).json({ erro: `Vendus: ${e.message}` })
  }
}
