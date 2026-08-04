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

// Métodos de pagamento aceites no restaurante online.
//
// Todos no MESMO contentor e no MESMO tamanho (44×28), porque é isso que faz
// um conjunto destes ler-se como harmonioso: Visa, Multibanco e MB WAY são
// lettering por natureza (não existe pictograma para eles), enquanto o
// Mastercard e o Pix são geometria. Sem uma moldura comum, o conjunto fica
// desirmanado. Monocromáticos em currentColor, como os ícones sociais.
const TILE = 'h-7 w-auto'
const MOLDURA = {
  x: 0.8,
  y: 0.8,
  width: 42.4,
  height: 26.4,
  rx: 4,
  fill: 'none',
  stroke: 'currentColor',
  strokeOpacity: 0.35,
  strokeWidth: 1.4,
}
const TEXTO_MARCA = {
  fill: 'currentColor',
  fontFamily: 'Oswald, Arial Narrow, sans-serif',
  fontWeight: 700,
}

const PAGAMENTOS = [
  {
    nome: 'Multibanco',
    glifo: (
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <text x="22" y="19.5" textAnchor="middle" fontSize="14" letterSpacing="0.5" {...TEXTO_MARCA}>MB</text>
      </svg>
    ),
  },
  {
    nome: 'MB WAY',
    glifo: (
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <text x="22" y="18.5" textAnchor="middle" fontSize="10.5" letterSpacing="0.2" {...TEXTO_MARCA}>MB WAY</text>
      </svg>
    ),
  },
  {
    nome: 'Visa',
    glifo: (
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <text x="22" y="19.5" textAnchor="middle" fontSize="13" fontStyle="italic" letterSpacing="0.4" {...TEXTO_MARCA}>VISA</text>
      </svg>
    ),
  },
  {
    nome: 'Mastercard',
    glifo: (
      // Geometria pura: dois círculos sobrepostos, a traço em monocromático.
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <circle cx="18.4" cy="14" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="25.6" cy="14" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    nome: 'Apple Pay',
    glifo: (
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <g transform="translate(8.5 6.2) scale(0.72)">
          <path
            d="M13.4 12.6c0-1.9 1.5-2.8 1.6-2.9-.9-1.3-2.2-1.5-2.7-1.5-1.2-.1-2.3.7-2.8.7-.6 0-1.5-.7-2.5-.7-1.3 0-2.4.7-3.1 1.9-1.3 2.3-.3 5.6.9 7.4.6.9 1.4 1.9 2.3 1.9.9 0 1.3-.6 2.4-.6s1.5.6 2.5.6c1 0 1.7-.9 2.3-1.8.7-1.1 1-2.1 1-2.1s-1.9-.7-1.9-2.9zM11.6 7.1c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.2 1.1-.5.6-.9 1.5-.8 2.3.8.1 1.7-.4 2.2-1z"
            fill="currentColor"
          />
        </g>
        <text x="30" y="19" textAnchor="middle" fontSize="11" {...TEXTO_MARCA}>Pay</text>
      </svg>
    ),
  },
  {
    nome: 'Google Pay',
    glifo: (
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <g transform="translate(6.5 6.5) scale(0.66)">
          <path
            d="M11 12.1v2h4.7c-.2 1.1-1.3 3.2-4.7 3.2-2.8 0-5.1-2.3-5.1-5.2S8.2 6.9 11 6.9c1.6 0 2.7.7 3.3 1.3l1.6-1.5C14.8 5.6 13.1 5 11 5c-3.9 0-7 3.1-7 7s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5 0-.9-.1-1.2H11z"
            fill="currentColor"
          />
        </g>
        <text x="30" y="19" textAnchor="middle" fontSize="11" {...TEXTO_MARCA}>Pay</text>
      </svg>
    ),
  },
  {
    nome: 'Pix',
    glifo: (
      // Losango com os quatro entalhes — é o que o distingue de um losango comum.
      <svg viewBox="0 0 44 28" className={TILE} aria-hidden="true">
        <rect {...MOLDURA} />
        <g transform="translate(14 3) scale(0.92)">
          <path
            d="M12 2.4 15 5.4a3.2 3.2 0 0 0 2.3.9h.5l3.4 3.4a3.2 3.2 0 0 1 0 4.6L17.8 17.7h-.5a3.2 3.2 0 0 0-2.3.9l-3 3-3-3a3.2 3.2 0 0 0-2.3-.9h-.5L2.8 14.3a3.2 3.2 0 0 1 0-4.6L6.2 6.3h.5A3.2 3.2 0 0 0 9 5.4l3-3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    ),
  },
]

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
        {/* Os métodos de pagamento levam linha própria: são sete e, ao tamanho
            a que se leem bem, não cabem ao lado dos links legais. */}
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <ul
            className="flex flex-wrap items-center justify-center gap-3 text-creme-500 sm:justify-end"
            aria-label="Métodos de pagamento aceites"
          >
            {PAGAMENTOS.map((p) => (
              <li key={p.nome} title={p.nome} className="inline-flex items-center">
                {p.glifo}
                <span className="sr-only">{p.nome}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-creme-500">
            © {new Date().getFullYear()} 100PRESSÃO Draft House
          </p>
          <nav
            aria-label="Documentos legais"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-widest text-creme-500"
          >
            <Link to="/privacidade" className="transition-colors hover:text-creme-50">
              Privacidade
            </Link>
            <Link to="/cookies" className="transition-colors hover:text-creme-50">
              Cookies
            </Link>
            <Link to="/termos" className="transition-colors hover:text-creme-50">
              Termos
            </Link>
            {/* Exigido pelo DL 24/2014 para a venda à distância; tem de estar
                acessível de qualquer página, não só a partir do checkout. */}
            <Link to="/condicoes-venda" className="transition-colors hover:text-creme-50">
              Condições de Venda
            </Link>
            <a
              href="https://www.livroreclamacoes.pt/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-creme-50"
            >
              Livro de Reclamações
            </a>
          </nav>
        </div>
        {/* Identificação (DL 7/2004 / DL 24/2014) — falta conservatória e capital social */}
        <div className="mx-auto max-w-6xl px-6 pb-6 text-center text-[0.7rem] leading-relaxed text-creme-500/60 sm:text-left">
          Sintonia dos Temperos, Lda. · NIPC/matrícula 519521463, CRC de Oeiras · Capital
          social 5000 € · Praceta Eugénio de Castro, Loja 6, 2790-072 Carnaxide
        </div>
      </div>
    </footer>
  )
}

export default Footer
