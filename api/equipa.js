// Gestão de contas de staff — corre no servidor (Vercel Function) porque
// criar/desativar utilizadores exige a service_role key do Supabase, que
// nunca pode chegar ao browser. Requer env vars no projeto Vercel:
//   VITE_SUPABASE_URL (já existe) e SUPABASE_SERVICE_ROLE_KEY (adicionar).
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const hashPin = (userId, pin) =>
  createHash('sha256').update(`${userId}:${pin}`).digest('hex')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não suportado' })
  }
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({
      erro: 'SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel (Settings → Environment Variables).',
    })
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Quem chama tem de ter sessão válida E papel de admin ativo
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
  if (!perfilChamador || perfilChamador.papel !== 'admin' || !perfilChamador.ativo) {
    return res.status(403).json({ erro: 'Ação reservada a admins.' })
  }

  const { acao, ...dados } = req.body || {}

  try {
    // ── criar conta (email + password inicial + PIN pessoal + papel) ──
    if (acao === 'criar') {
      const { email, password, nome, pin, papel } = dados
      if (!email?.includes('@')) return res.status(400).json({ erro: 'Email inválido.' })
      if (!password || password.length < 8)
        return res.status(400).json({ erro: 'Password precisa de 8+ caracteres.' })
      if (!/^\d{4}$/.test(pin || ''))
        return res.status(400).json({ erro: 'PIN tem de ter 4 dígitos.' })
      if (!['admin', 'staff'].includes(papel))
        return res.status(400).json({ erro: 'Papel inválido.' })
      if (!nome?.trim()) return res.status(400).json({ erro: 'Nome em falta.' })

      const { data: novo, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) return res.status(400).json({ erro: `Supabase: ${error.message}` })

      const { error: erroPerfil } = await admin.from('perfis').insert({
        id: novo.user.id,
        email,
        nome: nome.trim(),
        papel,
        pin_hash: hashPin(novo.user.id, pin),
        ativo: true,
      })
      if (erroPerfil) {
        // rollback para não deixar conta órfã sem perfil
        await admin.auth.admin.deleteUser(novo.user.id)
        return res.status(500).json({ erro: 'Falha a criar o perfil — conta revertida. A migração SQL v2 já foi aplicada?' })
      }
      return res.status(200).json({ ok: true, user_id: novo.user.id })
    }

    // ── ativar/desativar conta ──
    if (acao === 'definir_estado') {
      const { user_id, ativo } = dados
      if (!user_id) return res.status(400).json({ erro: 'user_id em falta.' })
      if (user_id === chamador.user.id && ativo === false)
        return res.status(400).json({ erro: 'Não podes desativar a tua própria conta.' })

      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: ativo ? 'none' : '87600h', // ~10 anos = desativada
      })
      if (error) return res.status(400).json({ erro: `Supabase: ${error.message}` })
      await admin.from('perfis').update({ ativo }).eq('id', user_id)
      return res.status(200).json({ ok: true })
    }

    // ── eliminar conta em definitivo ──
    // Apaga o utilizador de auth; o perfil sai em cascata (perfis.id →
    // auth.users on delete cascade). O histórico de auditoria é preservado
    // (audit_log.user_id não tem FK, fica como registo histórico).
    if (acao === 'excluir') {
      const { user_id } = dados
      if (!user_id) return res.status(400).json({ erro: 'user_id em falta.' })
      if (user_id === chamador.user.id)
        return res.status(400).json({ erro: 'Não podes eliminar a tua própria conta.' })

      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) return res.status(400).json({ erro: `Supabase: ${error.message}` })
      // Rede de segurança caso a cascata não apague o perfil (ex.: FK ausente)
      await admin.from('perfis').delete().eq('id', user_id)
      return res.status(200).json({ ok: true })
    }

    // ── trocar o PIN pessoal de uma conta ──
    if (acao === 'definir_pin') {
      const { user_id, pin } = dados
      if (!user_id) return res.status(400).json({ erro: 'user_id em falta.' })
      if (!/^\d{4}$/.test(pin || ''))
        return res.status(400).json({ erro: 'PIN tem de ter 4 dígitos.' })
      const { error } = await admin
        .from('perfis')
        .update({ pin_hash: hashPin(user_id, pin) })
        .eq('id', user_id)
      if (error) return res.status(400).json({ erro: `Supabase: ${error.message}` })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ erro: `Ação desconhecida: ${acao}` })
  } catch (e) {
    return res.status(500).json({ erro: `Erro inesperado: ${e.message}` })
  }
}
