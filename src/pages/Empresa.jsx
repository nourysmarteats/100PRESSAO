// Portal da empresa de entregas — 100pressao.pt/empresa (Fase 2A, ata de 2026-10-12).
//
// Entra-se com um link enviado por email (sem password). Só funciona para quem o
// admin convidou depois de aprovar a empresa: o registo de contas está fechado no
// Supabase e `shouldCreateUser: false` garante que um email desconhecido não cria nada.
//
// A empresa gere os SEUS estafetas (convidar, desativar) e vê as suas entregas da
// semana (segunda a domingo) SEM dados de clientes — o suficiente para emitir e
// conferir a fatura semanal consolidada (13/10/2026).
import { useCallback, useEffect, useState } from 'react'
import { supabaseEmpresa as sb } from '../lib/supabase'
import SEOHead from '../components/SEOHead'
import { fmt } from '../lib/pedidos'
import { textoPreco } from '../lib/empresasEntrega'
import { ESTADO_ENTREGA, inicioSemana, linkConvite, mudarSemana, linkEquipa, mensagemConvite, mensagemEquipa, rotuloSemana, totaisEntregas } from '../lib/despacho'

const CARTAO = 'rounded-2xl border border-creme-300 bg-white/70 p-6'
const CAMPO = 'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'
const BOTAO = 'cursor-pointer rounded-xl bg-cobre-600 px-5 py-3 font-display text-sm font-bold uppercase tracking-widest text-creme-50 hover:bg-cobre-700 disabled:opacity-60'
const BOTAO_2 = 'cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500'
const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'

