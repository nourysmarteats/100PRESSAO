// Lógica partilhada de confirmação de pagamento do Restaurante Online.
// Ficheiro sob api/_lib/ (prefixo _) → não é uma rota, só um módulo de apoio
// importado pelo callback e pelo polling. Marca a encomenda como paga (de
// forma idempotente) e envia o email de confirmação ao cliente.
import { emitirFatura, exigeFatura, registarFalhaFatura } from './faturacao.js'

const fmt = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`

// Marca a encomenda como paga UMA só vez. O filtro neq garante idempotência:
// se o callback e o polling correrem quase ao mesmo tempo, só um "ganha" o
// update e só esse envia o email. Devolve a encomenda se foi agora marcada.
export async function marcarPago(admin, pedidoId) {
  const { data, error } = await admin
    .from('orders')
    .update({ estado_pagamento: 'pago', pago_em: new Date().toISOString() })
    .eq('id', pedidoId)
    .neq('estado_pagamento', 'pago')
    .select(
      'id, numero, cliente_email, cliente_nome, tipo_entrega, morada, total, portes, metodo_pagamento, fatura_nif',
    )
  if (error) {
    console.error('marcarPago falhou', error.message)
    return null
  }
  const pedido = data && data[0]
  if (pedido) {
    try {
      await enviarConfirmacao(admin, pedido)
    } catch (e) {
      // O email nunca bloqueia a confirmação do pagamento.
      console.error('email de confirmação falhou', e?.message || e)
    }
    await faturarSePreciso(admin, pedido)
  }
  return pedido
}

// Fatura assim que o dinheiro entra, sem esperar que alguém feche a encomenda
// no Staff. Antes a emissão exigia estado 'entregue' — regra que faz sentido ao
// balcão, onde se paga no fim, mas que numa encomenda online pré-paga deixava a
// fatura por emitir por tempo indeterminado. Foi o que aconteceu à encomenda
// nº 2: paga com cartão, sem fatura, e sem sequer aparecer no painel de Faturas.
//
// Nunca deixa rebentar: a confirmação do pagamento é o que não pode falhar. Se
// o Vendus recusar, a razão fica gravada na encomenda e aparece no painel de
// Faturas com um botão para tentar de novo.
async function faturarSePreciso(admin, pedido) {
  if (!exigeFatura(pedido.metodo_pagamento)) return
  try {
    const r = await emitirFatura(admin, pedido.id)
    console.log('fatura automática', {
      encomenda: pedido.numero,
      numero: r.numero || null,
      ja_existia: !!r.ja_existia,
    })
  } catch (e) {
    console.error('fatura automática falhou', pedido.numero, e?.message || e)
    await registarFalhaFatura(admin, pedido.id, e.message)
  }
}

// Email de confirmação (suporte duradouro — requisito legal de venda à
// distância). Usa o Resend se RESEND_API_KEY estiver configurada no Vercel;
// caso contrário não faz nada (o resto do fluxo funciona na mesma).
export async function enviarConfirmacao(admin, pedido) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !pedido.cliente_email) return
  const from = process.env.EMAIL_FROM || '100PRESSÃO <geral@100pressao.pt>'

  const { data: itens } = await admin
    .from('order_items')
    .select('quantidade, preco_unitario, products(nome), product_variants(nome), combos(nome)')
    .eq('order_id', pedido.id)

  const linhas = (itens || [])
    .map((i) => {
      const nome = i.combos?.nome
        ? `Combo ${i.combos.nome}`
        : `${i.products?.nome || 'Artigo'}${i.product_variants?.nome ? ` ${i.product_variants.nome}` : ''}`
      return `<tr><td>${i.quantidade}× ${nome}</td><td style="text-align:right">${fmt(
        i.preco_unitario * i.quantidade,
      )}</td></tr>`
    })
    .join('')

  const entrega =
    pedido.tipo_entrega === 'entrega'
      ? `Entrega em: ${pedido.morada || '—'}`
      : 'Levantamento no restaurante (Praceta Eugénio de Castro, Loja 6, Carnaxide)'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0e1013">
      <h2 style="color:#c9822e">Encomenda #${pedido.numero} confirmada ✓</h2>
      <p>Olá ${pedido.cliente_nome || 'cliente'}, recebemos e confirmámos o pagamento da tua encomenda. Já estamos a preparar!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${linhas}
        ${
          pedido.portes > 0
            ? `<tr><td>Portes de entrega</td><td style="text-align:right">${fmt(pedido.portes)}</td></tr>`
            : ''
        }
        <tr><td style="border-top:1px solid #ddd;padding-top:8px"><strong>Total</strong></td>
            <td style="border-top:1px solid #ddd;padding-top:8px;text-align:right"><strong>${fmt(
              pedido.total,
            )}</strong></td></tr>
      </table>
      <p>${entrega}</p>
      <p style="color:#666;font-size:13px">100PRESSÃO · Sintonia dos Temperos, Lda. · NIPC 519521463<br/>
      Este email confirma a tua encomenda ao abrigo das nossas Condições de Venda.</p>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: pedido.cliente_email,
      subject: `Encomenda #${pedido.numero} confirmada — 100PRESSÃO`,
      html,
    }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    console.error('Resend respondeu', r.status, txt)
  }
}
