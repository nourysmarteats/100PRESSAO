import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import logoStamp from '../assets/logo-100pressao.png'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-grafite-900 sm:text-4xl">
      {children}
    </h2>
  )
}

function PriceTag({ value }) {
  return (
    <span className="shrink-0 font-display text-lg font-bold text-cobre-600">
      {Number(value).toFixed(2).replace('.', ',')} €
    </span>
  )
}

function CervejaCard({ cerveja }) {
  return (
    <div className="rounded-xl border border-creme-300 bg-white/70 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl font-bold uppercase text-grafite-900">
          {cerveja.nome}
        </h3>
        <PriceTag value={cerveja.preco} />
      </div>
      <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-ambar-600">
        {cerveja.estilo} · {Number(cerveja.abv).toFixed(1)}% ABV
      </p>
      {cerveja.descricao && (
        <p className="mt-3 leading-relaxed text-grafite-600">{cerveja.descricao}</p>
      )}
    </div>
  )
}

function PetiscoCard({ petisco }) {
  return (
    <div className="rounded-xl border border-creme-300 bg-white/70 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-xl font-bold uppercase text-grafite-900">
          {petisco.nome}
        </h3>
        <PriceTag value={petisco.preco} />
      </div>
      {petisco.descricao && (
        <p className="mt-3 leading-relaxed text-grafite-600">{petisco.descricao}</p>
      )}
      {petisco.alergenios && (
        <p className="mt-3 text-xs uppercase tracking-widest text-grafite-600/70">
          Alergénios: {petisco.alergenios}
        </p>
      )}
    </div>
  )
}

function ConhecerACasa() {
  const [cervejas, setCervejas] = useState([])
  const [petiscos, setPetiscos] = useState([])
  const [estado, setEstado] = useState('a-carregar') // a-carregar | pronto | erro | indisponivel

  useEffect(() => {
    if (!supabase) {
      setEstado('indisponivel')
      return
    }

    let ativo = true

    async function carregar() {
      const [rCervejas, rPetiscos] = await Promise.all([
        supabase.from('cervejas').select('*').order('ordem', { ascending: true }),
        supabase.from('petiscos').select('*').order('ordem', { ascending: true }),
      ])

      if (!ativo) return

      if (rCervejas.error || rPetiscos.error) {
        setEstado('erro')
        return
      }

      setCervejas(rCervejas.data)
      setPetiscos(rPetiscos.data)
      setEstado('pronto')
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <main className="min-h-dvh bg-creme-50 text-grafite-800">
      {/* Cabeçalho */}
      <header className="border-b border-creme-300 bg-creme-100/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoStamp}
              alt="Logótipo 100PRESSÃO"
              width="48"
              height="48"
              className="h-12 w-12 rounded-full"
            />
            <span className="font-display text-lg font-bold uppercase tracking-tight text-grafite-900">
              100PRESSÃO
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold uppercase tracking-widest text-cobre-600 hover:text-cobre-500"
          >
            ← Início
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-20 px-6 py-16">
        {/* a. História da casa */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <SectionTitle>A nossa história</SectionTitle>
          <div className="mt-6 rounded-2xl border border-creme-300 bg-white/60 p-8 sm:p-10">
            <p className="max-w-2xl text-lg leading-relaxed text-grafite-600">
              [TEXTO A DEFINIR — história da 100PRESSÃO]
            </p>
          </div>
        </motion.section>

        {/* b. Localização e horários */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <SectionTitle>Onde estamos</SectionTitle>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                Morada
              </h3>
              <p className="mt-3 text-lg text-grafite-600">[MORADA A DEFINIR]</p>
              <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-ambar-600">
                Horário
              </h3>
              <p className="mt-3 text-lg text-grafite-600">[HORÁRIO A DEFINIR]</p>
            </div>
            {/* Espaço reservado para mapa incorporado */}
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-creme-500 bg-creme-100/60">
              <p className="text-sm uppercase tracking-widest text-grafite-600/60">
                Mapa em breve
              </p>
            </div>
          </div>
        </motion.section>

        {/* c. Cardápio */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          <SectionTitle>Cardápio</SectionTitle>

          {estado === 'a-carregar' && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-xl border border-creme-300 bg-creme-100"
                />
              ))}
            </div>
          )}

          {(estado === 'erro' || estado === 'indisponivel') && (
            <div className="mt-6 rounded-2xl border border-creme-300 bg-white/60 p-8 text-center">
              <p className="text-lg text-grafite-600">
                O cardápio não está disponível de momento. Volta a tentar daqui a pouco.
              </p>
            </div>
          )}

          {estado === 'pronto' && (
            <div className="mt-6 space-y-14">
              <div>
                <h3 className="font-display text-2xl font-bold uppercase text-cobre-600">
                  Cervejas
                </h3>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  {cervejas.map((c) => (
                    <CervejaCard key={c.id} cerveja={c} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold uppercase text-cobre-600">
                  Petiscos
                </h3>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  {petiscos.map((p) => (
                    <PetiscoCard key={p.id} petisco={p} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.section>
      </div>
    </main>
  )
}

export default ConhecerACasa
