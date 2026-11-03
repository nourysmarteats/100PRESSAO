const ROTULO_ECRA = {
  ligado: 'Ecrã sempre ligado: ativo',
  inativo: 'Ecrã sempre ligado: em pausa',
  indisponivel: 'Ecrã sempre ligado: não suportado neste browser',
  recusado: 'Ecrã sempre ligado: recusado pelo dispositivo (poupança de bateria?)',
}

// Indicador discreto no cabeçalho: verde = o ecrã não apaga.
export default function IndicadorEcra({ estado }) {
  const cor = estado === 'ligado' ? 'bg-emerald-500' : estado === 'inativo' ? 'bg-grafite-600/40' : 'bg-red-500'
  return (
    <span title={ROTULO_ECRA[estado]} aria-label={ROTULO_ECRA[estado]} role="img" className="flex items-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-grafite-600" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span className={`ml-1 h-2 w-2 rounded-full ${cor}`} />
    </span>
  )
}
