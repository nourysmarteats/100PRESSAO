// Mostra um texto legal arquivado em docs/consentimentos, tal como está.
//
// O texto vem do próprio ficheiro (import `?raw`), não de uma cópia no JSX:
// a versão que a pessoa lê é, à letra, a versão cuja aceitação fica gravada.
// Duas cópias do mesmo texto acabam sempre por divergir.

function TextoLegal({ texto, alturaMaxima = '22rem' }) {
  const [titulo, versao, ...resto] = String(texto).trim().split('\n')
  const blocos = resto.join('\n').trim().split(/\n\s*\n/)
  return (
    <div className="overflow-y-auto rounded-xl border border-creme-300 bg-creme-50 p-5" style={{ maxHeight: alturaMaxima }}>
      <p className="font-display text-base font-bold uppercase tracking-wide text-grafite-900">{titulo}</p>
      <p className="mt-0.5 text-xs text-grafite-600/70">{versao}</p>
      {blocos.map((b, i) => {
        const [primeira, ...linhas] = b.split('\n')
        return (
          <div key={i} className="mt-4">
            <p className="text-sm font-semibold text-grafite-900">{primeira}</p>
            {linhas.length > 0 && (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-grafite-700">{linhas.join('\n')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TextoLegal
