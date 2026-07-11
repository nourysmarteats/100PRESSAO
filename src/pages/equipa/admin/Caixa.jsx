// Fecho de caixa diário (item 4 da v2): total por método de pagamento e
// nº de pedidos do dia, para cruzar com a contabilidade (Ricardo Silva).
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt, METODOS_PAGAMENTO } from '../../../lib/pedidos'
import { CARTAO, CAMPO } from './comuns'

const hoje = () => new Date().toLocaleDateString('sv-SE')

function Caixa() {
  const [dia, setDia] = useState(hoje)
  const [resumo, setResumo] = useState(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const inicio = new Date(`${dia}T00:00:00`)
      const fim = new Date(inicio)
      fim.setDate(fim.getDate() + 1)

      const { data, error } = await supabase
        .from('orders')
        .select('total, metodo_pagamento, estado_pagamento')
        .eq('estado', 'entregue')
        .gte('criado_em', inicio.toISOString())
        .lt('criado_em', fim.toISOString())
      if (!ativo || error) return

      const porMetodo = new Map()
      let total = 0
      data.forEach((o) => {
        const metodo = o.metodo_pagamento || 'sem_registo'
        const atual = porMetodo.get(metodo) || { n: 0, valor: 0 }
        atual.n += 1
        atual.valor += Number(o.total || 0)
        porMetodo.set(metodo, atual)
        total += Number(o.total || 0)
      })
      setResumo({ pedidos: data.length, total, porMetodo })
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [dia])

  const rotuloMetodo = (id) =>
    METODOS_PAGAMENTO.find((m) => m.id === id)?.rotulo ||
    (id === 'sem_registo' ? 'Sem registo' : id)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
            Dia
          </span>
          <input
            type="date"
            value={dia}
            max={hoje()}
            onChange={(e) => setDia(e.target.value)}
            className={`${CAMPO} w-48`}
          />
        </label>
        {dia !== hoje() && (
          <button
            type="button"
            onClick={() => setDia(hoje())}
            className="mt-5 cursor-pointer text-xs font-semibold uppercase tracking-widest text-ambar-600 hover:text-cobre-600"
          >
            ← Voltar a hoje
          </button>
        )}
      </div>

      {resumo && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className={`${CARTAO} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                Total do dia
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-grafite-900">
                {fmt(resumo.total)}
              </p>
            </div>
            <div className={`${CARTAO} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                Pedidos entregues
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-grafite-900">
                {resumo.pedidos}
              </p>
            </div>
          </div>

          <h3 className="mt-8 font-display text-lg font-bold uppercase text-grafite-600">
            Por método de pagamento
          </h3>
          {resumo.porMetodo.size === 0 ? (
            <p className="mt-3 text-grafite-600/70">Sem pedidos entregues neste dia.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {[...resumo.porMetodo.entries()]
                .sort((a, b) => b[1].valor - a[1].valor)
                .map(([metodo, v]) => (
                  <li
                    key={metodo}
                    className={`${CARTAO} flex items-center justify-between px-4 py-3`}
                  >
                    <span className="font-semibold text-grafite-900">{rotuloMetodo(metodo)}</span>
                    <span className="text-grafite-600">
                      {v.n} {v.n === 1 ? 'pedido' : 'pedidos'} ·{' '}
                      <strong className="font-display text-cobre-600">{fmt(v.valor)}</strong>
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-grafite-600/70">
            Inclui apenas pedidos com estado “entregue”. O método é o registado
            pelo staff na entrega.
          </p>
        </>
      )}
    </div>
  )
}

export default Caixa
