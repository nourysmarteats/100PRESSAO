// Contas de empresas de entrega e de estafetas — Fase 2A (ata de 2026-10-12, opção B).
//
// "Allow new users to sign up" e "Allow anonymous sign-ins" estão DESLIGADOS no
// Supabase, de propósito: ninguém cria conta sozinho. Esta função é o único sítio
// onde estas contas nascem, e só em dois momentos:
//   · o admin convida uma empresa APROVADA para o portal  → email de convite;
//   · um estafeta abre um convite VÁLIDO da sua empresa   → conta ligada ao telemóvel.
// E é também onde morrem: a empresa desativa um estafeta → a conta é apagada.
//
// Empresas e estafetas nunca ganham linha em `perfis` (e_equipa() abriria pedidos).
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } }

function clienteDoUtilizador(url, anonKey, token) {
  return createClient(url, anonKey, { ...opcoes, global: { headers: { Authorization: `Bearer ${token}` } } })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não suportado' })
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) return res.status(500).json({ erro: 'Configuração do servidor em falta.' })

  const admin = createClient(url, serviceKey, opcoes)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { acao, ...dados } = req.body || {}

  try {
    // ── Estafeta abre o convite (público: a credencial é o próprio convite) ──
    if (acao === 'aceitar-convite') {
      const convite = String(dados.convite || '')
      const telefone = String(dados.telefone || '')
      if (convite.length < 20) return res.status(400).json({ erro: 'Convite inválido.' })

      const { data: valido, error: eVal } = await admin.rpc('validar_convite_estafeta', { p_token: convite })
      if (eVal || !valido?.length) {
        return res.status(400).json({ erro: 'Convite inválido ou expirado. Peça um novo à sua empresa.' })
      }

      // Conta técnica: email sintético (nunca recebe mensagens) e password aleatória,
      // entregue uma única vez ao telemóvel para abrir a sessão. Quem guarda o acesso
      // é a sessão do telemóvel; perder o telemóvel = a empresa desativa e convida de novo.
      const email = `estafeta-${randomUUID()}@estafetas.100pressao.pt`
      const password = randomBytes(24).toString('base64url')
      const { data: novo, error: eCriar } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { tipo: 'estafeta' },
      })
      if (eCriar || !novo?.user) return res.status(500).json({ erro: 'Não foi possível criar o acesso.' })

      const { error: eLigar } = await admin.rpc('ligar_estafeta', {
        p_token: convite,
        p_user: novo.user.id,
        p_telefone: telefone,
      })
      if (eLigar) {
        await admin.auth.admin.deleteUser(novo.user.id)
        const msg = eLigar.code === '22023' ? eLigar.message : 'Não foi possível aceitar o convite.'
        return res.status(400).json({ erro: msg })
      }
      return res.status(200).json({ email, password, nome: valido[0].nome, empresa: valido[0].empresa })
    }

    // Daqui para baixo é preciso sessão.
    if (!token) return res.status(401).json({ erro: 'Sem sessão.' })
    const { data: chamador, error: eAuth } = await admin.auth.getUser(token)
    if (eAuth || !chamador?.user) return res.status(401).json({ erro: 'Sessão inválida.' })

    // ── Admin convida uma empresa aprovada para o portal ──
    if (acao === 'convidar-empresa') {
      const { data: perfil } = await admin.from('perfis').select('papel, ativo').eq('id', chamador.user.id).single()
      if (!perfil || perfil.papel !== 'admin' || !perfil.ativo) {
        return res.status(403).json({ erro: 'Ação reservada a admins.' })
      }
      const { data: empresa } = await admin
        .from('empresas_entrega')
        .select('id, estado, contacto_email, simulacao')
        .eq('id', dados.empresa_id)
        .single()
      if (!empresa || empresa.estado !== 'aprovada') return res.status(400).json({ erro: 'A empresa não está aprovada.' })
      if (!empresa.contacto_email) return res.status(400).json({ erro: 'A empresa não tem email de contacto.' })

      const origem = req.headers.origin || 'https://100pressao.pt'
      const { data: convite, error: eConv } = await admin.auth.admin.inviteUserByEmail(empresa.contacto_email, {
        redirectTo: `${origem}/empresa`,
        data: { tipo: 'empresa' },
      })
      if (eConv || !convite?.user) {
        // Já tem conta: basta entrar em /empresa com o mesmo email.
        return res.status(409).json({ erro: 'Este email já tem acesso. A empresa entra em /empresa com o mesmo email.' })
      }
      const { error: eAssoc } = await admin
        .from('empresa_utilizadores')
        .upsert({ user_id: convite.user.id, empresa_id: empresa.id })
      if (eAssoc) return res.status(500).json({ erro: 'Convite enviado, mas a associação falhou.' })
      await admin.from('audit_log').insert({
        user_id: chamador.user.id,
        acao: 'empresa_portal_convidada',
        detalhe: { empresa: empresa.id },
      })
      return res.status(200).json({ ok: true })
    }

    // ── Empresa desativa um estafeta seu: corta o acesso e apaga a conta ──
    if (acao === 'desativar-estafeta') {
      const comoEmpresa = clienteDoUtilizador(url, anonKey, token)
      const { data: userEstafeta, error: eDes } = await comoEmpresa.rpc('empresa_desativar_estafeta', {
        p_estafeta: dados.estafeta_id,
      })
      if (eDes) return res.status(403).json({ erro: 'Sem permissão.' })
      if (userEstafeta) await admin.auth.admin.deleteUser(userEstafeta)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ erro: 'Ação desconhecida.' })
  } catch (e) {
    console.error('entregas-acesso', e?.message || e)
    return res.status(500).json({ erro: 'Erro interno.' })
  }
}
