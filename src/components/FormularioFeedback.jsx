import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'

const TIPOS = [
  { id: 'sugestao', rotulo: 'Sugestão' },
  { id: 'elogio', rotulo: 'Elogio' },
  { id: 'critica', rotulo: 'Crítica' },
  { id: 'outro', rotulo: 'Outro' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'

function FormularioFeedback() {
  const [tipo, setTipo] = useState('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [nome, setNome] = useState('')
  const [contacto, setContacto] = useState('')
  const [estado, setEstado] = useState('idle') // idle | a_enviar | enviado | erro

  // Sem cliente Supabase (config em falta) não mostramos o formulário
  if (!supabase) return null

  async function enviar(e) {
    e.preventDefault()
    if (!mensagem.trim() || estado === 'a_enviar') return
    setEstado('a_enviar')
    const { error } = await supabase.from('feedback').insert({
      tipo,
      mensagem: mensagem.trim(),
      nome: nome.trim() || null,
      contacto: contacto.trim() || null,
    })
    if (error) {
      setEstado('erro')
      return
    }
    setEstado('enviado')
    setMensagem('')
    setNome('')
    setContacto('')
    setTipo('sugestao')
  }

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className="mt-10 rounded-2xl border border-creme-300 bg-white/60 p-8"
    >
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">
        Deixa-nos a tua opinião
      </h2>
      <p className="mt-2 text-grafite-600">
        Sugestão, elogio ou crítica: lemos tudo e ajuda-nos a melhorar.
      </p>

      {estado === 'enviado' ? (
        <div className="mt-6 rounded-xl border border-ambar-500/50 bg-ambar-500/10 p-6 text-center">
          <p className="font-semibold text-grafite-900">
            Obrigado! Recebemos a tua mensagem.
          </p>
          <button
            type="button"
            onClick={() => setEstado('idle')}
            className="mt-3 cursor-pointer text-sm font-semibold uppercase tracking-widest text-cobre-600 transition-colors hover:text-cobre-500"
          >
            Enviar outra
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
              Tipo
            </span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
              Mensagem *
            </span>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              required
              rows={4}
              maxLength={1000}
              placeholder="Escreve aqui…"
              className={`${CAMPO} resize-none`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                Nome (opcional)
              </span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold uppercase tracking-widest text-ambar-600">
                Email ou telefone (opcional)
              </span>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Se quiseres resposta"
                className={CAMPO}
              />
            </label>
          </div>

          {estado === 'erro' && (
            <p className="text-sm text-red-600" role="alert">
              Não foi possível enviar. Tenta novamente daqui a pouco.
            </p>
          )}

          <button
            type="submit"
            disabled={!mensagem.trim() || estado === 'a_enviar'}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-ambar-500 px-8 py-3 font-semibold uppercase tracking-widest text-grafite-950 transition-colors duration-200 hover:bg-ambar-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {estado === 'a_enviar' ? 'A enviar…' : 'Enviar'}
          </button>
        </form>
      )}
    </motion.section>
  )
}

export default FormularioFeedback
