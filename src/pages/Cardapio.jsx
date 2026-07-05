import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
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

function Cardapio() {
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
    <main className="bg-creme-50 text-grafite-800">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Cardápio
          </h1>
          <p className="mt-3 max-w-xl text-lg text-grafite-600">
            Cerveja europeia a sério e petiscos que atravessam o Atlântico.
          </p>
        </motion.div>

        {estado === 'a-carregar' && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-creme-300 bg-creme-100"
              />
            ))}
          </div>
        )}

        {(estado === 'erro' || estado === 'indisponivel') && (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/60 p-8 text-center">
            <p className="text-lg text-grafite-600">
              O cardápio não está disponível de momento. Volta a tentar daqui a pouco.
            </p>
          </div>
        )}

        {estado === 'pronto' && (
          <div className="mt-10 space-y-14">
            <motion.section
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
            >
              <h2 className="font-display text-2xl font-bold uppercase text-cobre-600">
                Cervejas
              </h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                {cervejas.map((c) => (
                  <CervejaCard key={c.id} cerveja={c} />
                ))}
              </div>
            </motion.section>
            <motion.section
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
            >
              <h2 className="font-display text-2xl font-bold uppercase text-cobre-600">
                Petiscos
              </h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                {petiscos.map((p) => (
                  <PetiscoCard key={p.id} petisco={p} />
                ))}
              </div>
            </motion.section>
          </div>
        )}
      </div>
    </main>
  )
}

export default Cardapio
