import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import barril1 from '../assets/barril-1.jpg'
import barril2 from '../assets/barril-2.jpg'
import barril3 from '../assets/barril-3.jpg'
import SEOHead from '../components/SEOHead'
import { SEO_PAGES } from '../seo/pages'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

// Vídeo stock placeholder (Mixkit, licença livre) — barman a tirar cerveja à pressão.
// Auto-hospedado em public/ (720p, 6 MB): servido diretamente do CDN da Mixkit
// ficava preso em readyState 0 — o HEAD respondia 200 mas o stream nunca chegava,
// e o Content-Disposition: attachment deles trava a reprodução nalguns browsers
const VIDEO_URL = '/quem-somos-banner.mp4'

const HISTORIA = [
  'Chamo-me Leandro Miranda e o 100PRESSÃO nasceu de uma vida dividida ao meio, e de uma sócia que acreditou nisso antes de mim.',
  'Vivo na Bélgica há anos, terra onde a cerveja não é só bebida. É cultura, é rigor, é paciência. Ali aprendi o que separa uma cerveja feita a martelo de uma cerveja feita a sério. Mas o coração continua do outro lado, entre Portugal e o Brasil, onde a mesa nunca é só para comer. É para ficar, para contar histórias, para rir alto.',
  'Foi a Neide quem viu a oportunidade primeiro. Quando surgiu a possibilidade de uma loja no Mercado Municipal de Carnaxide, foi ela quem me propôs a sociedade. Foi essa proposta que transformou uma ideia que vivia na minha cabeça há anos num projeto real, com endereço e data para abrir portas.',
  'O 100PRESSÃO é o que acontece quando essas peças se juntam. É um trocadilho, sim, cerveja de pressão, mas é também uma promessa: aqui a pressão é boa. É a pressão do copo bem tirado, do petisco feito na hora, da conversa que não tem pressa de acabar.',
  'Instalados no Mercado Municipal de Carnaxide, trazemos uma cervejaria artesanal com alma luso-brasileira: cerveja europeia a sério, petiscos que atravessam o Atlântico e um atendimento que não conhece formalidades, só hospitalidade.',
  'Não somos uma marca que nasceu numa sala de reuniões. Nascemos de uma saudade, de uma boa cerveja gelada e de uma sócia que disse "vamos fazer isto" no momento certo. O resto construímos todos os dias, copo a copo, mesa a mesa.',
  '100PRESSÃO. A pressão certa, no seu copo!',
]

/*
 * Fotos royalty-free (Openverse/Flickr):
 * barril-1: "Barrels." — Bernard Spragg (domínio público)
 * barril-2: "Taylor's Port Wine Cellar, Vila Nova de Gaia" — Ray in Manila (CC BY)
 * barril-3: "Greene King Brewery Tour" — Karen Roe (CC BY)
 */
const BARRIS = [
  { src: barril1, alt: 'Fileiras de barris de carvalho numa adega', credito: 'Bernard Spragg' },
  { src: barril2, alt: 'Cave escura com barris de carvalho em Vila Nova de Gaia', credito: 'Ray in Manila, CC BY' },
  { src: barril3, alt: 'Barril de cerveja rústico pendurado numa fachada', credito: 'Karen Roe, CC BY' },
]

function BarrilCard({ barril, i, prefersReducedMotion }) {
  // Só animação de entrada (uma vez) — o parallax 3D anterior recalculava
  // transformações na thread principal em cada frame de scroll e congelava
  // a página em telemóveis com menos CPU
  return (
    <motion.figure
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
      className={`overflow-hidden rounded-2xl border border-creme-300 shadow-xl shadow-grafite-900/15 ${
        i === 1 ? 'sm:-mt-8' : 'sm:mt-8'
      }`}
    >
      <img
        src={barril.src}
        alt={barril.alt}
        loading="lazy"
        className="aspect-[4/5] w-full object-cover"
      />
    </motion.figure>
  )
}

function BarrisAnimados() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="mx-auto max-w-5xl px-6">
      <div className="grid grid-cols-3 gap-4 sm:gap-8">
        {BARRIS.map((b, i) => (
          <BarrilCard
            key={b.src}
            barril={b}
            i={i}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-grafite-600/50">
        Fotos: Bernard Spragg · Ray in Manila (CC BY) · Karen Roe (CC BY)
      </p>
    </div>
  )
}

function QuemSomos() {
  const videoRef = useRef(null)

  // iOS/Android podem ignorar o autoplay declarativo (ex.: modo poupança de
  // bateria); repetir via API dá uma segunda oportunidade sem afetar o desktop
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.quemSomos} />
      {/* a. Banner com vídeo em loop */}
      <section className="relative h-[55vh] min-h-80 overflow-hidden bg-grafite-900 sm:h-[65vh]">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-grafite-950/85 via-grafite-950/20 to-grafite-950/40" />
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-6 pb-12"
        >
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-creme-50 sm:text-6xl">
            Quem Somos
          </h1>
          <p className="mt-2 max-w-xl text-lg text-creme-300">
            Uma história com dois lados do Atlântico e um balcão no meio.
          </p>
        </motion.div>
      </section>

      {/* b. Barris estilizados animados */}
      <section className="border-b border-creme-300 bg-creme-100/60 py-16 sm:py-20">
        <BarrisAnimados />
      </section>

      {/* c. História real */}
      <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="space-y-6">
          {HISTORIA.map((paragrafo, i) => (
            <motion.p
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className={
                i === HISTORIA.length - 1
                  ? 'font-display text-2xl font-bold uppercase tracking-tight text-grafite-900'
                  : 'text-lg leading-relaxed text-grafite-600'
              }
            >
              {paragrafo}
            </motion.p>
          ))}
        </div>
      </section>
    </main>
  )
}

export default QuemSomos
