// Emissão de faturas no Vendus. Módulo de apoio (prefixo _ → não é uma rota),
// partilhado por quem precisa de emitir:
//   · api/faturar.js          — o botão do Staff / painel de Faturas
//   · api/_lib/pagamentos.js  — automaticamente, ao confirmar um pagamento online
//
// Estava tudo dentro de api/faturar.js, que exige sessão de staff. Isso deixava
// as encomendas online pagas sem forma de serem faturadas até alguém as fechar
// à mão no Staff — e uma encomenda paga com fatura por emitir é um problema
// fiscal, não uma pendência de operação.
//
// Env vars (Vercel):
//   VENDUS_API_KEY      — gerar em Vendus: Configuração > Utilizadores > API
//   VENDUS_MODE         — 'tests' (default, seguro) ou 'normal' (real)
//   VENDUS_REGISTER_ID  — opcional; força o posto a usar
//   VENDUS_TIPO_PIX     — código do método Pix nesta conta Vendus

const VENDUS_BASE = 'https://www.vendus.pt/ws/v1.1'

// Produtos/combos de 100PRESSÃO ainda não estão sincronizados com o catálogo do
// Vendus, por isso cada item vai "avulso" (só por título).
// Taxa de IVA: 'NOR' (normal, 23%) em todos os artigos, decidido pelo Leandro
// em 2026-08-09.
//
// Fica registada a ressalva que lhe foi apresentada, para quem ler isto mais
// tarde saber que a questão foi levantada e não esquecida: a verba 3.1 da Lista
// II do CIVA prevê taxa intermédia (13%) para serviços de alimentação e bebidas,
// excluindo bebidas alcoólicas, refrigerantes, sumos, néctares e águas
// gaseificadas. Numa cervejaria isso separaria os petiscos e os pratos (13%) das
// cervejas e refrigerantes (23%). Aplicar 23% a tudo não subfactura o Estado —
// entrega-se mais IVA do que o devido —, mas encarece a comida sem necessidade.
//
// Se a contabilista vier a distinguir taxas, o passo seguinte é um campo de taxa
// por produto; a constante fica então como valor por omissão.
const TAX_ID_DEFAULT = 'NOR'

// Método de pagamento interno → "type" oficial do Vendus. Os IDs de cada método
// são específicos da conta, por isso vão-se buscar à API em vez de serem fixos
// aqui. Os códigos abaixo foram confirmados contra a lista real devolvida por
// GET /documents/paymentmethods/ na conta 100PRESSÃO: a conta tem "Multibanco"
// configurado como CD (Cartão de Débito), não MB (que é para referências MB), e
// "Cartão de Crédito" como CC.
export const TIPO_VENDUS_POR_METODO = {
  dinheiro: 'NU',
  multibanco: 'CD',
  mbway: 'MBWAY',
  cartao: 'CC',
  // O Pix não tem tipo padrão em Portugal e o código correto depende da conta
  // Vendus. Fica por configurar em VENDUS_TIPO_PIX em vez de adivinhado aqui:
  // um código fiscal errado numa fatura é pior do que uma fatura por emitir.
  pix: process.env.VENDUS_TIPO_PIX || null,
}

// Só o dinheiro tem fatura opcional; tudo o resto é faturado (regra do Leandro,
// 2026-08-08). Espelha exigeFatura() em src/lib/pedidos.js — o browser não é
// fonte de verdade para isto, por isso a regra existe também deste lado.
export const exigeFatura = (metodo) => !!metodo && metodo !== 'dinheiro'

function nomeItem(item) {
  if (item.combos?.nome) return `Combo ${item.combos.nome}`
  const variante = item.product_variants?.nome ? ` ${item.product_variants.nome}` : ''
  return `${item.products?.nome || 'Artigo'}${variante}`
}

// O Vendus devolve os erros em `errors: [{ code, message }]`. Olhar só para
// `error`/`message` deixava-nos com "Vendus respondeu 400" — uma mensagem que
// não diz nada e que obriga a ir aos logs, que nem sempre estão acessíveis.
// A razão tem de sobreviver até ao ecrã de quem carregou no botão.
export function razaoVendus(json, bruto) {
  const erros = Array.isArray(json?.errors) ? json.errors : json?.errors ? [json.errors] : []
  if (erros.length) {
    return erros
      .map((e) => [e.code, e.message || e.msg || e.detail].filter(Boolean).join(': '))
      .filter(Boolean)
      .join(' · ')
  }
  if (json?.error) return typeof json.error === 'string' ? json.error : JSON.stringify(json.error)
  if (json?.message) return json.message
  // Nada reconhecível: vai o corpo em bruto, cortado. Feio, mas diagnosticável —
  // ao contrário de uma mensagem genérica.
  const texto = (bruto || '').trim().replace(/\s+/g, ' ')
  return texto ? `resposta inesperada: ${texto.slice(0, 300)}` : 'resposta vazia'
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
  const bruto = await resp.text()
  let json = {}
  try {
    json = JSON.parse(bruto)
  } catch {
    /* resposta não-JSON: fica o texto em bruto, tratado por razaoVendus */
  }
  if (!resp.ok) {
    console.error(`Vendus ${options.method || 'GET'} ${path} -> ${resp.status}`, bruto)
    throw new Error(`${razaoVendus(json, bruto)} (HTTP ${resp.status})`)
  }
  return json
}

