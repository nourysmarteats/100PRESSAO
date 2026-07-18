import { motion } from 'framer-motion'
import { useHorario } from '../lib/horario'
import SEOHead from '../components/SEOHead'
import { SEO_PAGES } from '../seo/pages'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place//data=!4m2!3m1!1s0xd1ecc607dc2c889:0x1946af38520f51d0?sa=X&ved=1t:8290&ictx=111'

function InfoIcon({ children }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ambar-500/15 text-cobre-600">
      {children}
    </span>
  )
}

function Contato() {
  const horario = useHorario()
  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.contato} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Contato
          </h1>
          <p className="mt-3 max-w-xl text-lg text-grafite-600">
            Aparece, liga ou manda mensagem. Por cá não há formalidades.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="space-y-6 rounded-2xl border border-creme-300 bg-white/60 p-8"
          >
            {/* Morada */}
            <div className="flex items-start gap-4">
              <InfoIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </InfoIcon>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                  Morada
                </h2>
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-lg leading-snug text-grafite-800 underline-offset-4 hover:underline"
                >
                  Praceta Eugénio de Castro, Loja 6
                  <br />
                  2790-072 Carnaxide
                </a>
              </div>
            </div>

            {/* Horário */}
            <div className="flex items-start gap-4">
              <InfoIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </InfoIcon>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                  Horário
                </h2>
                {/* Editável no admin (Avisos & Horário) */}
                <div className="mt-1 space-y-0.5">
                  {horario.map((l) => (
                    <p key={l.dias} className="text-lg text-grafite-800">
                      {l.dias}, {l.horas}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Telefone / WhatsApp */}
            <div className="flex items-start gap-4">
              <InfoIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M6 3h4l1.5 5-2.3 1.6a12 12 0 0 0 5.2 5.2L16 12.5l5 1.5v4a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
                </svg>
              </InfoIcon>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                  Telefone / WhatsApp
                </h2>
                <a
                  href="https://wa.me/351935995011"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-lg text-grafite-800 underline-offset-4 hover:underline"
                >
                  +351 935 995 011
                </a>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4">
              <InfoIcon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </InfoIcon>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                  Email
                </h2>
                <a
                  href="mailto:geral@100pressao.pt"
                  className="mt-1 block text-lg text-grafite-800 underline-offset-4 hover:underline"
                >
                  geral@100pressao.pt
                </a>
              </div>
            </div>
          </motion.div>

          {/* Mapa incorporado (OpenStreetMap, sem cookies — respeita o
              consentimento). Coordenadas da Praceta Eugénio de Castro, Carnaxide. */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.15 }}
            className="overflow-hidden rounded-2xl border border-creme-300 bg-creme-100/60"
          >
            <iframe
              title="Mapa da localização do 100PRESSÃO em Carnaxide"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-9.2419446%2C38.7237329%2C-9.2319446%2C38.7287329&layer=mapnik&marker=38.7262329%2C-9.2369446"
              loading="lazy"
              className="h-72 w-full border-0"
            />
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border-t border-creme-300 bg-white/60 py-3 text-sm font-semibold uppercase tracking-widest text-cobre-600 transition-colors hover:text-cobre-500"
            >
              Como chegar
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
              </svg>
            </a>
          </motion.div>
        </div>
      </div>
    </main>
  )
}

export default Contato
