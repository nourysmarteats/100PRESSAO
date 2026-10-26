// Cancelamento de um pedido, com os três lados que um pedido pago tem:
//
//   1. fiscal   — se havia fatura, nota de crédito na Vendus a anulá-la
//   2. dinheiro — reembolso pelo IfThenPay (MB WAY) ou registo de que foi
//                 devolvido por fora (ex.: a Neide devolveu do bolso)
//   3. registo  — estado 'cancelado'; o pagamento passa a 'reembolsado' (ou
//                 'a_reembolsar' se o reembolso automático falhou), e o pedido
//                 sai das vendas, do Arranque e da receita
//
// A ordem importa: se a nota de crédito falhar, pára antes de mexer no
// dinheiro. Uma fatura sem nota de crédito com o dinheiro devolvido é o pior
// estado possível — a venda continuava declarada.
//
// Nasceu do pedido nº 41 (25 Out 2026): cliente desistiu antes de preparar,
// pago por MB WAY, sem fatura (falhara por falta do MB WAY na Vendus), e a
// Neide devolveu o dinheiro do bolso dela.
//
// Env vars (Vercel):
//   VENDUS_API_KEY             — já existe
//   IFTHENPAY_BACKOFFICE_KEY   — chave de backoffice do IfThenPay, só para a
//                                devolução automática. Sem ela, o reembolso
//                                pelo IfThenPay recusa com mensagem clara e
//                                continua a dar para registar um reembolso manual.
//                                Antes de a pôr no Vercel: validar com a Bea onde
//                                fica e quem a pode usar (dá poder sobre a conta).
import { modoVendus, urlDoDocumento, vendusFetch } from './faturacao.js'

const IFT_REEMBOLSO = 'https://ifthenpay.com/api/endpoint/payments/refund'

const limpar = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// ── 1. Nota de crédito ──────────────────────────────────────────────────────
// Credita a fatura inteira: cada linha da NC aponta para a linha da fatura
// original (reference_document: número do documento + linha, a contar de 1).
// Formato confirmado no SDK não oficial da Vendus (bilouro/vendus-python),
// que o testou contra a API real. Os campos das linhas vêm do GET do
// documento original, não são reconstruídos a partir da encomenda.
async function emitirNotaCredito(vendusKey, faturaId, motivo, numeroPedido) {
  const original = await vendusFetch(`/documents/${encodeURIComponent(faturaId)}/`, vendusKey)
  const numero = original.number || ''
  const linhas = Array.isArray(original.items) ? original.items : []
  const items = linhas
    .map((l, i) => ({
      id: l.id,
      title: l.title,
      qty: Number(l.qty_nc ?? l.qty ?? 0),
      gross_price: Number(l.amounts?.gross_unit ?? 0),
      tax_id: l.tax?.id,
      reference_document: { document_number: numero, document_row: i + 1 },
    }))
    .filter((l) => l.qty > 0)
  if (!numero || items.length === 0) {
    throw new Error(`A fatura ${numero || faturaId} não tem linhas por creditar (já foi anulada?).`)
  }

  const corpo = {
    type: 'NC',
    mode: modoVendus(),
    output: 'pdf_url',
    register_id: original.register_id,
    notes: `Anulação do pedido nº ${numeroPedido}: ${motivo}`.slice(0, 255),
    external_reference: `100PRESSAO-${numeroPedido}-NC`,
    items,
  }
  const cliente = original.client
  if (cliente && typeof cliente === 'object') {
    const leve = {}
    if (cliente.name) leve.name = cliente.name
    if (cliente.fiscal_id) leve.fiscal_id = cliente.fiscal_id
    if (Object.keys(leve).length) corpo.client = leve
  }

  const doc = await vendusFetch('/documents/', vendusKey, {
    method: 'POST',
    body: JSON.stringify(corpo),
  })
  return { id: String(doc.id), numero: doc.number || null, url: urlDoDocumento(doc) }
}

// ── 2. Reembolso pelo IfThenPay ─────────────────────────────────────────────
// A API só devolve MB WAY e cartão, e só com saldo ainda não transferido para
// a conta (pagamentos desde as 20h do dia anterior). Fora disso responde
// Code -1 e o reembolso tem de ser feito por fora.
// Documentação: helpdesk.ifthenpay.com — "API Refunds".
//
// Só MB WAY, por agora: no MB WAY o pagamento_id é o RequestId da transação,
// que é o que a API pede. No cartão o pagamento_id é o do gateway (Pay by
// Link), que não é garantidamente o RequestId da transação — devolver com o
// identificador errado é pior do que não devolver.
// Condições verificadas ANTES de tocar em qualquer coisa: falta de
// configuração não pode deixar um pedido cancelado a meio.
function verificarReembolsoIfthenpay(pedido) {
  const chave = String(process.env.IFTHENPAY_BACKOFFICE_KEY || '').trim()
  if (!chave) {
    throw new Error(
      'Reembolso automático indisponível: falta IFTHENPAY_BACKOFFICE_KEY no Vercel. ' +
        'Devolve por fora e regista como "reembolso manual".',
    )
  }
  if (pedido.metodo_pagamento !== 'mbway') {
    throw new Error(
      'O reembolso automático só está disponível para MB WAY. ' +
        'Devolve no backoffice do IfThenPay e regista como "reembolso manual".',
    )
  }
  if (!pedido.pagamento_id) {
    throw new Error('O pedido não tem o identificador da transação MB WAY.')
  }
  return chave
}

