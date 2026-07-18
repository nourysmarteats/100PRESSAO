import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import SEOHead from '../../components/SEOHead'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

const LINKS = [
  { to: '/privacidade', rotulo: 'Privacidade' },
  { to: '/cookies', rotulo: 'Cookies' },
  { to: '/termos', rotulo: 'Termos' },
]

// Layout partilhado pelas páginas legais (estilo sóbrio, fundo claro).
export function PaginaLegal({ titulo, atualizado, seo, children }) {
  const { pathname } = useLocation()
  return (
    <main className="bg-creme-50 text-grafite-800">
      {seo && <SEOHead {...seo} />}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            {titulo}
          </h1>
          <p className="mt-3 text-sm uppercase tracking-widest text-grafite-600/60">
            Última atualização: {atualizado}
          </p>
        </motion.div>

        <div className="mt-10 space-y-8">{children}</div>

        <nav
          aria-label="Navegar entre documentos legais"
          className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-creme-300 pt-6 text-sm font-semibold uppercase tracking-widest"
        >
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                pathname === l.to
                  ? 'text-grafite-900'
                  : 'text-cobre-600 transition-colors hover:text-cobre-500'
              }
            >
              {l.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}

// Secção de uma página legal (título + corpo).
export function Seccao({ titulo, children }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold uppercase text-cobre-600">{titulo}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-grafite-600">{children}</div>
    </section>
  )
}
