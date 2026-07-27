// Relatórios — hub central. Reúne os relatórios de STOCK (valor em stock,
// abaixo do mínimo, movimentos) e encaminha para os de VENDAS (Analytics),
// fecho de caixa e faturas, que vivem nas suas próprias secções. `irPara`
// vem do Admin e troca a secção ativa.
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARTAO } from './comuns'

const nf = (n) => Number(n ?? 0).toLocaleString('pt-PT', { maximumFractionDigits: 2 })
const abaixoMin = (it) => Number(it.alerta_minimo) > 0 && Number(it.quantidade) <= Number(it.alerta_minimo)
const ROTULO_MOV = {
  entrada: { rotulo: 'Entrada', sinal: '+', cor: 'text-green-600' },
  saida: { rotulo: 'Saída', sinal: '−', cor: 'text-red-600' },
  venda: { rotulo: 'Venda', sinal: '−', cor: 'text-red-600' },
  ajuste: { rotulo: 'Ajuste', sinal: '=', cor: 'text-grafite-900' },
}

const ATALHOS = [
  { id: 'analytics', titulo: 'Vendas & receita', dica: 'Receita, pedidos, ticket médio, top produtos, horas de pico' },
  { id: 'caixa', titulo: 'Fecho de caixa', dica: 'Apuramento por método de pagamento' },
  { id: 'faturas', titulo: 'Faturas', dica: 'Quem pediu fatura e o NIF' },
]

function Relatorios({ irPara }) {
  const [itens, setItens] = useState(null)
  const [movs, setMovs] = useState([])
  const [semStock, setSemStock] = useState(false)

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const [ri, rm] = await Promise.all([
        supabase.from('stock_items').select('nome, unidade, quantidade, alerta_minimo, custo'),
        supabase
          .from('stock_movements')
          .select('id, tipo, quantidade, motivo, criado_em, stock_items(nome, unidade)')
          .order('criado_em', { ascending: false })
          .limit(80),
      ])
      if (!ativo) return
      if (ri.error) {
        setSemStock(true)
        setItens([])
      } else setItens(ri.data)
      setMovs(rm.data || [])
    })()
    return () => {
      ativo = false
    }
  }, [])

  const baixos = (itens || []).filter(abaixoMin)
  const valor = (itens || []).reduce((s, i) => s + (i.custo != null ? Number(i.quantidade) * Number(i.custo) : 0), 0)

  return (
    <div className="space-y-8">
      {/* Encaminhamento para os relatórios de vendas/caixa/faturas */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Vendas & finanças</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => irPara?.(a.id)}
              className={`${CARTAO} cursor-pointer p-4 text-left transition-colors hover:border-ambar-500`}
            >
              <p className="flex items-center gap-2 font-display font-bold uppercase text-grafite-900">
                {a.titulo}
                <svg className="h-3.5 w-3.5 text-cobre-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
                </svg>
              </p>
              <p className="mt-1 text-xs text-grafite-600/70">{a.dica}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Relatórios de stock */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Stock</h3>
        {semStock ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            As tabelas de stock ainda não existem. Aplica a migração de inventário no Supabase.
          </p>
        ) : itens === null ? (
          <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { rotulo: 'Itens', valor: itens.length },
                { rotulo: 'Abaixo do mínimo', valor: baixos.length, alerta: baixos.length > 0 },
                { rotulo: 'Valor em stock', valor: `${nf(valor)} €` },
              ].map((k) => (
                <div key={k.rotulo} className={`${CARTAO} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{k.rotulo}</p>
                  <p className={`mt-1 font-display text-2xl font-bold ${k.alerta ? 'text-red-600' : 'text-grafite-900'}`}>
                    {k.valor}
                  </p>
                </div>
              ))}
            </div>

            {baixos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">A repor (abaixo do mínimo)</p>
                <ul className="mt-2 space-y-1">
                  {baixos.map((it) => (
                    <li key={it.nome} className={`${CARTAO} flex items-center justify-between px-4 py-2 text-sm`}>
                      <span className="text-grafite-900">{it.nome}</span>
                      <span className="text-red-600">
                        <strong>{nf(it.quantidade)} {it.unidade}</strong> · mín. {nf(it.alerta_minimo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-grafite-600/70">Movimentos recentes</p>
              {movs.length === 0 ? (
                <p className="mt-2 text-sm text-grafite-600/70">Sem movimentos registados.</p>
              ) : (
                <ul className="mt-2 divide-y divide-creme-300 rounded-2xl border border-creme-300 bg-white/70">
                  {movs.map((mv) => {
                    const r = ROTULO_MOV[mv.tipo] || { rotulo: mv.tipo, sinal: '', cor: 'text-grafite-900' }
                    return (
                      <li key={mv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <span className="text-grafite-900">
                          <strong className={r.cor}>{r.sinal}{nf(mv.quantidade)}</strong> {mv.stock_items?.unidade || ''} ·{' '}
                          {mv.stock_items?.nome || '(item removido)'}
                          <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/70">{r.rotulo}</span>
                          {mv.motivo ? <span className="ml-2 text-grafite-600/70">· {mv.motivo}</span> : ''}
                        </span>
                        <span className="text-xs text-grafite-600/70">
                          {new Date(mv.criado_em).toLocaleString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default Relatorios
