// Diagnóstico da ligação ao Vendus — responde, num só sítio, às perguntas que
// de outra forma se respondem por suposição:
//
//   · em que modo estamos, testes ou normal (documentos com ou sem valor fiscal)
//   · a chave da API está configurada
//   · a API aceita-nos neste momento
//   · existe um posto do tipo "API", que o Vendus exige para emitir por API
//   · quando termina a subscrição, se a API o disser
//
// Nasceu de um mal-entendido concreto (ago 2026): o backoffice mostrava
// "Faturação API" contratada e a API respondia "A001: Your subscription plan
// does not allow use of API". Duas leituras contraditórias, e ninguém com forma
// de arbitrar sem tentar. Isto tenta.
//
// Nunca devolve a chave, nem parte dela — só se está definida. O modo não é
// segredo: é precisamente o que precisa de ser visível.
import { createClient } from '@supabase/supabase-js'

const VENDUS_BASE = 'https://www.vendus.pt/ws/v1.1'

export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({ erro: 'Configuração do Supabase em falta no Vercel.' })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Mesma exigência do resto do painel: sessão válida e perfil ativo.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ erro: 'Sem sessão.' })
  const { data: chamador, error: erroAuth } = await admin.auth.getUser(token)
  if (erroAuth || !chamador?.user) return res.status(401).json({ erro: 'Sessão inválida.' })
  const { data: perfil } = await admin
    .from('perfis')
    .select('ativo')
    .eq('id', chamador.user.id)
    .single()
  if (!perfil?.ativo) return res.status(403).json({ erro: 'Conta inativa.' })

  const chave = process.env.VENDUS_API_KEY
  const modo = process.env.VENDUS_MODE === 'normal' ? 'normal' : 'tests'

  const estado = {
    modo,
    // Explícita ou por omissão? A diferença importa: uma variável por definir
    // parece 'tests' e é fácil de tomar por decisão quando é distração.
    modo_explicito: process.env.VENDUS_MODE === 'normal' || process.env.VENDUS_MODE === 'tests',
    chave_configurada: !!chave,
    api_ok: false,
    api_mensagem: null,
    postos_api: null,
    subscricao_termina: null,
  }

  if (!chave) {
    estado.api_mensagem = 'VENDUS_API_KEY não está definida no Vercel.'
    return res.status(200).json(estado)
  }

  // Um GET aos postos serve de teste de vida: é barato, não cria nada, e falha
  // exatamente com o mesmo erro de plano que impede a emissão.
  try {
    const r = await fetch(`${VENDUS_BASE}/registers/?type=api&isActive=yes`, {
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    })
    const bruto = await r.text()
    let json = {}
    try {
      json = JSON.parse(bruto)
    } catch {
      /* tratado abaixo pelo caminho do texto em bruto */
    }
    if (r.ok) {
      const lista = Array.isArray(json) ? json : json?.data || []
      estado.api_ok = true
      estado.postos_api = lista.length
      estado.api_mensagem =
        lista.length > 0
          ? 'A API responde e há posto do tipo API configurado.'
          : 'A API responde, mas não há nenhum posto do tipo "API" ativo — é preciso criar um no backoffice do Vendus.'
    } else {
      const erros = Array.isArray(json?.errors) ? json.errors : []
      estado.api_mensagem =
        erros.map((e) => [e.code, e.message].filter(Boolean).join(': ')).join(' · ') ||
        json?.error ||
        `HTTP ${r.status}: ${bruto.slice(0, 200)}`
    }
  } catch (e) {
    estado.api_mensagem = `Não foi possível contactar o Vendus: ${e?.message || e}`
  }

  // A data de fim da subscrição só aparece se a conta a expuser; quando a API
  // está fechada, não aparece de todo. Fica a null em vez de inventada.
  if (estado.api_ok) {
    try {
      const r = await fetch(`${VENDUS_BASE}/account/`, {
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      })
      if (r.ok) {
        const conta = await r.json().catch(() => ({}))
        estado.subscricao_termina =
          conta?.subscription_end || conta?.expires_at || conta?.plan?.expires_at || null
      }
    } catch {
      /* extra: a ausência da data não invalida o diagnóstico */
    }
  }

  return res.status(200).json(estado)
}