async function reembolsarIfthenpay(pedido) {
  const chave = verificarReembolsoIfthenpay(pedido)
  const r = await fetch(IFT_REEMBOLSO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      backofficekey: chave,
      requestId: pedido.pagamento_id,
      amount: Number(pedido.total).toFixed(2),
    }),
  })
  const j = await r.json().catch(() => ({}))
  const codigo = Number(j.Code ?? j.code)
  if (codigo === 1) return
  console.error('IfThenPay reembolso', pedido.numero, r.status, JSON.stringify(j))
  if (codigo === -1) {
    throw new Error(
      'O IfThenPay não tem saldo por transferir para cobrir a devolução (o dinheiro já ' +
        'foi para a conta). Devolve por transferência e regista como "reembolso manual".',
    )
  }
  throw new Error(`IfThenPay recusou o reembolso: ${j.Message || j.message || `HTTP ${r.status}`}`)
}

// ── O cancelamento ──────────────────────────────────────────────────────────
// reembolso: 'ifthenpay' | 'manual' | 'nenhum'
//   'nenhum' só é aceite quando não entrou dinheiro (pagamento pendente, ou
//   dinheiro na entrega por cobrar). Um pedido pago cancelado sem reembolso
//   não é um cancelamento — é uma venda, e tem de ficar como tal.
export async function cancelarPedido(admin, pedidoId, { motivo, reembolso, notaReembolso, userId }) {
  const motivoLimpo = limpar(motivo, 200)
  if (motivoLimpo.length < 3) throw new Error('Indica o motivo do cancelamento.')
  if (!['ifthenpay', 'manual', 'nenhum'].includes(reembolso)) {
    throw new Error('Escolhe como foi (ou vai ser) feito o reembolso.')
  }
  const nota = limpar(notaReembolso, 200)
  if (reembolso === 'manual' && nota.length < 3) {
    throw new Error('No reembolso manual, indica como foi devolvido (ex.: "Neide, do bolso").')
  }

  const { data: pedido, error } = await admin
    .from('orders')
    .select(
      'id, numero, estado, estado_pagamento, metodo_pagamento, total, pagamento_id, fatura_documento_id, fatura_documento_numero, nota_credito_id, nota_credito_numero, reembolso_em',
    )
    .eq('id', pedidoId)
    .single()
  if (error || !pedido) throw new Error('Pedido não encontrado.')
  if (pedido.estado === 'cancelado' && pedido.estado_pagamento !== 'a_reembolsar') {
    throw new Error(`O pedido nº ${pedido.numero} já está cancelado.`)
  }

  const entrouDinheiro = ['pago', 'a_reembolsar'].includes(pedido.estado_pagamento)
  if (entrouDinheiro && reembolso === 'nenhum') {
    throw new Error('O pedido está pago: um cancelamento tem de ter reembolso (IfThenPay ou manual).')
  }

  if (entrouDinheiro && reembolso === 'ifthenpay' && !pedido.reembolso_em) {
    verificarReembolsoIfthenpay(pedido) // lança antes de qualquer alteração
  }

  const resultado = { numero: pedido.numero, nota_credito: null, reembolso: null, aviso: null }

  // 1. Fiscal — antes de tudo; se falhar, nada mais acontece.
  if (pedido.fatura_documento_id && !pedido.nota_credito_id) {
    const vendusKey = process.env.VENDUS_API_KEY
    if (!vendusKey) throw new Error('VENDUS_API_KEY não configurada no Vercel.')
    const nc = await emitirNotaCredito(vendusKey, pedido.fatura_documento_id, motivoLimpo, pedido.numero)
    await admin
      .from('orders')
      .update({ nota_credito_id: nc.id, nota_credito_numero: nc.numero, nota_credito_url: nc.url })
      .eq('id', pedido.id)
    resultado.nota_credito = nc.numero
  } else if (pedido.nota_credito_numero) {
    resultado.nota_credito = pedido.nota_credito_numero
  }

  // 2. Dinheiro
  const agora = new Date().toISOString()
  const dinheiro = {}
  if (entrouDinheiro && !pedido.reembolso_em) {
    if (reembolso === 'manual') {
      Object.assign(dinheiro, {
        estado_pagamento: 'reembolsado',
        reembolso_meio: 'manual',
        reembolso_valor: pedido.total,
        reembolso_nota: nota,
        reembolso_em: agora,
        reembolso_erro: null,
      })
      resultado.reembolso = 'manual'
    } else if (reembolso === 'ifthenpay') {
      try {
        await reembolsarIfthenpay(pedido)
        Object.assign(dinheiro, {
          estado_pagamento: 'reembolsado',
          reembolso_meio: 'ifthenpay',
          reembolso_valor: pedido.total,
          reembolso_em: agora,
          reembolso_erro: null,
        })
        resultado.reembolso = 'ifthenpay'
      } catch (e) {
        // O pedido fica cancelado na mesma (a NC, se havia, já saiu), mas com
        // o dinheiro marcado como em dívida ao cliente.
        Object.assign(dinheiro, { estado_pagamento: 'a_reembolsar', reembolso_erro: e.message })
        resultado.aviso = e.message
      }
    }
  }

  // 3. Registo
  await admin
    .from('orders')
    .update({
      estado: 'cancelado',
      cancelado_em: pedido.estado === 'cancelado' ? undefined : agora,
      cancelado_por: userId || null,
      cancelamento_motivo: motivoLimpo,
      ...dinheiro,
    })
    .eq('id', pedido.id)

  // Auditoria: identificadores e valores, nunca dados do cliente.
  await admin.from('audit_log').insert({
    user_id: userId || null,
    acao: 'pedido_cancelado',
    detalhe: {
      pedido: pedido.numero,
      valor: Number(pedido.total),
      metodo: pedido.metodo_pagamento,
      fatura: pedido.fatura_documento_numero || null,
      nota_credito: resultado.nota_credito,
      reembolso: resultado.reembolso || (resultado.aviso ? 'a_reembolsar' : 'nenhum'),
    },
  })

  return resultado
}
