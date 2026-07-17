import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import logoStamp from '../assets/logo-100pressao.png'

export const NAV_LINKS = [
  { to: '/', label: 'Início' },
  { to: '/quem-somos', label: 'Quem Somos' },
  { to: '/cardapio', label: 'Ementa' },
  { to: '/contato', label: 'Contato' },
  { to: '/faca-parte', label: 'Faça Parte' },
]

function Header() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const escuro = pathname === '/' // home: header sobreposto ao Hero escuro

  const corBase = escuro ? 'text-creme-100' : 'text-grafite-800'
  const corAtiva = escuro ? 'text-ambar-400' : 'text-cobre-600'

  return (
    <header
      className={
        escuro
          ? 'absolute inset-x-0 top-0 z-40'
          : 'sticky top-0 z-40 border-b border-creme-300 bg-creme-50/90 backdrop-blur'
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-4" onClick={() => setAberto(false)}>
          <img
            src={logoStamp}
            alt="Logótipo 100PRESSÃO Draft House"
            width="640"
            height="640"
            className={`h-16 w-16 rounded-full sm:h-20 sm:w-20 ${escuro ? 'mix-blend-lighten' : ''}`}
          />
          <span
            className={`font-display text-xl font-bold uppercase tracking-tight sm:text-2xl ${escuro ? 'text-creme-50' : 'text-grafite-900'}`}
          >
            100PRESSÃO
          </span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-semibold uppercase tracking-widest transition-colors duration-200 hover:${corAtiva} ${isActive ? corAtiva : corBase}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile: hambúrguer */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          className={`cursor-pointer p-2 md:hidden ${corBase}`}
        >
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {aberto ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {aberto && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            aria-label="Navegação principal (móvel)"
            className={`overflow-hidden md:hidden ${escuro ? 'bg-grafite-950/95' : 'border-b border-creme-300 bg-creme-50'}`}
          >
            <ul className="space-y-1 px-6 py-4">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    onClick={() => setAberto(false)}
                    className={({ isActive }) =>
                      `block py-3 text-base font-semibold uppercase tracking-widest ${isActive ? corAtiva : corBase}`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

export default Header