function Entrar() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState('idle')
  async function enviar(e) {
    e.preventDefault()
    setEstado('a_enviar')
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/empresa` },
    })
    // A mesma resposta com ou sem conta: não se revela que emails têm acesso.
    setEstado(error && error.status >= 500 ? 'erro' : 'enviado')
  }
  return (
    <div className={`${CARTAO} mt-8`}>
      {estado === 'enviado' ? (
        <p className="text-grafite-700">
          Se este email tiver acesso, vai receber um link para entrar. Abra-o neste dispositivo.
        </p>
      ) : (
        <form onSubmit={enviar}>
          <label className="block">
            <span className={ROTULO}>Email da empresa</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} autoComplete="email" />
          </label>
          <button type="submit" disabled={estado === 'a_enviar'} className={`${BOTAO} mt-4`}>Enviar link de entrada</button>
          {estado === 'erro' && <p className="mt-3 text-sm text-red-600">Não foi possível enviar. Tente daqui a pouco.</p>}
          <p className="mt-4 text-sm text-grafite-600/80">
            Ainda não é parceiro? <a href="/parceiro-entregas" className="font-semibold text-cobre-600 hover:underline">Registe a empresa</a>.
          </p>
        </form>
      )}
    </div>
  )
}

function Portal({ sessao }) {
  const [info, setInfo] = useState(null)
  const [estafetas, setEstafetas] = useState([])
  const [entregas, setEntregas] = useState([])
  const [semana, setSemana] = useState(inicioSemana(new Date()))
  const [nome, setNome] = useState('')
  const [convite, setConvite] = useState(null)
  const [aviso, setAviso] = useState('')
  const [linksEquipa, setLinksEquipa] = useState([])
  const [limite, setLimite] = useState('10')
  const [dias, setDias] = useState('7')
  const [novoEquipa, setNovoEquipa] = useState(null)

  const carregar = useCallback(async () => {
    const [rInfo, rEst, rEnt, rEq] = await Promise.all([
      sb.rpc('minha_empresa_info'),
      sb.from('estafetas').select('id, nome, telefone, ativo, disponivel, aprovado').order('nome'),
      sb.rpc('entregas_da_minha_empresa_semana', { p_semana: semana }),
      sb.from('estafeta_convites_equipa').select('id, limite, usos, expira_em, cancelado_em, criado_em').order('criado_em', { ascending: false }),
    ])
    setInfo(rInfo.data?.[0] || false)
    setEstafetas(rEst.data || [])
    setEntregas(rEnt.data || [])
    setLinksEquipa((rEq.data || []).filter((c) => !c.cancelado_em && new Date(c.expira_em) > new Date() && c.usos < c.limite))
  }, [semana])

  async function criarEquipa(e) {
    e.preventDefault()
    const l = Number(limite)
    const d = Number(dias)
    const { data, error } = await sb.rpc('convidar_equipa', { p_limite: l, p_dias: d })
    if (error) return setAviso(error.message || 'Não foi possível criar o link.')
    setNovoEquipa({ link: linkEquipa(window.location.origin, data), dias: d })
    carregar()
  }

  async function cancelarEquipa(id) {
    await sb.rpc('cancelar_convite_equipa', { p_id: id })
    setAviso('Link cancelado.')
    carregar()
  }

  async function aprovar(id) {
    const { error } = await sb.rpc('empresa_aprovar_estafeta', { p_estafeta: id })
    setAviso(error ? 'Não foi possível ativar.' : 'Estafeta ativado.')
    carregar()
  }

  useEffect(() => {
    carregar()
  }, [carregar])

  async function convidar(e) {
    e.preventDefault()
    if (nome.trim().length < 2) return
    const { data, error } = await sb.rpc('convidar_estafeta', { p_nome: nome.trim() })
    if (error) return setAviso('Não foi possível criar o convite.')
    const link = linkConvite(window.location.origin, data)
    setConvite({ nome: nome.trim(), link })
    setNome('')
  }

  async function desativar(id, nomeEstafeta) {
    if (!window.confirm(`Desativar ${nomeEstafeta}? Perde o acesso de imediato.`)) return
    const r = await fetch('/api/entregas-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({ acao: 'desativar-estafeta', estafeta_id: id }),
    })
    setAviso(r.ok ? 'Estafeta desativado.' : 'Não foi possível desativar.')
    carregar()
  }

  if (info === null) return <p className="mt-8 text-grafite-600">A carregar…</p>
  if (info === false) {
    return (
      <div className={`${CARTAO} mt-8`}>
        <p className="text-grafite-700">Esta conta não está associada a nenhuma empresa ativa. Fale connosco: geral@100pressao.pt</p>
        <button type="button" className={`${BOTAO_2} mt-4`} onClick={() => sb.auth.signOut()}>Sair</button>
      </div>
    )
  }

  const t = totaisEntregas(entregas)
  const ativos = estafetas.filter((s) => s.ativo && s.aprovado !== false)
  const pendentes = estafetas.filter((s) => s.ativo && s.aprovado === false)

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold uppercase text-grafite-900">{info.nome}</p>
          <p className="text-sm text-grafite-600">
            Preço acordado: {textoPreco(info.tarifa_base, info.km_incluidos, info.tarifa_km, fmt)} (sem IVA)
            {info.estado === 'suspensa' && <span className="ml-2 font-semibold text-red-600">· Suspensa</span>}
          </p>
        </div>
        <button type="button" className={BOTAO_2} onClick={() => sb.auth.signOut()}>Sair</button>
      </div>

      {!info.acordo_dados && (
        <p className="rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm text-ambar-800">
          Ainda não recebem entregas: falta assinar o contrato e o acordo de tratamento de dados.
        </p>
      )}

      <section className={CARTAO}>
        <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Estafetas</h2>
        <form onSubmit={convidar} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <span className={ROTULO}>Nome do estafeta a convidar</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} maxLength={120} />
          </label>
          <button type="submit" className={BOTAO}>Criar convite</button>
        </form>

        {convite && (
          <div className="mt-4 rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm">
            <p className="font-semibold text-grafite-900">Convite para {convite.nome} (72 horas, uso único)</p>
            <p className="mt-2 break-all text-grafite-700">{convite.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={BOTAO_2}
                onClick={() => navigator.clipboard?.writeText(convite.link).then(() => setAviso('Link copiado.'))}>
                Copiar link
              </button>
              <a className={BOTAO_2} target="_blank" rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(mensagemConvite(convite.nome, convite.link))}`}>
                Enviar por WhatsApp
              </a>
            </div>
            <p className="mt-2 text-xs text-grafite-600/80">Este link não volta a ser mostrado. Se se perder, crie outro.</p>
          </div>
        )}

        {/* Link de equipa: vários estafetas, cada um fica à espera de ser ativado aqui */}
        <form onSubmit={criarEquipa} className="mt-6 flex flex-wrap items-end gap-3 border-t border-creme-300 pt-5">
          <p className="w-full text-sm text-grafite-700">
            <strong>Link de equipa:</strong> um só link para vários estafetas. Quem entrar por ele fica à espera até o ativar aqui.
          </p>
          <label className="block"><span className={ROTULO}>Máx. pessoas</span>
            <input value={limite} onChange={(e) => setLimite(e.target.value)} inputMode="numeric" className={`${CAMPO} w-24`} /></label>
          <label className="block"><span className={ROTULO}>Válido (dias)</span>
            <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={`${CAMPO} w-24`} /></label>
          <button type="submit" className={BOTAO}>Criar link de equipa</button>
        </form>
        {novoEquipa && (
          <div className="mt-4 rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm">
            <p className="font-semibold text-grafite-900">Link de equipa ({novoEquipa.dias} dias)</p>
            <p className="mt-2 break-all text-grafite-700">{novoEquipa.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={BOTAO_2} onClick={() => navigator.clipboard?.writeText(novoEquipa.link).then(() => setAviso('Link copiado.'))}>Copiar link</button>
              <a className={BOTAO_2} target="_blank" rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(mensagemEquipa(info.nome, novoEquipa.link, novoEquipa.dias))}`}>Enviar por WhatsApp</a>
            </div>
            <p className="mt-2 text-xs text-grafite-600/80">Este link não volta a ser mostrado. Pode cancelá-lo abaixo a qualquer momento.</p>
          </div>
        )}
        {linksEquipa.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {linksEquipa.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-creme-100 px-3 py-2">
                <span>Link de equipa · {c.usos}/{c.limite} usados · até {new Date(c.expira_em).toLocaleDateString('pt-PT')}</span>
                <button type="button" className={BOTAO_2} onClick={() => cancelarEquipa(c.id)}>Cancelar</button>
              </li>
            ))}
          </ul>
        )}

        {pendentes.length > 0 && (
          <div className="mt-5 rounded-xl border border-ambar-500/50 bg-ambar-500/10 p-4">
            <p className="font-semibold text-grafite-900">À espera de ativação ({pendentes.length})</p>
            <ul className="mt-2 divide-y divide-ambar-500/20">
              {pendentes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-semibold">{s.nome}</span> <span className="text-sm text-grafite-600">{s.telefone}</span></span>
                  <span className="flex gap-2">
                    <button type="button" className={BOTAO_2} onClick={() => aprovar(s.id)}>Ativar</button>
                    <button type="button" className={BOTAO_2} onClick={() => desativar(s.id, s.nome)}>Recusar</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="mt-5 divide-y divide-creme-300">
          {ativos.length === 0 && <li className="py-3 text-sm text-grafite-600">Ainda não há estafetas ativos.</li>}
          {ativos.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>
                <span className="font-semibold text-grafite-900">{s.nome}</span>
                <span className="ml-2 text-sm text-grafite-600">{s.telefone}</span>
                <span className={`ml-2 text-xs font-semibold uppercase tracking-widest ${s.disponivel ? 'text-emerald-700' : 'text-grafite-600/60'}`}>
                  {s.disponivel ? 'Disponível' : 'Indisponível'}
                </span>
              </span>
              <button type="button" className={BOTAO_2} onClick={() => desativar(s.id, s.nome)}>Desativar</button>
            </li>
          ))}
        </ul>
      </section>

      <section className={CARTAO}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Entregas da semana</h2>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" aria-label="Semana anterior" className={BOTAO_2} onClick={() => setSemana((s) => mudarSemana(s, -1))}>‹</button>
            <span className="min-w-28 text-center font-semibold text-grafite-700">{rotuloSemana(semana)}</span>
            <button type="button" aria-label="Semana seguinte" disabled={semana >= inicioSemana(new Date())} className={BOTAO_2} onClick={() => setSemana((s) => mudarSemana(s, 1))}>›</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-grafite-600/70">
          Semana de segunda a domingo. A fatura semanal consolidada inclui as entregas concluídas da semana anterior.
        </p>
        <p className="mt-3 text-sm text-grafite-700">
          <strong>{t.entregas}</strong> entregas concluídas · {String(t.km).replace('.', ',')} km · <strong>{fmt(t.custo)}</strong> sem IVA
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-grafite-600/70">
              <tr><th className="py-2">N.º</th><th>Data</th><th>Estafeta</th><th>Km</th><th>Custo</th><th>Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-creme-300">
              {entregas.map((l) => (
                <tr key={l.numero}>
                  <td className="py-2">{l.numero}</td>
                  <td>{new Date(l.data).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{l.estafeta || '—'}</td>
                  <td>{String(l.distancia_km ?? '—').replace('.', ',')}</td>
                  <td>{l.custo != null ? fmt(l.custo) : '—'}</td>
                  <td>{ESTADO_ENTREGA[l.estado] || l.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {aviso && <p role="status" className="text-sm font-semibold text-grafite-700">{aviso}</p>}
    </div>
  )
}

function Empresa() {
  const [sessao, setSessao] = useState(undefined)
  useEffect(() => {
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!sb) return null
  return (
    <main className="min-h-screen bg-creme-50 text-grafite-800">
      <SEOHead title="Portal da empresa | 100PRESSÃO" description="Área reservada a empresas de entrega parceiras." path="/empresa" noindex />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className={ROTULO}>Parceiros de entrega</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-grafite-900">Portal da empresa</h1>
        {sessao === undefined ? null : sessao ? <Portal sessao={sessao} /> : <Entrar />}
      </div>
    </main>
  )
}

export default Empresa
