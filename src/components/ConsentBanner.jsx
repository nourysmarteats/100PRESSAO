import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { EVENTO_ABRIR_CONSENTIMENTO, getStoredConsent, setConsent } from '../lib/analytics'

// Aviso de cookies com consentimento por finalidade (análise / publicidade).
// Regras (validadas pela Bea): nada pré-marcado, "Recusar" com o mesmo peso
// visual que "Aceitar", e retirar o consentimento tem de ser tão fácil como
// dá-lo — o link "Gerir cookies" no rodapé reabre este aviso.
const BOTAO =
  'rounded-full border border-grafite-700 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-grafite-900 transition-colors hover:bg-creme-200'

function ConsentBanner() {
  const [visivel, setVisivel] = useState(false)
  const [detalhe, setDetalhe] = useState(false)
  const [analise, setAnalise] = useState(false)
  const [publicidade, setPublicidade] = useState(false)

  useEffect(() => {
    if (!getStoredConsent()) setVisivel(true)
    function abrir() {
      const c = getStoredConsent()
      setAnalise(c?.analise === true)
      setPublicidade(c?.publicidade === true)
      setDetalhe(true)
      setVisivel(true)
    }
    window.addEventListener(EVENTO_ABRIR_CONSENTIMENTO, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_CONSENTIMENTO, abrir)
  }, [])

  function escolher(c) {
    setConsent(c)
    setVisivel(false)
    setDetalhe(false)
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label="Consentimento de cookies"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-creme-300 bg-creme-50/95 p-5 backdrop-blur sm:p-6"
        >
          <div className="mx-auto max-w-5xl">
            <p className="text-sm leading-relaxed text-grafite-700">
              Usamos cookies de <strong>análise</strong> (Google Analytics) para
              perceber como o site é usado e, se deixares, cookies de{' '}
              <strong>publicidade</strong> (Meta e TikTok) para medir os nossos
              anúncios. Nenhum fica ativo sem a tua autorização.{' '}
              <Link to="/cookies" className="font-semibold text-cobre-600 underline-offset-4 hover:underline">
                Saber mais
              </Link>
              .
            </p>

            {detalhe && (
              <fieldset className="mt-4 space-y-3 text-sm text-grafite-700">
                <legend className="sr-only">Escolher finalidades</legend>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked disabled className="mt-1" />
                  <span><strong>Essenciais</strong> — sempre ativos (pedido em curso, a tua escolha de cookies).</span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={analise} onChange={(e) => setAnalise(e.target.checked)} className="mt-1" />
                  <span><strong>Análise</strong> — Google Analytics, estatísticas de utilização do site.</span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={publicidade} onChange={(e) => setPublicidade(e.target.checked)} className="mt-1" />
                  <span><strong>Publicidade</strong> — Pixel da Meta e Pixel do TikTok, para medir encomendas vindas de anúncios.</span>
                </label>
              </fieldset>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => escolher({ analise: false, publicidade: false })} className={BOTAO}>
                Recusar
              </button>
              {detalhe ? (
                <button type="button" onClick={() => escolher({ analise, publicidade })} className={BOTAO}>
                  Guardar escolha
                </button>
              ) : (
                <button type="button" onClick={() => setDetalhe(true)} className={BOTAO}>
                  Personalizar
                </button>
              )}
              <button type="button" onClick={() => escolher({ analise: true, publicidade: true })} className={BOTAO}>
                Aceitar tudo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConsentBanner
