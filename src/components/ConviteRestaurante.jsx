// Janela flutuante na página início: convida a experimentar o restaurante
// online. Adapta-se ao interruptor (definicoes 'entrega'.ativo): enquanto não
// está ativo, convida para a pré-visualização/simulação; quando ativar, passa
// a "encomendar". Dispensável (X), lembra o fecho em localStorage.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import { getStoredConsent } from '../lib/analytics'

const KEY = 'convite-restaurante-online-v1'

function ConviteRestaurante() {
  const [visivel, setVisivel] = useState(false)
  const [ativo, setAtivo] = useState(false)

  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1') return
    let cancel = false
    supabase
      ?.from('definicoes')
      .select('valor')
      .eq('chave', 'entrega')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setAtivo(!!data?.valor?.ativo)
      })
    // Só aparece depois de a decisão de cookies estar tomada — evita chocar
    // com o banner de consentimento (ambos vivem no fundo do ecrã).
    const mostrar = () => {
      if (cancel || !getStoredConsent()) return false
      setVisivel(true)
      return true
    }
    if (mostrar()) return () => { cancel = true }
    const iv = setInterval(() => {
      if (mostrar()) clearInterval(iv)
    }, 1000)
    return () => {
      cancel = true
      clearInterval(iv)
    }
  }, [])

  const fechar = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setVisivel(false)
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 right-4 z-40 w-[min(92vw,21rem)] rounded-2xl border border-creme-300 bg-creme-50 p-5 text-left shadow-2xl shadow-grafite-950/40"
          role="dialog"
          aria-label="Restaurante online"
        >
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-grafite-600/60 transition-colors hover:bg-creme-100 hover:text-grafite-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>

          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-cobre-600">
            {ativo ? 'Novidade' : 'Em breve'}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-tight text-grafite-900">
            Restaurante Online
          </h2>
          <p className="mt-1.5 pr-4 text-sm leading-relaxed text-grafite-600">
            {ativo
              ? 'Já pode encomendar para entrega ou levantamento, direto connosco.'
              : 'Estamos a preparar as encomendas online. Experimente a pré-visualização e diga-nos o que acha.'}
          </p>
          <Link
            to={ativo ? '/restaurante' : '/restaurante?preview=1'}
            onClick={fechar}
            className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ambar-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-grafite-950 transition-colors hover:bg-ambar-400"
          >
            {ativo ? 'Encomendar' : 'Experimentar'}
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
            </svg>
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export default ConviteRestaurante