// Uma encomenda pode ser faturada quando o dinheiro já entrou. Nas vendas ao
// balcão isso coincide com "entregue" (paga-se no fim); numa encomenda online
// pré-paga acontece muito antes, e esperar pelo fecho no Staff deixaria a
// fatura pendurada — foi o que aconteceu à encomenda nº 2.
export const podeFaturar = (pedido) =>
  !!pedido.metodo_pagamento && (pedido.estado === 'entregue' || pedido.estado_pagamento === 'pago')

// Emite a fatura de um pedido no Vendus e grava o resultado na encomenda.
// Devolve { ok, documento_id, numero, url, ja_existia } ou lança com a razão.
// Nunca é chamada com totais vindos do browser: o pedido é lido do servidor,
// porque isto é um documento fiscal.
export async function emitirFatura(admin, pedidoId, { nif } = {}) {
  const vendusKey = process.env.VENDUS_API_KEY
  if (!vendusKey) {
    throw new Error('VENDUS_API_KEY não configurada no Vercel (Settings → Environment Variables).')
  }

  const { data: pedido, error } = await admin
    .from('orders')
    .select(`*, order_items ( *, products ( nome ), product_variants ( nome ), combos ( nome ) )`)
    .eq('id', pedidoId)
    .single()
  if (error || !pedido) throw new Error('Pedido não encontrado.')

  // Já emitida — devolve a existente em vez de duplicar. Importa mais aqui do
  // que antes: com a emissão automática, o botão manual e a repetição do
  // callback do IfThenPay, há três caminhos a poder chegar ao mesmo pedido.
  if (pedido.fatura_documento_id) {
    return {
      ok: true,
      ja_existia: true,
      documento_id: pedido.fatura_documento_id,
      numero: pedido.fatura_documento_numero,
      url: pedido.fatura_url,
    }
  }

  if (!podeFaturar(pedido)) {
    throw new Error('O pedido ainda não está pago.')
  }

  const tipoVendus = TIPO_VENDUS_POR_METODO[pedido.metodo_pagamento]
  if (!tipoVendus) {
    // Em vez de um beco, listar o que a conta Vendus tem disponível — assim
    // sabe-se logo qual o código a pôr na variável de ambiente.
    let disponiveis = []
    try {
      const lista = await vendusFetch('/documents/paymentmethods/', vendusKey)
      const arr = Array.isArray(lista) ? lista : lista?.data || []
      disponiveis = arr.filter((m) => m.status !== 'off').map((m) => `${m.type} (${m.title})`)
    } catch {
      /* a listagem é um extra: não deve mascarar o erro principal */
    }
    const extra = disponiveis.length ? ` Tipos disponíveis: ${disponiveis.join(', ')}.` : ''
    throw new Error(
      `Método de pagamento sem mapeamento Vendus: ${pedido.metodo_pagamento}.` +
        (pedido.metodo_pagamento === 'pix'
          ? ' Define VENDUS_TIPO_PIX no Vercel com o código adequado.'
          : '') +
        extra,
    )
  }

  // 1. Descobrir o ID do método de pagamento nesta conta Vendus (é específico
  // da conta, por isso não pode ser fixo no código)
  const metodos = await vendusFetch('/documents/paymentmethods/', vendusKey)
  const lista = Array.isArray(metodos) ? metodos : metodos?.data || []
  const metodo = lista.find((m) => m.type === tipoVendus && m.status !== 'off')
  if (!metodo) {
    console.error(
      `Sem método "${tipoVendus}" na conta Vendus. Métodos devolvidos:`,
      JSON.stringify(lista),
    )
    throw new Error(`Sem método de pagamento "${tipoVendus}" ativo na conta Vendus.`)
  }

  // 2. Montar os itens — a Vendus exige id OU reference em cada item (title
  // sozinho não chega); usamos o id interno como reference. Como o produto
  // ainda não existe no catálogo Vendus, é criado automaticamente na primeira
  // fatura com esta reference.
  const items = pedido.order_items.map((i) => ({
    reference: `100P-${i.product_id || i.combo_id || i.id}`,
    title: nomeItem(i),
    qty: Number(i.quantidade),
    gross_price: Number(i.preco_unitario),
    tax_id: TAX_ID_DEFAULT,
  }))

  // A taxa de entrega é parte do que foi cobrado e tem de constar como linha:
  // os `payments` usam o total (que a inclui), pelo que sem isto a soma dos
  // artigos ficava abaixo do valor pago e o documento saía inconsistente.
  const portes = Number(pedido.portes || 0)
  if (portes > 0) {
    items.push({
      reference: '100P-PORTES',
      title: 'Taxa de entrega',
      qty: 1,
      gross_price: portes,
      tax_id: TAX_ID_DEFAULT,
    })
  }

  // 3. Descobrir o "register" (posto) a usar. A Vendus exige que os documentos
  // emitidos por API venham de um register do tipo "api".
  //
  // Cuidado com o código A001: é reutilizado pelo Vendus para causas diferentes.
  // Documentámo-lo aqui como sendo o posto por configurar, mas em 2026-08-13 a
  // conta 100PRESSÃO devolveu "A001: Your subscription plan does not allow use
  // of API" — o plano subscrito não inclui API, e nenhuma chamada passa. Ler a
  // mensagem, não o código.
  let registerId = process.env.VENDUS_REGISTER_ID ? Number(process.env.VENDUS_REGISTER_ID) : null
  if (!registerId) {
    const registos = await vendusFetch('/registers/?type=api&isActive=yes', vendusKey)
    const listaRegistos = Array.isArray(registos) ? registos : registos?.data || []
    if (listaRegistos[0]) {
      registerId = listaRegistos[0].id
    } else {
      console.error(
        'Sem register do tipo "api" ativo na conta Vendus. Registers devolvidos:',
        JSON.stringify(listaRegistos),
      )
      throw new Error(
        'A conta Vendus não tem nenhum posto (register) do tipo "API" configurado. ' +
          'No backoffice da Vendus, cria ou edita um registo e define o Tipo como ' +
          '"API (Integração Programática)".',
      )
    }
  }

  // O NIF pode vir de quem chama (Staff a corrigir) ou já estar guardado na
  // encomenda desde o checkout — sem isto, faturar automaticamente perdia o NIF
  // que o cliente se deu ao trabalho de escrever.
  const fiscalId = nif || pedido.fatura_nif || null

  const corpo = {
    type: 'FR', // Fatura-Recibo — já está pago
    mode: process.env.VENDUS_MODE === 'normal' ? 'normal' : 'tests',
    output: 'pdf_url',
    external_reference: `100PRESSAO-${pedido.numero}`,
    tx_id: pedido.id, // idempotência também do lado do Vendus
    items,
    payments: [{ id: metodo.id, amount: Number(pedido.total) }],
    register_id: registerId,
    ...(fiscalId ? { client: { fiscal_id: fiscalId } } : {}),
  }

  const doc = await vendusFetch('/documents/', vendusKey, {
    method: 'POST',
    body: JSON.stringify(corpo),
  })

  await admin
    .from('orders')
    .update({
      fatura_pedida: true,
      fatura_nif: fiscalId,
      fatura_documento_id: String(doc.id),
      fatura_documento_numero: doc.number || null,
      fatura_url: urlDoDocumento(doc),
      fatura_erro: null,
      fatura_criado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId)

  return {
    ok: true,
    documento_id: doc.id,
    numero: doc.number,
    url: doc.output,
    modo_teste: corpo.mode === 'tests',
  }
}

// O Vendus nem sempre devolve o PDF no campo `output`, mesmo com
// output:'pdf_url' no pedido — as faturas FR T01P2026/3 e /4 saíram com ele
// vazio. Em vez de assumir um nome, aceitam-se os que a API usa, e há
// obterPdf() para o ir buscar depois pelo ID do documento.
const urlDoDocumento = (doc) =>
  doc?.output || doc?.output_url || doc?.url || doc?.pdf_url || doc?.download_url || null

// Vai buscar o PDF de uma fatura já emitida e guarda-o na encomenda. Serve as
// faturas cuja emissão não trouxe o link e as que foram emitidas antes de isto
// existir — sem ele, o documento só se alcança pelo backoffice do Vendus.
export async function obterPdf(admin, pedidoId) {
  const chave = process.env.VENDUS_API_KEY
  if (!chave) throw new Error('VENDUS_API_KEY não configurada no Vercel.')

  const { data: pedido } = await admin
    .from('orders')
    .select('id, fatura_documento_id, fatura_url')
    .eq('id', pedidoId)
    .single()
  if (!pedido?.fatura_documento_id) throw new Error('Esta encomenda ainda não tem fatura emitida.')
  if (pedido.fatura_url) return { ok: true, url: pedido.fatura_url, ja_existia: true }

  const doc = await vendusFetch(
    `/documents/${pedido.fatura_documento_id}/?output=pdf_url`,
    chave,
  )
  const url = urlDoDocumento(doc)
  if (!url) throw new Error('O Vendus não devolveu o endereço do PDF para este documento.')

  await admin.from('orders').update({ fatura_url: url }).eq('id', pedidoId)
  return { ok: true, url }
}

// Regista a falha na própria encomenda. A razão tem de ficar onde alguém a vá
// procurar (painel de Faturas), e não apenas nos logs — que podem não estar
// acessíveis quando fazem falta.
export async function registarFalhaFatura(admin, pedidoId, mensagem, nif) {
  await admin
    .from('orders')
    .update({ fatura_pedida: true, ...(nif ? { fatura_nif: nif } : {}), fatura_erro: mensagem })
    .eq('id', pedidoId)
}
