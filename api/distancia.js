// Calcula a distância de condução da loja até uma morada, via Google Distance
// Matrix. Usada pelo checkout do restaurante online para calcular os portes.
// Requer a env var GOOGLE_MAPS_API_KEY no Vercel — a chave nunca chega ao browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return res.status(500).json({ erro: 'GOOGLE_MAPS_API_KEY não configurada no Vercel.' })
  }

  const { origem, morada } = req.body || {}
  if (!origem || origem.lat == null || origem.lng == null || !morada?.trim()) {
    return res.status(400).json({ erro: 'Origem (coordenadas da loja) e morada são obrigatórias.' })
  }

  const params = new URLSearchParams({
    origins: `${origem.lat},${origem.lng}`,
    destinations: morada.trim(),
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
    return res.status(200).json({ km })
  } catch {
    return res.status(500).json({ erro: 'Erro ao contactar o serviço de mapas.' })
  }
}
