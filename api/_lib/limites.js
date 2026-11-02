// Limites de pedidos das APIs públicas. Ficheiro sob api/_lib/ (prefixo _) → não é rota.
// Guarda só HMAC de IP e telemóvel, nunca o valor, e apaga ao fim de 24 horas.
import { createHmac } from 'node:crypto'

// Na Vercel, x-vercel-forwarded-for é definido pela plataforma e o cliente não o controla.
export function ipDoPedido(req) {
  const h = req?.headers || {}
  const ip = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || ''
  return String(ip).split(',')[0].trim() || 'sem-ip'
}

export function marcaPrivada(valor, segredo) {
  return createHmac('sha256', String(segredo || '')).update(String(valor)).digest('hex')
}

// Falha em aberto: um problema nos limites nunca pode impedir um cliente de pagar.
export async function dentroDoLimite(admin, acao, chave, limite, janelaSeg) {
  const { data, error } = await admin.rpc('api_dentro_do_limite', {
    p_acao: acao,
    p_chave: chave,
    p_limite: limite,
    p_janela_seg: janelaSeg,
  })
  if (error) {
    console.error('limite indisponível', acao, error.message)
    return true
  }
  return data !== false
}
