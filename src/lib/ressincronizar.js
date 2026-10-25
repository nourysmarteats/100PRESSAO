import { useEffect } from 'react'

// Rede de segurança do tempo real do Supabase.
//
// Com o ecrã apagado (ou a app em segundo plano), o Android congela o
// separador: a ligação de tempo real cai e os eventos dessa janela perdem-se.
// O supabase-js volta a ligar, mas não repete o que falhou. Por isso
// recarregamos quando a página volta a estar visível, quando a rede volta,
// e periodicamente enquanto está visível.
export function useRessincronizar(carregar, intervaloMs = 30000) {
  useEffect(() => {
    const seVisivel = () => {
      if (document.visibilityState === 'visible') carregar()
    }
    document.addEventListener('visibilitychange', seVisivel)
    document.addEventListener('resume', carregar) // Chrome: separador descongelado
    window.addEventListener('pageshow', carregar)
    window.addEventListener('online', carregar)
    const id = setInterval(seVisivel, intervaloMs)
    return () => {
      document.removeEventListener('visibilitychange', seVisivel)
      document.removeEventListener('resume', carregar)
      window.removeEventListener('pageshow', carregar)
      window.removeEventListener('online', carregar)
      clearInterval(id)
    }
  }, [carregar, intervaloMs])
}
