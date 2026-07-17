import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AuthProvider, useSessaoAuth } from '../../lib/auth'
import {
  PerfilContext,
  hashPin,
  definirOperador,
  turnoDesbloqueadoPor,
  definirTurno,
} from '../../lib/equipa'
import logoStamp from '../../assets/logo-100pressao.png'

const MODULOS = [
  { to: '/staff', label: 'Staff' },
  { to: '/operacional', label: 'Operacional' },
  { to: '/ecran', label: 'Ecrã' },
  { to: '/admin', label: 'Admin', soAdmin: true },
]

// Fallback pré-migração: enquanto não existirem perfis com PIN pessoal,
// o PIN partilhado de arranque continua a funcionar (data de abertura)
const PIN_PARTILHADO = '1707'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setOcupado(false)
    if (error) setErro('Credenciais inválidas.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-creme-50 px-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-creme-300 bg-white/70 p-8"
      >
        <img
          src={logoStamp}
          alt="Logótipo 100PRESSÃO"
          className="mx-auto h-20 w-20 rounded-full"
        />
        <h1 className="mt-4 text-center font-display text-xl font-bold uppercase tracking-tight text-grafite-900">
          Área da equipa
        </h1>
        <label className="mt-6 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-100 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
            Palavra-passe
          </span>
          <div className="relative mt-2">
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-creme-300 bg-creme-100 py-3 pl-4 pr-12 text-grafite-900 outline-none focus:border-ambar-500"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              aria-label={mostrarPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
              aria-pressed={mostrarPassword}
              className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-grafite-600/70 transition-colors hover:text-grafite-900"
            >
              {mostrarPassword ? (
                /* olho cortado — a password está visível */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5.1c6.5 0 9.5 6.9 9.5 6.9a15.6 15.6 0 0 1-2.2 3.2M14.1 14.2a3 3 0 0 1-4.2-4.2M4.7 7.4A15 15 0 0 0 2.5 12S5.5 18.9 12 18.9c1.3 0 2.5-.3 3.5-.7" />
                  <path d="m3 3 18 18" />
                </svg>
              ) : (
                /* olho aberto */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M2.5 12S5.5 5.1 12 5.1 21.5 12 21.5 12 18.5 18.9 12 18.9 2.5 12 2.5 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>
        <p className="mt-3 h-5 text-sm text-red-600" role="alert">
          {erro}
        </p>
        <button
          type="submit"
          disabled={ocupado}
          className="mt-4 w-full cursor-pointer rounded-full bg-ambar-500 px-8 py-3 font-semibold uppercase tracking-widest text-grafite-950 transition-colors hover:bg-ambar-400 disabled:opacity-40"
        >
          {ocupado ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// PIN pessoal: identifica quem está ao balcão (alimenta o audit_log).
// Compara o hash do PIN digitado com todos os perfis ativos; sem perfis
// A identidade vem sempre do login: a conta autenticada desbloqueia com o
// SEU PIN pessoal; antes de haver PINs configurados (pré-migração), vale o
// PIN partilhado de arranque. O PIN é só um cadeado, não uma identidade.
function PinGate({ perfilProprio, temPins, aoDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)
  const usaProprio = Boolean(perfilProprio?.pin_hash)

  async function verificar(valor) {
    setPin(valor)
    setErro(false)
    if (valor.length < 4) return

    if (usaProprio) {
      if ((await hashPin(perfilProprio.id, valor)) === perfilProprio.pin_hash) {
        aoDesbloquear()
        return
      }
    } else if (!temPins && valor === PIN_PARTILHADO) {
      aoDesbloquear()
      return
    }
    setErro(true)
    setPin('')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-creme-50 px-6">
      <img src={logoStamp} alt="Logótipo 100PRESSÃO" className="h-24 w-24 rounded-full" />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-grafite-600/70">
        {usaProprio ? 'Introduz o teu PIN pessoal' : 'Introduz o PIN do turno'}
      </p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => verificar(e.target.value.replace(/\D/g, ''))}
        autoFocus
        aria-label="PIN"
        className="w-40 rounded-xl border border-creme-300 bg-creme-100 px-4 py-4 text-center font-display text-3xl tracking-[0.5em] text-grafite-900 outline-none focus:border-ambar-500"
      />
      <p className="h-5 text-sm text-red-600" role="alert">
        {erro ? 'PIN incorreto' : ''}
      </p>
    </div>
  )
}

function AreaEquipa() {
  const sessao = useSessaoAuth()
  const [perfis, setPerfis] = useState(null) // null = a carregar
  const [perfilProprio, setPerfilProprio] = useState(null)
  const [desbloqueado, setDesbloqueado] = useState(false)

  // Perfis: papel/PIN de cada conta. Se a tabela não existir (migração v2
  // por aplicar), degrada para o comportamento antigo (todos veem tudo,
  // PIN partilhado) em vez de trancar a equipa fora do sistema.
  useEffect(() => {
    if (!supabase || !sessao) return
    let ativo = true
    async function carregar() {
      const { data, error } = await supabase.from('perfis').select('*')
      if (!ativo) return
      const lista = error ? [] : data
      setPerfis(lista)
      const proprio = lista.find((p) => p.id === sessao.user.id) || null
      setPerfilProprio(proprio)
      // Identidade (nome no ecrã + operador na auditoria) = a conta
      // autenticada, nunca um PIN de outra pessoa.
      definirOperador({ id: sessao.user.id, nome: proprio?.nome || 'Equipa' })
      // O cadeado do turno só conta como aberto se foi ESTA conta a
      // desbloqueá-lo — se o login mudar, o PIN volta a ser pedido.
      setDesbloqueado(turnoDesbloqueadoPor() === sessao.user.id)
      // Conta desativada: corta o acesso já (o ban do Supabase trata das
      // sessões futuras; isto trata da sessão que ainda está aberta)
      if (proprio && proprio.ativo === false) {
        definirTurno(null)
        definirOperador(null)
        supabase.auth.signOut()
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [sessao])

  if (!supabase) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-creme-50 px-6 text-grafite-600">
        Sistema indisponível: configuração em falta.
      </div>
    )
  }

  if (sessao === undefined) {
    return <div className="min-h-dvh bg-creme-50" />
  }

  if (!sessao) return <Login />

  if (perfis === null) return <div className="min-h-dvh bg-creme-50" />

  const temPins = perfis.some((p) => p.ativo !== false && p.pin_hash)
  // Exige PIN quando a conta tem PIN próprio; ou, em pré-migração (sem
  // perfil e sem PINs), o PIN partilhado. Uma conta autenticada sem PIN
  // não fica trancada — o login já a identifica.
  const exigePin = perfilProprio ? Boolean(perfilProprio.pin_hash) : !temPins

  if (exigePin && !desbloqueado) {
    return (
      <PinGate
        perfilProprio={perfilProprio}
        temPins={temPins}
        aoDesbloquear={() => {
          definirTurno(sessao.user.id)
          setDesbloqueado(true)
        }}
      />
    )
  }

  const papel = perfilProprio?.papel || 'admin' // sem perfis = modo antigo
  const nome = perfilProprio?.nome || 'Equipa'
  const modulosVisiveis = MODULOS.filter((m) => !m.soAdmin || papel === 'admin')

  return (
    <PerfilContext.Provider value={{ ...(perfilProprio || {}), papel }}>
      <div className="min-h-dvh bg-creme-50 text-grafite-900">
        <header className="sticky top-0 z-40 border-b border-creme-300 bg-creme-50/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              to="/"
              title="Ir para a página inicial do site"
              className="flex items-center gap-3"
            >
              <img
                src={logoStamp}
                alt="Ir para a página inicial do site"
                className="h-10 w-10 rounded-full"
              />
              <span className="hidden font-display text-lg font-bold uppercase tracking-tight sm:block">
                100PRESSÃO
              </span>
            </Link>
            <nav className="flex gap-1 sm:gap-2" aria-label="Módulos da equipa">
              {modulosVisiveis.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors sm:px-4 sm:text-sm ${
                      isActive
                        ? 'bg-ambar-500 text-grafite-950'
                        : 'text-grafite-600 hover:text-grafite-900'
                    }`
                  }
                >
                  {m.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-grafite-600">
                {nome}
              </span>
              {exigePin && (
                <button
                  type="button"
                  onClick={() => {
                    definirTurno(null)
                    setDesbloqueado(false)
                  }}
                  title="Bloquear o ecrã (pede o PIN outra vez)"
                  className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:text-grafite-900"
                >
                  Bloquear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  definirTurno(null)
                  definirOperador(null)
                  supabase.auth.signOut()
                }}
                className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-grafite-600/70 hover:text-grafite-900"
              >
                Sair
              </button>
            </div>
          </div>
        </header>
        <Outlet />
      </div>
    </PerfilContext.Provider>
  )
}

// Provider local: só a área da equipa precisa de auth, e assim o
// supabase-js fica fora do bundle principal do site público.
function EquipaLayout() {
  return (
    <AuthProvider>
      <AreaEquipa />
    </AuthProvider>
  )
}

export default EquipaLayout
