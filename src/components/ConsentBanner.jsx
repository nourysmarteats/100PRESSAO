import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getStoredConsent, setConsent } from '../lib/analytics'

// Banner simples de consentimento (RGPD/ePrivacy) — só pergunta uma vez;
// a escolha fica em localStorage e o Google Analytics só passa a gravar
// depois de "Aceitar" (ver src/lib/analytics.js, Consent Mode v2).
function ConsentBanner() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!getStoredConsent()) setVisivel(true)
  }, [])

  function escolher(valor) {
    setConsent(valor)
    setVisivel(false)
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
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm leading-relaxed text-grafite-700">
              Usamos cookies de análise (Google Analytics) só para perceber
              como o site é usado e melhorá-lo. Não os ativamos sem a tua
              autorização.
            </p>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => escolher('declined')}
                className="rounded-full border border-creme-500 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-grafite-700 transition-colors hover:bg-creme-200"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => escolher('accepted')}
                className="rounded-full bg-ambar-500 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-grafite-950 transition-colors hover:bg-ambar-400"
              >
                Aceitar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConsentBanner
