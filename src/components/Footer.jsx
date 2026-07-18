import { Link } from 'react-router-dom'
import { NAV_LINKS } from './Header'
import { useHorario } from '../lib/horario'
import logoStamp from '../assets/logo-100pressao.png'

const REDES = [
  {
    nome: 'Instagram',
    url: 'https://www.instagram.com/100pressao2026',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    nome: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61591461314419',
    icone: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9v3h2.3v7h2.2Z" />
      </svg>
    ),
  },
  {
    nome: 'TikTok',
    url: 'https://www.tiktok.com/@100pressao2026',
    icone: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M16.6 4c.3 1.7 1.4 3 3.4 3.2v2.6c-1.3 0-2.4-.4-3.4-1v5.7c0 3.1-2.1 5.5-5.3 5.5C8.3 20 6 17.9 6 15.1c0-2.7 2.1-4.9 5-4.9.3 0 .6 0 .9.1v2.7a2.3 2.3 0 0 0-3.2 2.1c0 1.3 1 2.3 2.4 2.3 1.5 0 2.5-1.1 2.5-2.8V4h3Z" />
      </svg>
    ),
  },
]

const PAGAMENTOS = ['Multibanco', 'MB Way', 'Visa', 'Mastercard'] // TODO: confirmar métodos antes de publicar

function Footer() {
  const horario = useHorario()
  return (
    <footer className="bg-grafite-950 text-creme-300">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca + tagline */}
        <div>
          <img
            src={logoStamp}
            alt="Logótipo 100PRESSÃO Draft House"
            width="640"
            height="640"
            className="h-20 w-20 rounded-full mix-blend-lighten"
          />
          <p className="mt-4 max-w-xs leading-relaxed">
            Cervejaria artesanal com alma luso-brasileira. A pressão certa,
            no seu copo!
          </p>
        </div>

        {/* Navegação */}
        <nav aria-label="Navegação do rodapé">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-400">
            Navegação
          </h3>
          <ul className="mt-4 space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="transition-colors hover:text-creme-50">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Horário */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-400">
            Horário
          </h3>
          {/* Editável no admin (Avisos & Horário) — REST sem supabase-js */}
          <div className="mt-4 space-y-2">
            {horario.map((l) => (
              <div key={l.dias}>
                <p>{l.dias}</p>
                <p>{l.horas}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-creme-500">
            Praceta Eugénio de Castro, Loja 6, Carnaxide
          </p>
        </div>

        {/* Contacto rápido + redes */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-400">
            Contacto
          </h3>
          <ul className="mt-4 space-y-2">
            <li>
              <a
                href="https://wa.me/351935995011"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-creme-50"
              >
                WhatsApp +351 935 995 011
              </a>
            </li>
            <li>
              <a href="mailto:geral@100pressao.pt" className="transition-colors hover:text-creme-50">
                geral@100pressao.pt
              </a>
            </li>
            <li>
              <a
                href="https://www.100pressao.pt"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-creme-50"
              >
                www.100pressao.pt
              </a>
            </li>
          </ul>
          <div className="mt-5 flex gap-4" aria-label="Redes sociais">
            {REDES.map((r) =>
              r.url ? (
                <a
                  key={r.nome}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={r.nome}
                  aria-label={r.nome}
                  className="text-creme-500 transition-colors hover:text-creme-50"
                >
                  {r.icone}
                </a>
              ) : (
                <span
                  key={r.nome}
                  title={`${r.nome}: em breve`}
                  aria-label={`${r.nome} (em breve)`}
                  className="text-creme-500/50"
                >
                  {r.icone}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-grafite-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-creme-500">
            © {new Date().getFullYear()} 100PRESSÃO Draft House
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Métodos de pagamento (a confirmar)">
            {PAGAMENTOS.map((p) => (
              <li
                key={p}
                className="rounded border border-grafite-700 px-2.5 py-1 text-xs uppercase tracking-wider text-creme-500"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default Footer
