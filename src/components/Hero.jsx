import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { Link } from 'react-router-dom'
import logoStamp from '../assets/logo-100pressao.png'
import SEOHead from './SEOHead'
import ConviteRestaurante from './ConviteRestaurante'
import { SEO_PAGES } from '../seo/pages'

const MotionLink = motion.create(Link)

const EASE_OUT = [0.22, 1, 0.36, 1]

// Mesmo destino do botão "Como chegar" da página Contacto (fonte única de
// verdade da localização no Google Maps).
const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place//data=!4m2!3m1!1s0xd1ecc607dc2c889:0x1946af38520f51d0?sa=X&ved=1t:8290&ictx=111'

const layers = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.2 },
  },
}

const rise = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
}

function StampBadge() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      variants={rise}
      className="mx-auto mb-8 h-36 w-36 sm:h-44 sm:w-44"
    >
      <motion.img
        src={logoStamp}
        alt="Logótipo 100PRESSÃO Draft House"
        width="640"
        height="640"
        animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="h-full w-full mix-blend-lighten [mask-image:radial-gradient(circle_closest-side,black_78%,transparent_100%)]"
      />
    </motion.div>
  )
}

function Hero() {
  const sectionRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  // Parallax: o brilho de fundo desce mais devagar que o conteúdo
  const glowY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  const parallax = prefersReducedMotion
    ? {}
    : { y: contentY, opacity: contentOpacity }

  return (
    <section
      ref={sectionRef}
      className="grain relative flex min-h-dvh items-center justify-center overflow-hidden bg-grafite-900 px-6"
    >
      <SEOHead {...SEO_PAGES.inicio} />
      {/* Camada 1: fundo — brilho âmbar + vinheta */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={prefersReducedMotion ? undefined : { y: glowY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      >
        <div className="absolute left-1/2 top-1/3 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ambar-500/15 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-grafite-950)_100%)]" />
      </motion.div>

      {/* Camada 2: conteúdo */}
      <motion.div
        variants={layers}
        initial="hidden"
        animate="show"
        style={parallax}
        className="relative z-10 max-w-3xl py-24 text-center"
      >
        <StampBadge />

        <motion.h1
          variants={rise}
          className="font-display text-6xl font-bold uppercase leading-none tracking-tight text-creme-50 sm:text-8xl lg:text-9xl"
        >
          100PRESSÃO
        </motion.h1>

        <motion.p
          variants={rise}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-creme-300 sm:text-xl"
        >
          Cerveja artesanal luso-brasileira, tirada com alma e à pressão.
          Do tanque ao copo, sem atalhos.
        </motion.p>

        {/* Localização para quem chega pela primeira vez */}
        <motion.p
          variants={rise}
          className="mx-auto mt-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-creme-500"
        >
          <svg className="h-4 w-4 text-ambar-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 1.8a4.3 4.3 0 0 0-4.3 4.3c0 3.2 4.3 8.1 4.3 8.1s4.3-4.9 4.3-8.1A4.3 4.3 0 0 0 8 1.8Z" />
            <circle cx="8" cy="6" r="1.5" />
          </svg>
          Mercado Municipal de Carnaxide
        </motion.p>

        <motion.div
          variants={rise}
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
        >
          <MotionLink
            to="/home"
            whileHover="hover"
            whileTap={{ scale: 0.96 }}
            initial="rest"
            animate="rest"
            className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden rounded-full bg-ambar-500 px-9 py-4 text-base font-semibold uppercase tracking-widest text-grafite-950 shadow-lg shadow-ambar-600/25 transition-colors duration-300 hover:bg-ambar-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar-400"
          >
            {/* Varredura de brilho no hover */}
            <motion.span
              aria-hidden="true"
              variants={{
                rest: { x: '-120%' },
                hover: {
                  x: '220%',
                  transition: { duration: 0.7, ease: 'easeInOut' },
                },
              }}
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-creme-50/40"
            />
            <span className="relative">Conhecer a casa</span>
            <motion.svg
              variants={{
                rest: { x: 0 },
                hover: { x: 5, transition: { duration: 0.25, ease: EASE_OUT } },
              }}
              className="relative h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
            </motion.svg>
          </MotionLink>

          {/* CTA secundário: acesso físico direto (abre o Google Maps) */}
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-creme-500/40 px-7 py-4 text-base font-semibold uppercase tracking-widest text-creme-200 transition-colors duration-300 hover:border-ambar-400 hover:text-creme-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 1.8a4.3 4.3 0 0 0-4.3 4.3c0 3.2 4.3 8.1 4.3 8.1s4.3-4.9 4.3-8.1A4.3 4.3 0 0 0 8 1.8Z" />
              <circle cx="8" cy="6" r="1.5" />
            </svg>
            Como chegar
          </a>
        </motion.div>
      </motion.div>

      {/* Camada 3: indicador de scroll — botão que desce ao rodapé
          (morada, horário e contactos) */}
      <motion.button
        type="button"
        onClick={() =>
          document.querySelector('footer')?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
          })
        }
        aria-label="Ver morada, horário e contactos"
        className="group absolute bottom-8 left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
      >
        <motion.span
          animate={prefersReducedMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="block h-9 w-5 rounded-full border border-creme-500/40 p-1 transition-colors group-hover:border-ambar-400"
        >
          <span className="mx-auto block h-2 w-1 rounded-full bg-ambar-400/80" />
        </motion.span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-creme-500 transition-colors group-hover:text-creme-300">
          Contactos
        </span>
      </motion.button>

      {/* Convite ao restaurante online (dispensável, gatilho no interruptor) */}
      <ConviteRestaurante />
    </section>
  )
}

export default Hero
