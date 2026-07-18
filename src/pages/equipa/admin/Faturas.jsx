// Registo de faturas pedidas (jul 2026). Mostra, dos pedidos entregues,
// quem pediu fatura (+ NIF) e quem não. A emissão via Vendus é separada e
// entra quando a conta estiver ligada à AT.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt, METODOS_PAGAMENTO } from '../../../lib/pedidos'
import { CARTAO } from './comuns'

const rotuloMetodo = (id) =>
  METODOS_PAGAMENTO.find((m) => m.id === id)?.rotulo || id || '—'

function Faturas() {
  const [periodo, setPeriodo] = useState('semana')
  const [filtro, setFiltro] = useState('todas')
  const [pedidos, setPedidos] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const inicio = new Date()
    if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7)
    if (periodo === 'mes') inicio.setDate(inicio.getDate() - 30)

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, numero, total, metodo_pagamento, criado_em, fatura_pedida, fatura_nif, sessions ( nome_cliente, posicao_mesa )',
      )
      .eq('estado', 'entregue')
      .gte('criado_em', inicio.toISOString())
      .order('criado_em', { ascending: false })
      .limit(500)
    if (error) {
      setErro(
        'Sem acesso aos dados de fatura. A migração SQL (fatura_pedida) já foi aplicada?',
      )
      setPedidos([])
      return
    }
    setErro('')
    setPedidos(data)
  }, [periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (pedidos === null) return <p className="text-grafite-600/70">A carregar…</p>
  if (erro) return <p className={`${CARTAO} p-6 text-grafite-600`}>{erro}</p>

  const comFatura = pedidos.filter((p) => p.fatura_pedida)
  const semFatura = pedidos.filter((p) => !p.fatura_pedida)
  const lista =
    filtro === 'com' ? comFatura : filtro === 'sem' ? semFatura : pedidos

  return (
    <div>
      {/* Período */}
      <div className="flex gap-2">
        {[
          { id: 'dia', rotulo: 'Hoje' },
          { id: 'semana', rotulo: '7 dias' },
          { id: 'mes', rotulo: '30 dias' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              periodo === p.id
                ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { rotulo: 'Entregues', valor: pedidos.length },
          { rotulo: 'Pediram fatura', valor: comFatura.length },
          { rotulo: 'Sem fatura', valor: semFatura.length },
        ].map((k) => (
          <div key={k.rotulo} className={`${CARTAO} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
              {k.rotulo}
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-grafite-900">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="mt-6 flex gap-2">
        {[
          { id: 'todas', rotulo: `Todas (${pedidos.length})` },
          { id: 'com', rotulo: `Com fatura (${comFatura.length})` },
          { id: 'sem', rotulo: `Sem fatura (${semFatura.length})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              filtro === f.id
                ? 'border-grafite-900 bg-grafite-900 text-creme-50'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className={`${CARTAO} mt-4 p-6 text-grafite-600`}>Nada neste filtro.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((p) => (
            <li
              key={p.id}
              className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
            >
              <div>
                <p className="font-semibold text-grafite-900">
                  <span className="font-display text-ambar-600">nº {p.numero}</span>
                  <span className="ml-3">{p.sessions?.nome_cliente || '—'}</span>
                  {p.sessions?.posicao_mesa && (
                    <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/70">
                      {p.sessions.posicao_mesa}
                    </span>
                  )}
                </p>
                <p className="text-sm text-grafite-600/70">
                  {new Date(p.criado_em).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {fmt(p.total)} · {rotuloMetodo(p.metodo_pagamento)}
                </p>
              </div>
              <div className="text-right">
                {p.fatura_pedida ? (
                  <span className="rounded-full bg-ambar-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-ambar-600">
                    Fatura pedida
                  </span>
                ) : (
                  <span className="rounded-full border border-grafite-600/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                    Sem fatura
                  </span>
                )}
                {p.fatura_pedida && (
                  <p className="mt-1 text-xs text-grafite-600">
                    NIF: {p.fatura_nif || 'não indicado'}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-relaxed text-grafite-600/70">
        A emissão automática da fatura (Vendus) entra quando a conta estiver
        ligada à Autoridade Tributária. Até lá, este registo serve para saberes
        quem pediu fatura e o NIF, para emitires como fazes hoje.
      </p>
    </div>
  )
}

export default Faturas
