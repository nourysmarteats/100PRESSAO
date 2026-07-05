import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AuthProvider, useSessaoAuth } from '../../lib/auth'
import logoStamp from '../../assets/logo-100pressao.png'

const MODULOS = [
  { to: '/staff', label: 'Staff' },
  { to: '/operacional', label: 'Operacional' },
  { to: '/ecran', label: 'Ecrã' },
  { to: '/admin', label: 'Admin' },
]

// PIN de conveniência POR CIMA do Supabase Auth (não o substitui): o
// dispositivo já está autenticado; isto só desbloqueia a UI no turno.
// Valor temporário — data de abertura (17/07). Sem relação com o Oráculo.
const PIN_UI = '1707'
const PIN_STORAGE_KEY = 'pin_equipa_ok'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="flex min-h-dvh items-center justify-center bg-grafite-950 px-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-grafite-700 bg-grafite-900 p-8"
      >
        <img
          src={logoStamp}
          alt="Logótipo 100PRESSÃO"
          className="mx-auto h-20 w-20 rounded-full mix-blend-lighten"
        />
        <h1 className="mt-4 text-center font-display text-xl font-bold uppercase tracking-tight text-creme-50">
          Área da equipa
        </h1>
        <label className="mt-6 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-400">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-grafite-700 bg-grafite-800 px-4 py-3 text-creme-50 outline-none focus:border-ambar-500"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-400">
            Palavra-passe
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-grafite-700 bg-grafite-800 px-4 py-3 text-creme-50 outline-none focus:border-ambar-500"
          />
        </label>
        <p className="mt-3 h-5 text-sm text-red-400" role="alert">
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

function PinGate({ aoDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)

  function verificar(valor) {
    setPin(valor)
    setErro(false)
    if (valor.length < 4) return
    if (valor === PIN_UI) {
      sessionStorage.setItem(PIN_STORAGE_KEY, '1')
      aoDesbloquear()
    } else {
      setErro(true)
      setPin('')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-grafite-950 px-6">
      <img
        src={logoStamp}
        alt="Logótipo 100PRESSÃO"
        className="h-24 w-24 rounded-full mix-blend-lighten"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-creme-500">
        Introduz o PIN do turno
      </p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => verificar(e.target.value.replace(/\D/g, ''))}
        autoFocus
        aria-label="PIN do turno"
        className="w-40 rounded-xl border border-grafite-700 bg-grafite-800 px-4 py-4 text-center font-display text-3xl tracking-[0.5em] text-creme-50 outline-none focus:border-ambar-500"
      />
      <p className="h-5 text-sm text-red-400" role="alert">
        {erro ? 'PIN incorreto' : ''}
      </p>
    </div>
  )
}

function AreaEquipa() {
  const sessao = useSessaoAuth()
  const [pinOk, setPinOk] = useState(
    () => sessionStorage.getItem(PIN_STORAGE_KEY) === '1',
  )

  if (!supabase) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-grafite-950 px-6 text-creme-300">
        Sistema indisponível — configuração em falta.
      </div>
    )
  }

  if (sessao === undefined) {
    return <div className="min-h-dvh bg-grafite-950" />
  }

  if (!sessao) return <Login />

  if (!pinOk) return <PinGate aoDesbloquear={() => setPinOk(true)} />

  return (
    <div className="min-h-dvh bg-grafite-950 text-creme-50">
      <header className="sticky top-0 z-40 border-b border-grafite-700 bg-grafite-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src={logoStamp}
              alt=""
              className="h-10 w-10 rounded-full mix-blend-lighten"
            />
            <span className="hidden font-display text-lg font-bold uppercase tracking-tight sm:block">
              100PRESSÃO
            </span>
          </div>
          <nav className="flex gap-1 sm:gap-2" aria-label="Módulos da equipa">
            {MODULOS.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors sm:px-4 sm:text-sm ${
                    isActive
                      ? 'bg-ambar-500 text-grafite-950'
                      : 'text-creme-300 hover:text-creme-50'
                  }`
                }
              >
                {m.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-creme-500 hover:text-creme-50"
          >
            Sair
          </button>
        </div>
      </header>
      <Outlet />
    </div>
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
