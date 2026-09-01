// Camada de dados do Módulo Financeiro (schema `financeiro` no Supabase).
//
// Controlo de gestão, e só isso: a faturação certificada é da Vendus e nunca
// passa por aqui. Pagamentos a colaboradores vivem em `colaborador_pagamentos`
// e entram por vista — nunca se lançam à mão, senão contam duas vezes.
//
// Requer que o schema `financeiro` esteja exposto na API do Supabase
// (Settings → API → Exposed schemas). Sem isso, todos os pedidos dão 404.
import { supabase } from './supabase'

export const fin = () => supabase?.schema('financeiro')

export const hojeISO = () => new Date().toLocaleDateString('sv-SE')

// Mesmo vocabulário de METODOS_PAGAMENTO em pedidos.js, mais os que só
// existem do lado da despesa.
export const METODOS_DESPESA = [
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'multibanco', rotulo: 'Multibanco' },
  { id: 'mbway', rotulo: 'MB Way' },
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'transferencia', rotulo: 'Transferência' },
  { id: 'debito_direto', rotulo: 'Débito directo' },
  { id: 'outro', rotulo: 'Outro' },
]

export const CANAIS_RECEITA_EXTERNA = [
  { id: 'pos_externo', rotulo: 'POS externo' },
  { id: 'glovo', rotulo: 'Glovo' },
  { id: 'ubereats', rotulo: 'Uber Eats' },
  { id: 'boltfood', rotulo: 'Bolt Food' },
  { id: 'eventos', rotulo: 'Eventos' },
  { id: 'outro', rotulo: 'Outro' },
]

export const mesISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

export const rotuloMes = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

// ─────────────────────────── Leitura ───────────────────────────

export async function listarCategorias() {
  const { data, error } = await fin()
    .from('categorias')
    .select('id, codigo, nome, ordem')
    .eq('ativa', true)
    .order('ordem')
  if (error) throw error
  return data
}

export async function listarFornecedores() {
  const { data, error } = await fin()
    .from('fornecedores')
    .select('id, nome, nif, email, telefone, ativo')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data
}

export async function listarDespesas({ desde, ate } = {}) {
  let q = fin()
    .from('v_despesas')
    .select('id, data, valor, iva, arranque, categoria, categoria_codigo, fornecedor, entidade, descricao, metodo_pagamento, comprovativo_path')
    .order('data', { ascending: false })
    .limit(300)
  if (desde) q = q.gte('data', desde)
  if (ate) q = q.lte('data', ate)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function resultadoMensal() {
  const { data, error } = await fin()
    .from('v_resultado_mensal')
    .select('*')
    .order('mes', { ascending: false })
    .limit(24)
  if (error) throw error
  return data
}

export async function execucaoOrcamento(mes) {
  const { data, error } = await fin()
    .from('v_orcamento_execucao')
    .select('*')
    .eq('mes', mes)
    .order('categoria_codigo')
  if (error) throw error
  return data
}

export async function listarReceitasExternas({ desde } = {}) {
  let q = fin()
    .from('receitas_externas')
    .select('id, data, canal, valor, comissao, num_transacoes, notas')
    .order('data', { ascending: false })
    .limit(200)
  if (desde) q = q.gte('data', desde)
  const { data, error } = await q
  if (error) throw error
  return data
}

// ─────────────────────────── Escrita ───────────────────────────

export async function guardarFornecedor(f) {
  const { error } = await fin().from('fornecedores').insert(f)
  if (error) throw error
}

export async function guardarReceitaExterna(r) {
  // unique (data, canal): relançar o mesmo dia e canal actualiza em vez de rebentar
  const { error } = await fin()
    .from('receitas_externas')
    .upsert(r, { onConflict: 'data,canal' })
  if (error) throw error
}

export async function guardarOrcamento(o) {
  const { error } = await fin().from('orcamento').upsert(o, { onConflict: 'categoria_id,mes' })
  if (error) throw error
}

export async function anularDespesa(id, motivo) {
  const { data: sessao } = await supabase.auth.getUser()
  const { error } = await fin()
    .from('despesas')
    .update({
      anulada_em: new Date().toISOString(),
      anulada_por: sessao?.user?.id,
      motivo_anulacao: motivo,
    })
    .eq('id', id)
  if (error) throw error
}

// ──────────────────── Fotografia do comprovativo ────────────────────

// O Wi-Fi do Mercado de Carnaxide não aguenta fotos de 4 MB, e o bucket
// recusa acima de 5 MB. 1600px a 0,7 dá ~200 KB e continua legível.
export async function comprimirImagem(ficheiro, maxLado = 1600, qualidade = 0.7) {
  if (!ficheiro?.type?.startsWith('image/')) return ficheiro
  try {
    const bitmap = await createImageBitmap(ficheiro)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)
    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura
    tela.getContext('2d').drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close?.()
    const blob = await new Promise((r) => tela.toBlob(r, 'image/jpeg', qualidade))
    return blob || ficheiro
  } catch {
    return ficheiro
  }
}

