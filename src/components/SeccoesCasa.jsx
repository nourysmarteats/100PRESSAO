import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'

const EASE_OUT = [0.22, 1, 0.36, 1]

/* Ícones de linha (48×48, stroke) — desenhados inline para não depender de assets */

function IconePetiscos({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 26h32a16 16 0 0 1-32 0Z" />
      <path d="M19 20c0-2 2-2 2-4s-2-2-2-4" />
      <path d="M28 20c0-2 2-2 2-4s-2-2-2-4" />
    </svg>
  )
}

function IconeCerveja({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 18v18a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V18" />
      <path d="M31 22h3a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-3" />
      <path d="M12 18a4 4 0 0 1-1.5-7.2A5 5 0 0 1 16 5.6a5 5 0 0 1 8.3-1.4A5 5 0 0 1 32 8.4a4.2 4.2 0 0 1 0 9.6Z" />
      <path d="M19 25v8M25 25v8" />
    </svg>
  )
}

function IconeRefrigerante({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 14h20l-2.5 26h-15Z" />
      <path d="M27 14l6-9" />
      <path d="M15.7 21h16.6" />
      <circle cx="22" cy="28" r="1.4" />
      <circle cx="26.5" cy="33" r="1.4" />
    </svg>
  )
}

function IconeCaipirinha({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 14h22v20a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4Z" />
      <path d="M18 26l4-4 4 4 4-4" />
      <circle cx="35" cy="10" r="5" />
      <path d="M35 5v10M30 10h10" />
    </svg>
  )
}

function IconeVinho({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 6h18c0 10-4 16-9 16s-9-6-9-16Z" />
      <path d="M15.8 13h16.4" />
      <path d="M24 22v13" />
      <path d="M17 40h14" />
    </svg>
  )
}

/*
 * Refrigerantes, Espirituosas e Vinhos ainda não existem no schema Supabase
 * (só Cervejas/Petiscos) — os textos dessas secções são placeholders até a
 * lista real (nome, descrição, preço, alergénios) ser entregue à Rita Falcão.
 */
const SECCOES = [
  {
    id: 'petiscos',
    titulo: 'Petiscos',
    descricao:
      'Tradição portuguesa e alma brasileira na mesma tábua: petiscos feitos na hora, para comer à mão e partilhar sem cerimónia.',
    disponivel: true,
    Icone: IconePetiscos,
  },
  {
    id: 'cervejas',
    titulo: 'Cervejas',
    descricao:
      'Cerveja europeia a sério, tirada à pressão certa — do tanque ao copo, sem atalhos.',
    disponivel: true,
    Icone: IconeCerveja,
  },
  {
    id: 'refrigerantes',
    titulo: 'Refrigerantes',
    descricao:
      'Bem gelados, para todas as idades e para os dias sem álcool. A lista completa está a chegar ao cardápio digital.',
    disponivel: false,
    Icone: IconeRefrigerante,
  },
  {
    id: 'espirituosas',
    titulo: 'Espirituosas',
    descricao:
      'Caipirinha brasileira feita como deve ser, panaché fresquinho e outras misturas com personalidade.',
    disponivel: false,
    Icone: IconeCaipirinha,
  },
  {
    id: 'vinhos',
    titulo: 'Vinhos',
    descricao:
      'Uma seleção curta de vinhos para acompanhar o petisco — escolhidos com o mesmo critério da cerveja.',
    disponivel: false,
    Icone: IconeVinho,
  },
]

const entrada = (prefersReducedMotion) => ({
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
})

function Teaser({ seccao, i }) {
  const ref = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Profundidade em 3 camadas: palavra de fundo (lenta), disco (média), texto (subtil)
  const palavraY = useTransform(scrollYProgress, [0, 1], [80, -80])
  const discoY = useTransform(scrollYProgress, [0, 1], [48, -48])
  const textoY = useTransform(scrollYProgress, [0, 1], [20, -20])

  const invertido = i % 2 === 1
  const variantes = entrada(prefersReducedMotion)
  const { Icone } = seccao

  return (
    <div ref={ref} className="relative overflow-hidden py-14 sm:py-20">
      {/* Camada 1: palavra gigante de fundo */}
      <motion.span
        aria-hidden="true"
        style={prefersReducedMotion ? undefined : { y: palavraY }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[24vw] font-bold uppercase leading-none text-creme-50/[0.035] sm:text-[13rem]"
      >
        {seccao.titulo}
      </motion.span>

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 sm:grid-cols-2 sm:gap-16">
        {/* Camada 2: disco cobre com ícone */}
        <motion.div
          style={prefersReducedMotion ? undefined : { y: discoY }}
          className={invertido ? 'sm:order-2' : undefined}
        >
          <motion.div
            variants={variantes}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grain relative mx-auto flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-3xl border border-cobre-500/25 bg-gradient-to-br from-grafite-800 via-grafite-900 to-grafite-950 shadow-2xl shadow-grafite-950/60 sm:max-w-xs"
          >
            {/* Luz quente vinda de cima, como os candeeiros do balcão */}
            <div aria-hidden="true" className="absolute -top-12 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-ambar-500/15 blur-3xl" />
            {/* Reflexo de cobre na base, como o tanque */}
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cobre-600/25 to-transparent" />
            <Icone className="relative h-28 w-28 text-ambar-400 sm:h-32 sm:w-32" />
          </motion.div>
        </motion.div>

        {/* Camada 3: texto */}
        <motion.div
          style={prefersReducedMotion ? undefined : { y: textoY }}
          className={invertido ? 'text-center sm:order-1 sm:text-right' : 'text-center sm:text-left'}
        >
          <motion.div
            variants={variantes}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            <div className={`flex items-center gap-3 ${invertido ? 'justify-center sm:justify-end' : 'justify-center sm:justify-start'}`}>
              <span className="font-display text-sm font-bold tracking-[0.3em] text-cobre-500">
                {String(i + 1).padStart(2, '0')}
              </span>
              {!seccao.disponivel && (
                <span className="rounded-full border border-creme-500/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-creme-500">
                  Em breve
                </span>
              )}
            </div>
            <h3 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-creme-50 sm:text-5xl">
              {seccao.titulo}
            </h3>
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-creme-300 sm:mx-0">
              {seccao.descricao}
            </p>
            <Link
              to="/cardapio"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-ambar-500/60 px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-ambar-400 transition-colors duration-200 hover:bg-ambar-500 hover:text-grafite-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar-400"
            >
              Ver no cardápio
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function SeccoesCasa() {
  const prefersReducedMotion = useReducedMotion()
  const variantes = entrada(prefersReducedMotion)

  return (
    <section id="a-casa" className="relative border-t border-grafite-800 bg-grafite-950 pb-24 pt-20 sm:pt-28">
      <motion.div
        variants={variantes}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mx-auto max-w-2xl px-6 text-center"
      >
        <span className="font-display text-sm font-bold uppercase tracking-[0.3em] text-cobre-500">
          A casa
        </span>
        <h2 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-creme-50 sm:text-5xl">
          Do copo à mesa
        </h2>
        <p className="mt-4 leading-relaxed text-creme-300">
          Um resumo do que servimos no Mercado Municipal de Algés. O cardápio
          completo — com preços e pedidos à mesa — vive no cardápio digital.
        </p>
      </motion.div>

      {SECCOES.map((s, i) => (
        <Teaser key={s.id} seccao={s} i={i} />
      ))}

      <motion.div
        variants={variantes}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="mt-4 px-6 text-center"
      >
        <Link
          to="/cardapio"
          className="inline-flex items-center gap-3 rounded-full bg-ambar-500 px-9 py-4 text-base font-semibold uppercase tracking-widest text-grafite-950 shadow-lg shadow-ambar-600/25 transition-colors duration-300 hover:bg-ambar-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar-400"
        >
          Abrir o cardápio digital
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
          </svg>
        </Link>
      </motion.div>
    </section>
  )
}

export default SeccoesCasa
