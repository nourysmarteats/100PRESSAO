// Acompanhar a entrega — 100pressao.pt/acompanhar?p=<id da encomenda> (Fase 2B).
//
// O id da encomenda é a credencial, como já acontece na confirmação (estado_pedido):
// só quem fez a encomenda o conhece. Nenhum dado pessoal sai daqui — nem do cliente,
// nem do estafeta. A posição do estafeta só aparece entre "Recolhido" e "Entregue"
// e só se for recente; duas horas depois da entrega o link deixa de responder.
// O mapa é o do OpenStreetMap (sem chave, sem custo).
import { useEffect, useState } from 'react'
import { supabasePublico as supabase } from '../lib/supabase'
import SEOHead from '../components/SEOHead'

const PASSOS = [
  ['preparacao', 'Em preparação'],
  ['estafeta', 'Estafeta a caminho do restaurante'],
  ['caminho', 'A caminho de si'],
  ['entregue', 'Entregue'],
]

function passoAtual(d) {
  if (!d) return -1
  if (d.estado === 'entregue' || d.entrega_estado === 'entregue') return 3
  if (d.entrega_estado === 'recolhido' || d.estado === 'a_caminho') return 2
  if (d.entrega_estado === 'aceite') return 1
  return 0
}

function mapa(lat, lng) {
  const d = 0.008
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function Acompanhar() {
  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('p') : null
  const [dados, setDados] = useState(undefined)

  useEffect(() => {
    if (!supabase || !id || !/^[0-9a-f-]{36}$/i.test(id)) return setDados(null)
    let vivo = true
    async function ver() {
      const { data } = await supabase.rpc('acompanhar_entrega', { p_id: id })
      if (vivo) setDados(data?.[0] || null)
    }
    ver()
    const t = setInterval(ver, 15000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [id])

  const passo = passoAtual(dados)

  return (
    <main className="min-h-screen bg-creme-50 text-grafite-800">
      <SEOHead title="Acompanhar entrega | 100PRESSÃO" description="Acompanhe a sua entrega do restaurante online 100PRESSÃO." path="/acompanhar" noindex />
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Restaurante online</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-grafite-900">
          {dados ? `Encomenda n.º ${dados.numero}` : 'A sua entrega'}
        </h1>

        {dados === undefined ? (
          <p className="mt-6 text-grafite-600">A carregar…</p>
        ) : dados === null ? (
          <p className="mt-6 rounded-2xl border border-creme-300 bg-white/70 p-6 text-grafite-700">
            Este link já não está ativo. Se tiver alguma dúvida sobre a sua encomenda, fale connosco: geral@100pressao.pt
          </p>
        ) : (
          <>
            <ol className="mt-8 space-y-3">
              {PASSOS.map(([chave, rotulo], i) => (
                <li key={chave} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i < passo ? 'bg-emerald-600 text-white' : i === passo ? 'bg-cobre-600 text-creme-50' : 'bg-creme-200 text-grafite-600'}`}>
                    {i < passo ? '✓' : i + 1}
                  </span>
                  <span className={i === passo ? 'font-semibold text-grafite-900' : 'text-grafite-600'}>{rotulo}</span>
                </li>
              ))}
            </ol>

            {passo === 2 && dados.lat != null && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-creme-300">
                <iframe title="Onde está a sua entrega" src={mapa(Number(dados.lat), Number(dados.lng))}
                  className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer" />
                <p className="bg-white/70 px-4 py-2 text-xs text-grafite-600">
                  Posição aproximada, atualizada às {new Date(dados.posicao_em).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.
                </p>
              </div>
            )}
            {passo === 2 && dados.lat == null && (
              <p className="mt-6 text-sm text-grafite-600">A entrega vai a caminho. A posição no mapa aparece quando o estafeta a partilhar.</p>
            )}
            {passo === 3 && <p className="mt-6 text-grafite-700">Bom apetite! Obrigado por encomendar diretamente ao 100PRESSÃO.</p>}
            <p className="mt-8 text-xs text-grafite-600/70">Esta página atualiza-se sozinha e deixa de estar ativa duas horas depois da entrega.</p>
          </>
        )}
      </div>
    </main>
  )
}

export default Acompanhar