// ──────────────── Fila offline (IndexedDB, sem dependências) ────────────────

const BD_NOME = 'financeiro-100pressao'
const ARMAZEM = 'despesas_pendentes'

function abrirBD() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BD_NOME, 1)
    pedido.onupgradeneeded = () => {
      const bd = pedido.result
      if (!bd.objectStoreNames.contains(ARMAZEM)) {
        bd.createObjectStore(ARMAZEM, { keyPath: 'cliente_uuid' })
      }
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

async function transacao(modo, operacao) {
  const bd = await abrirBD()
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(ARMAZEM, modo)
    const pedido = operacao(tx.objectStore(ARMAZEM))
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
    tx.oncomplete = () => bd.close()
  })
}

export const listarPendentes = () => transacao('readonly', (s) => s.getAll())
const porPendente = (registo) => transacao('readwrite', (s) => s.put(registo))
const apagarPendente = (uuid) => transacao('readwrite', (s) => s.delete(uuid))

// Ponto de entrada do ecrã: grava sempre na fila primeiro e só depois tenta
// enviar. Se a rede falhar a meio, o registo não se perde — e o cliente_uuid
// garante que reenviar não duplica.
export async function lancarDespesa({ despesa, foto }) {
  const cliente_uuid = crypto.randomUUID()
  const comprimida = foto ? await comprimirImagem(foto) : null
  await porPendente({ cliente_uuid, despesa: { ...despesa, cliente_uuid }, foto: comprimida })
  const { enviados } = await sincronizar()
  return { cliente_uuid, enviado: enviados > 0 }
}

async function enviarUm({ cliente_uuid, despesa, foto }) {
  let comprovativo_path = despesa.comprovativo_path || null

  if (foto && !comprovativo_path) {
    const d = new Date(`${despesa.data}T00:00:00`)
    const caminho = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${cliente_uuid}.jpg`
    const { error } = await supabase.storage
      .from('comprovativos')
      .upload(caminho, foto, { contentType: 'image/jpeg', upsert: true })
    // Falha no upload não bloqueia o lançamento: o valor vale mais que o talão.
    if (!error) comprovativo_path = caminho
  }

  const { error } = await fin()
    .from('despesas')
    .upsert({ ...despesa, comprovativo_path }, {
      onConflict: 'cliente_uuid',
      ignoreDuplicates: true,
    })
  if (error) throw error
  await apagarPendente(cliente_uuid)
}

// Percorre a fila. Devolve quantos saíram e quantos ficaram, para o ecrã
// poder mostrar "N por sincronizar" — sem esse indicador ninguém confia.
export async function sincronizar() {
  if (!supabase) return { enviados: 0, pendentes: 0 }
  const fila = await listarPendentes()
  let enviados = 0
  for (const registo of fila) {
    try {
      await enviarUm(registo)
      enviados += 1
    } catch {
      break // offline ou erro: pára e tenta na próxima
    }
  }
  const restantes = await listarPendentes()
  return { enviados, pendentes: restantes.length }
}
