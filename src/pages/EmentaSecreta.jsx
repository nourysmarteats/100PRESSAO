// Ementa secreta dos Clientes Beta. View-only: o número abre a ementa, NAO da
// desconto (o 10% e confirmado ao balcao). Os itens vem da RPC ementa_secreta,
// que so responde a um numero de Beta ativo e tem limitador anti-enumeracao.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import { normalizarNumero, buscarEmentaSecreta } from '../lib/ementaSecreta'

const fmt = (n) => (n == null ? '' : `${Number(n).toFixed(2).replace('.', ',')} €`)
const CAMPO =
  'mt-2 w-full rounded-xl border border-grafite-800 bg-grafite-900 px-4 py-3.5 text-center text-3xl font-bold tracking-[0.4em] text-creme-50 outline-none focus:border-ambar-500'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

function EmentaSecreta() {
  const [numero, setNumero] = useState('')
  const [estado, setEstado] = useState('idle') // idle | a_procurar | aberta | vazia | erro
  const [itens, setItens] = useState([])
  const [erro, setErro] = useState('')

  async function abrir(ev) {
    ev.preventDefault()
    const n = normalizarNumero(numero)
    if (!n) {
      setErro('Escreve o teu numero de Cliente Beta (3 digitos).')
      return
    }
    setErro('')
    setEstado('a_procurar')
    const { data, error } = await buscarEmentaSecreta(supabase, n)
    if (error) {
      setEstado('erro')
      setErro(
        error.message && error.message.includes('Demasiadas')
          ? 'Demasiadas tentativas. Tenta daqui a bocado.'
          : 'Nao foi possivel abrir a ementa. Verifica a ligacao e tenta outra vez.',
      )
      return
    }
    if (!data || !data.length) {
      setItens([])
      setEstado('vazia')
      return
    }
    setItens(data)
    setEstado('aberta')
  }

  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const it of itens) {
      const chave = it.categoria || 'Ementa Secreta'
      if (!mapa.has(chave)) mapa.set(chave, { categoria: chave, ordem: it.categoria_ordem ?? 999, itens: [] })
      mapa.get(chave).itens.push(it)
    }
    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem)
  }, [itens])

  return (
    <main className="min-h-dvh bg-grafite-950 text-creme-50">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ambar-500">So para Clientes Beta</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">Ementa Secreta</h1>
          <p className="mt-4 text-lg text-creme-50/70">
            Pratos que so quem e Cliente Beta conhece. Entra com o teu numero para a abrir.
          </p>
        </motion.div>

        {estado !== 'aberta' && (
          <form onSubmit={abrir} className="mt-8 rounded-2xl border border-grafite-800 bg-grafite-900/60 p-8">
            <label className="block text-xs font-semibold uppercase tracking-widest text-ambar-500" htmlFor="numero-beta">
              O teu numero
            </label>
            <input
              id="numero-beta"
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className={CAMPO}
              placeholder="000"
            />
            {erro && <p role="alert" className="mt-4 text-sm text-red-300">{erro}</p>}
            {estado === 'vazia' && (
              <p className="mt-4 text-sm text-creme-50/70">
                Nao encontramos a ementa secreta para esse numero. Confirma que e o teu numero de Cliente Beta ativo. Ainda nao es?{' '}
                <a className="underline" href="/beta">Inscreve-te aqui</a>.
              </p>
            )}
            <button
              type="submit"
              disabled={estado === 'a_procurar'}
              className="mt-6 w-full cursor-pointer rounded-xl bg-cobre-600 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60"
            >
              {estado === 'a_procurar' ? 'A abrir…' : 'Abrir a ementa'}
            </button>
          </form>
        )}

        {estado === 'aberta' && (
          <div className="mt-8 space-y-10">
            {grupos.map((g) => (
              <section key={g.categoria}>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ambar-500">{g.categoria}</h2>
                <ul className="mt-4 divide-y divide-grafite-800">
                  {g.itens.map((it, i) => (
                    <li key={`${it.produto}-${i}`} className="flex items-baseline justify-between gap-4 py-4">
                      <div>
                        <p className="text-lg font-semibold text-creme-50">{it.produto}</p>
                        {(it.estilo || it.abv) && (
                          <p className="text-sm text-creme-50/60">
                            {[it.estilo, it.abv ? `${it.abv}%` : null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-display text-lg text-ambar-500">{fmt(it.preco)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="pt-2 text-sm text-creme-50/60">
              O desconto de 10% de Cliente Beta e aplicado ao balcao, na hora de pagar.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

export default EmentaSecreta
