// Ementa secreta dos Clientes Beta. View-only: o número abre a ementa, NAO da
// desconto (o 10% e confirmado ao balcao). Os itens vem da RPC ementa_secreta,
// que so responde a um Cliente Beta ADERIDO e tem limitador anti-enumeracao.
// Se o numero nao abrir, oferece-se a adesao na hora (numero + telemovel da
// inscricao). Quem recusa fica sem beneficios; nada e gravado.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import { normalizarNumero, buscarEmentaSecreta, aderirDireto, validarAdesaoDireta } from '../lib/ementaSecreta'
import { avisoUrl } from '../lib/beta'

const fmt = (n) => (n == null ? '' : `${Number(n).toFixed(2).replace('.', ',')} €`)
const CAMPO =
  'mt-2 w-full rounded-xl border border-grafite-800 bg-grafite-900 px-4 py-3.5 text-center text-3xl font-bold tracking-[0.4em] text-creme-50 outline-none focus:border-ambar-500'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

function EmentaSecreta() {
  const [numero, setNumero] = useState('')
  const [estado, setEstado] = useState('idle') // idle | a_procurar | aberta | aderir | a_aderir | recusou | erro
  const [adesao, setAdesao] = useState({ telemovel: '', aceita_regulamento: false, aviso_lido: false })
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
      setEstado('aderir')
      return
    }
    setItens(data)
    setEstado('aberta')
  }

  async function aderir(ev) {
    ev.preventDefault()
    if (estado === 'a_aderir') return
    const n = normalizarNumero(numero)
    const erros = validarAdesaoDireta(adesao)
    if (!n) erros.unshift('Escreve o teu numero de Cliente Beta (3 digitos).')
    if (erros.length) return setErro(erros.join(' '))
    setErro('')
    setEstado('a_aderir')
    const { data, error } = await aderirDireto(supabase, n, adesao.telemovel)
    if (error || data !== true) {
      setEstado('aderir')
      setErro(
        error?.message?.includes('Demasiadas')
          ? 'Demasiadas tentativas. Tenta daqui a bocado.'
          : 'Nao conseguimos confirmar a adesao. Verifica o numero e o telemovel com que te inscreveste.',
      )
      return
    }
    const r = await buscarEmentaSecreta(supabase, n)
    if (r.error || !r.data?.length) {
      setEstado('aderir')
      setErro('A adesao ficou registada, mas nao foi possivel abrir a ementa agora. Tenta outra vez daqui a pouco.')
      return
    }
    setItens(r.data)
    setEstado('aberta')
  }

  function recomecar() {
    setEstado('idle')
    setErro('')
    setAdesao({ telemovel: '', aceita_regulamento: false, aviso_lido: false })
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

        {['idle', 'a_procurar', 'erro'].includes(estado) && (
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
            <button
              type="submit"
              disabled={estado === 'a_procurar'}
              className="mt-6 w-full cursor-pointer rounded-xl bg-cobre-600 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60"
            >
              {estado === 'a_procurar' ? 'A abrir…' : 'Abrir a ementa'}
            </button>
          </form>
        )}

        {(estado === 'aderir' || estado === 'a_aderir') && (
          <form onSubmit={aderir} className="mt-8 space-y-5 rounded-2xl border border-grafite-800 bg-grafite-900/60 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-ambar-500">Numero {numero}</p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Ainda nao ativaste o teu estatuto</h2>
            <p className="text-creme-50/70">
              A ementa secreta e o desconto de 10% sao para Clientes Beta. Se te inscreveste na beta, ativa agora: confirma o
              telemovel com que te inscreveste e aceita o regulamento.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ambar-500" htmlFor="telemovel-beta">
                Telemovel da inscricao
              </label>
              <input
                id="telemovel-beta"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={adesao.telemovel}
                onChange={(e) => setAdesao({ ...adesao, telemovel: e.target.value })}
                className="mt-2 w-full rounded-xl border border-grafite-800 bg-grafite-900 px-4 py-3 text-lg text-creme-50 outline-none focus:border-ambar-500"
                placeholder="912 345 678"
              />
            </div>
            <label className="flex items-start gap-3 text-sm text-creme-50/80">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={adesao.aceita_regulamento} onChange={(e) => setAdesao({ ...adesao, aceita_regulamento: e.target.checked })} />
              <span>Aceito o <a className="underline" href="/legal/cliente-beta/regulamento-2026-09-16.v1.txt" target="_blank" rel="noreferrer">regulamento Cliente Beta</a>.</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-creme-50/80">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={adesao.aviso_lido} onChange={(e) => setAdesao({ ...adesao, aviso_lido: e.target.checked })} />
              <span>Li o <a className="underline" href={avisoUrl()} target="_blank" rel="noreferrer">aviso de privacidade</a>.</span>
            </label>
            <p className="text-xs text-creme-50/50">Aderir nao te inscreve em publicidade.</p>
            {erro && <p role="alert" className="text-sm text-red-300">{erro}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={estado === 'a_aderir'}
                className="flex-1 cursor-pointer rounded-xl bg-cobre-600 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60"
              >
                {estado === 'a_aderir' ? 'A ativar…' : 'Aderir e abrir a ementa'}
              </button>
              <button
                type="button"
                onClick={() => { setErro(''); setEstado('recusou') }}
                className="cursor-pointer rounded-xl border border-grafite-700 px-6 py-4 text-sm font-semibold uppercase tracking-widest text-creme-50/70 hover:text-creme-50"
              >
                Agora nao
              </button>
            </div>
            <p className="text-sm text-creme-50/60">
              Ainda nao es beta tester? <a className="underline" href="/beta">Inscreve-te aqui</a>.{' '}
              <button type="button" onClick={recomecar} className="underline">Enganei-me no numero</button>
            </p>
          </form>
        )}

        {estado === 'recusou' && (
          <div className="mt-8 space-y-4 rounded-2xl border border-grafite-800 bg-grafite-900/60 p-8">
            <p className="text-creme-50/80">
              Sem problema. Sem adesao nao tens acesso a ementa secreta nem ao desconto de 10% de Cliente Beta. A tua inscricao
              na beta mantem-se. Se mudares de ideias, e so voltar aqui.
            </p>
            <button type="button" onClick={recomecar} className="underline text-ambar-500">Voltar</button>
          </div>
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
