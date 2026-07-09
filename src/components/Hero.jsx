import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import logoStamp from '../assets/logo-100pressao.png'

const EASE_OUT = [0.22, 1, 0.36, 1]

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

        <motion.div variants={rise} className="mt-12">
          {/* Scrolla para as secções da casa na própria Home (suave via CSS) */}
          <motion.a
            href="#a-casa"
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
          </motion.a>
        </motion.div>
      </motion.div>

      {/* Camada 3: indicador de scroll */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
      >
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="h-9 w-5 rounded-full border border-creme-500/40 p-1"
        >
          <div className="mx-auto h-2 w-1 rounded-full bg-ambar-400/80" />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Hero
