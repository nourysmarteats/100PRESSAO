// Calcula a distância de condução da loja até uma morada, via Google Distance
// Matrix. Usada pelo checkout do restaurante online para calcular os portes.
// Requer a env var GOOGLE_MAPS_API_KEY no Vercel — a chave nunca chega ao browser.
// A origem é sempre a loja, lida no servidor, e há limites para proteger a fatura da Google.
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { dentroDoLimite, ipDoPedido, marcaPrivada } from './_lib/limites.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return res.status(500).json({ erro: 'GOOGLE_MAPS_API_KEY não configurada no Vercel.' })
  }

  // Mesma normalização que a criar_pedido_online() aplica antes do hash.
  const morada = String(req.body?.morada || '').replace(/\s+/g, ' ').trim()
  if (!morada || morada.length > 200) {
    return res.status(400).json({ erro: 'Indica uma morada válida.' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const ipMarca = marcaPrivada(ipDoPedido(req), serviceKey)
  if (
    !(await dentroDoLimite(admin, 'distancia_ip', ipMarca, 20, 3600)) ||
    !(await dentroDoLimite(admin, 'distancia_global', 'todos', 300, 86400))
  ) {
    return res.status(429).json({ erro: 'Demasiados pedidos. Tenta daqui a bocado ou escolhe levantamento.' })
  }

  const { data: cfg } = await admin.from('definicoes').select('valor').eq('chave', 'entrega').single()
  const lat = Number(cfg?.valor?.loja_lat)
  const lng = Number(cfg?.valor?.loja_lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(503).json({ erro: 'Não conseguimos calcular os portes neste momento.' })
  }

  const params = new URLSearchParams({
    origins: `${lat},${lng}`,
    destinations: morada,
    mode: 'driving',
    units: 'metric',
    region: 'pt',
    language: 'pt',
    key,
  })

  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`)
    const data = await r.json()
    const el = data?.rows?.[0]?.elements?.[0]
    if (data.status !== 'OK' || !el || el.status !== 'OK' || !el.distance) {
      const estado = el?.status || data.status
      // Distinguir "a morada não serve" de "o serviço está em baixo": dizer ao
      // cliente que a morada está errada quando o problema é a nossa chave do
      // Google manda-o corrigir uma coisa que está certa.
      const nossoProblema = ['REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST', 'UNKNOWN_ERROR'].includes(
        data.status,
      )
      if (nossoProblema) {
        console.error('Google Distance Matrix indisponível', estado, data.error_message || '')
      }
      return res.status(nossoProblema ? 503 : 400).json({
        erro: nossoProblema
          ? 'Não conseguimos calcular os portes neste momento. Escolhe levantamento, ou fala connosco que tratamos da entrega.'
          : 'Não encontrámos essa morada. Confirma a rua, o número e a localidade.',
        detalhe: estado,
        google: data.error_message || null,
      })
    }
    const km = Math.round((el.distance.value / 1000) * 100) / 100
    if (!(km > 0)) {
      return res.status(400).json({ erro: 'Não encontrámos essa morada. Confirma a rua, o número e a localidade.' })
    }
    // A encomenda só aceita uma distância gravada aqui, presa à morada (hash,
    // nunca a morada) e com prazo de 2 horas. O browser recebe só o id.
    const moradaHash = createHash('sha256').update(morada, 'utf8').digest('hex')
    const { data: reg, error: errReg } = await admin
      .from('distancias_calculadas')
      .insert({ morada_hash: moradaHash, km })
      .select('id')
      .single()
    if (errReg || !reg) {
      console.error('distancias_calculadas: falha ao gravar', errReg?.message || '')
      return res.status(500).json({ erro: 'Não conseguimos calcular os portes neste momento.' })
    }
    return res.status(200).json({ km, token: reg.id })
  } catch {
    return res.status(500).json({ erro: 'Erro ao contactar o serviço de mapas.' })
  }
}
