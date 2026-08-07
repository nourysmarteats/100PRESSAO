// Conversão do canal online: das encomendas criadas, quantas ficaram pagas —
// por método de pagamento.
//
// Existe por uma razão concreta: entre 1 e 5 de agosto de 2026 acumularam-se
// oito encomendas por cartão sem um único pagamento concluído, e ninguém deu
// por isso durante dias. Um método a 0% aqui grita à primeira vista.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { CARTAO } from './comuns'

const ROTULO = {
  mbway: 'MB Way',
  multibanco: 'Multibanco',
  cartao: 'Cartão / Pay',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
}

// Uma encomenda por pagar pode ser só alguém a hesitar; o alarme é a
// combinação de várias tentativas com zero sucessos.
const estado = (linha) => {
  if (linha.criadas === 0) return { cor: 'text-grafite-600/50', aviso: null }
  if (linha.pagas === 0 && linha.criadas >= 3)
    return { cor: 'text-red-600', aviso: 'Nenhum pagamento concluído — verificar' }
  if (linha.taxa < 40) return { cor: 'text-ambar-600', aviso: 'Conversão baixa' }
  return { cor: 'text-green-700', aviso: null }
}

function ConversaoOnline({ dias = 30 }) {
  const [linhas, setLinhas] = useState(null)

  const carregar = useCallback(async () => {
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    const { data, error } = await supabase
      .from('orders')
      .select('metodo_pagamento, estado_pagamento, total')
      .eq('canal', 'online')
      .gte('criado_em', desde.toISOString())
      .limit(2000)
    if (error) {
      setLinhas([])
      return
    }
    const mapa = new Map()
    for (const o of data || []) {
      const m = o.metodo_pagamento || 'outro'
      const a = mapa.get(m) || { metodo: m, criadas: 0, pagas: 0, receita: 0, perdida: 0 }
      a.criadas += 1
      // 'na_entrega' (dinheiro) é encomenda confirmada, não conversão falhada:
      // não há passo de pagamento que possa correr mal antes da entrega.
      if (o.estado_pagamento === 'pago' || o.estado_pagamento === 'na_entrega') {
        a.pagas += 1
        a.receita += Number(o.total || 0)
      } else {
        a.perdida += Number(o.total || 0)
      }
      mapa.set(m, a)
    }
    setLinhas(
      [...mapa.values()]
        .map((l) => ({ ...l, taxa: l.criadas > 0 ? (l.pagas / l.criadas) * 100 : 0 }))
        .sort((a, b) => b.criadas - a.criadas),
    )
  }, [dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (linhas === null) return null
  if (linhas.length === 0) return null

  const totalCriadas = linhas.reduce((s, l) => s + l.criadas, 0)
  const totalPagas = linhas.reduce((s, l) => s + l.pagas, 0)
  const totalPerdida = linhas.reduce((s, l) => s + l.perdida, 0)

  return (
    <section className="mt-8">
      <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
        Conversão do restaurante online
      </h3>
      <p className="mt-1 text-sm text-grafite-600/70">
        Encomendas criadas que chegaram a ficar pagas, nos últimos {dias} dias.{' '}
        {totalCriadas > 0 && (
          <>
            Global: <strong className="text-grafite-900">{totalPagas}/{totalCriadas}</strong>
            {totalPerdida > 0 && <> · {fmt(totalPerdida)} por concretizar</>}
          </>
        )}
      </p>

      <div className={`${CARTAO} mt-3 divide-y divide-creme-200`}>
        {linhas.map((l) => {
          const e = estado(l)
          return (
            <div key={l.metodo} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-32 shrink-0 text-sm font-semibold text-grafite-900">
                {ROTULO[l.metodo] || l.metodo}
              </span>
              <span className={`font-display text-xl font-bold ${e.cor}`}>
                {l.taxa.toFixed(0)}%
              </span>
              <span className="text-sm text-grafite-600/70">
                {l.pagas} de {l.criadas}
              </span>
              <div className="ml-auto flex items-center gap-3">
                {e.aviso && (
                  <span className={`text-xs font-semibold uppercase tracking-widest ${e.cor}`}>
                    {e.aviso}
                  </span>
                )}
                <span className="text-sm text-grafite-600/70">{fmt(l.receita)}</span>
              </div>
              {/* Barra proporcional à taxa. A zero fica vazia sobre carril
                  vermelho — encher de vermelho leria-se como 100%. */}
              <div
                className={`h-1.5 w-full overflow-hidden rounded-full ${
                  l.pagas === 0 ? 'bg-red-200' : 'bg-creme-300'
                }`}
              >
                <div
                  className="h-full rounded-full bg-ambar-500 transition-[width] duration-300"
                  style={{ width: `${l.taxa}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default ConversaoOnline
