import { useEffect, useState } from 'react'

// Mantém o ecrã do dispositivo ligado (Screen Wake Lock API) enquanto o
// componente que chama o hook estiver montado e `ativo` for verdadeiro.
//
// O browser liberta o bloqueio sozinho quando a app vai para segundo plano
// (mudar de app, desligar o ecrã no botão), por isso voltamos a pedi-lo
// sempre que a página fica visível outra vez.
//
// Estados devolvidos:
//   'ligado'        — o ecrã não vai apagar
//   'inativo'       — `ativo` é falso, ou a app está em segundo plano
//   'indisponivel'  — o browser não suporta a API (ou a página não é HTTPS)
//   'recusado'      — o browser recusou o pedido (ex.: modo poupança de bateria)
export function useEcraLigado(ativo) {
  const suportado = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [estado, setEstado] = useState(suportado ? 'inativo' : 'indisponivel')

  useEffect(() => {
    if (!ativo || !suportado) return
    let bloqueio = null
    let desmontado = false

    async function pedir() {
      if (document.visibilityState !== 'visible' || (bloqueio && !bloqueio.released)) return
      try {
        bloqueio = await navigator.wakeLock.request('screen')
        if (desmontado) {
          bloqueio.release()
          return
        }
        setEstado('ligado')
        bloqueio.addEventListener('release', () => {
          if (!desmontado) setEstado('inativo')
        })
      } catch {
        if (!desmontado) setEstado('recusado')
      }
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') pedir()
    }

    pedir()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    // Alguns browsers Android só concedem o pedido depois de um toque.
    document.addEventListener('pointerdown', pedir, { passive: true })
    return () => {
      desmontado = true
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      document.removeEventListener('pointerdown', pedir)
      bloqueio?.release().catch(() => {})
      setEstado('inativo')
    }
  }, [ativo, suportado])

  return estado
}
