import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { imagemCategoria } from '../lib/imagensCategoria'
import SEOHead from '../components/SEOHead'
import EncomendaWhatsApp from '../components/EncomendaWhatsApp'
import { SEO_PAGES } from '../seo/pages'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

/* Ícones de linha (48×48, stroke) — placeholder uniforme nas 5 categorias
   até haver fotos reais dos produtos */

function IconePetiscos() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      <path d="M8 26h32a16 16 0 0 1-32 0Z" />
      <path d="M19 20c0-2 2-2 2-4s-2-2-2-4" />
      <path d="M28 20c0-2 2-2 2-4s-2-2-2-4" />
    </svg>
  )
}

function IconeCerveja() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      <path d="M13 18v18a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V18" />
      <path d="M31 22h3a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-3" />
      <path d="M12 18a4 4 0 0 1-1.5-7.2A5 5 0 0 1 16 5.6a5 5 0 0 1 8.3-1.4A5 5 0 0 1 32 8.4a4.2 4.2 0 0 1 0 9.6Z" />
      <path d="M19 25v8M25 25v8" />
    </svg>
  )
}

function IconeRefrigerante() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      <path d="M14 14h20l-2.5 26h-15Z" />
      <path d="M27 14l6-9" />
      <path d="M15.7 21h16.6" />
      <circle cx="22" cy="28" r="1.4" />
      <circle cx="26.5" cy="33" r="1.4" />
    </svg>
  )
}

function IconeCaipirinha() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      <path d="M13 14h22v20a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4Z" />
      <path d="M18 26l4-4 4 4 4-4" />
      <circle cx="35" cy="10" r="5" />
      <path d="M35 5v10M30 10h10" />
    </svg>
  )
}

function IconeVinho() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
      <path d="M15 6h18c0 10-4 16-9 16s-9-6-9-16Z" />
      <path d="M15.8 13h16.4" />
      <path d="M24 22v13" />
      <path d="M17 40h14" />
    </svg>
  )
}

/*
 * Refrigerantes, Espirituosas e Vinhos ainda não têm produtos reais no
 * Supabase (só Cervejas/Petiscos) — seguem como "Em breve" até a lista real
 * (nome, descrição, preço, alergénios) ser entregue à Rita Falcão.
 */
const CATEGORIAS = [
  {
    id: 'petiscos',
    titulo: 'Petiscos',
    descricao:
      'Tradição portuguesa e alma brasileira na mesma tábua: petiscos feitos na hora, para comer à mão e partilhar sem cerimónia.',
    emBreve: false,
    Icone: IconePetiscos,
  },
  {
    id: 'cervejas',
    titulo: 'Cervejas',
    descricao:
      'Cerveja europeia a sério, tirada à pressão certa, do tanque ao copo, sem atalhos.',
    emBreve: false,
    Icone: IconeCerveja,
  },
  {
    id: 'refrigerantes',
    titulo: 'Refrigerantes',
    descricao:
      'Bem gelados, para todas as idades e para os dias sem álcool.',
    emBreve: true,
    Icone: IconeRefrigerante,
  },
  {
    id: 'espirituosas',
    titulo: 'Espirituosas',
    descricao:
      'Caipirinha brasileira feita como deve ser, panaché fresquinho e outras misturas com personalidade.',
    emBreve: true,
    Icone: IconeCaipirinha,
  },
  {
    id: 'vinhos',
    titulo: 'Vinhos',
    descricao:
      'Uma seleção curta de vinhos para acompanhar o petisco, escolhidos com o mesmo critério da cerveja.',
    emBreve: true,
    Icone: IconeVinho,
  },
]

function CartaoCategoria({ categoria, i }) {
  const { Icone } = categoria
  const imagem = imagemCategoria(categoria.titulo)
  return (
    <motion.article
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: i * 0.06 }}
      className="flex flex-col overflow-hidden rounded-2xl border border-creme-300 bg-white/60"
    >
      {imagem && (
        <div className="relative">
          <img
            src={imagem}
            alt={categoria.titulo}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover"
          />
          <span className="absolute bottom-1 right-1 rounded bg-grafite-950/55 px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-wider text-creme-50/85">
            Imagem ilustrativa
          </span>
        </div>
      )}
      <div className="flex grow flex-col p-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ambar-500/15 text-cobre-600">
          <Icone />
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">
            {categoria.titulo}
          </h2>
          {categoria.emBreve && (
            <span className="rounded-full border border-creme-500 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-grafite-600/70">
              Em breve
            </span>
          )}
        </div>
      </div>
      <p className="mt-4 grow leading-relaxed text-grafite-600">
        {categoria.descricao}
      </p>
      <Link
        to="/cardapio"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-ambar-600 underline-offset-4 transition-colors duration-200 hover:text-cobre-600 hover:underline"
      >
        Ver na ementa
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
        </svg>
      </Link>
      </div>
    </motion.article>
  )
}

function Home() {
  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.home} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            A Casa
          </h1>
          <p className="mt-3 max-w-xl text-lg text-grafite-600">
            O que servimos no Mercado Municipal de Carnaxide. A ementa completa,
            com preços e pedidos à mesa, está na ementa digital.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CATEGORIAS.map((c, i) => (
            <CartaoCategoria key={c.id} categoria={c} i={i} />
          ))}

          {/* Fecho: CTA principal para o sistema de pedidos */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: 0.3 }}
            className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-creme-500 bg-creme-100/60 p-8 text-center"
          >
            <p className="text-sm uppercase tracking-widest text-grafite-600/70">
              Para pedir à mesa
            </p>
            <Link
              to="/cardapio"
              className="inline-flex items-center gap-2 rounded-full bg-ambar-500 px-7 py-3 text-sm font-semibold uppercase tracking-widest text-grafite-950 shadow-md shadow-ambar-600/20 transition-colors duration-300 hover:bg-ambar-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ambar-500"
            >
              Abrir a ementa digital
            </Link>
          </motion.div>
        </div>

        {/* Canal remoto (Fase 0): take-away e entrega por WhatsApp */}
        <EncomendaWhatsApp className="mt-8" />
      </div>
    </main>
  )
}

export default Home
