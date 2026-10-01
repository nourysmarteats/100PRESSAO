// Utilizações do desconto Cliente Beta no restaurante online.
//
// A validação aceita quem souber o número Beta e o telemóvel do titular (regra
// tolerante: o titular pode encomendar para a família). Este quadro serve para
// ver quem usou cada número e apanhar padrões estranhos. Os dados vêm da RPC
// listar_utilizacoes_cliente_beta_admin (só admin). Conservação: utilizações
// enquanto a adesão estiver ativa + 12 meses; falhas 90 dias.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { CARTAO } from './comuns'

const ALERTAS = {
  nome_diferente: 'Nome do pedido diferente do titular',
  emails_diferentes: 'Número usado com emails diferentes',
  moradas_diferentes: 'Número usado com moradas diferentes',
  muitos_no_dia: 'Mais de 2 utilizações no mesmo dia',
}
const dataHora = (iso) =>
  new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function UtilizacoesClienteBeta() {
  const [dias, setDias] = useState(60)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [soAlertas, setSoAlertas] = useState(false)

  const carregar = useCallback(async () => {
    setErro('')
    const { data, error } = await supabase.rpc('listar_utilizacoes_cliente_beta_admin', { p_dias: dias })
    if (error) {
      setErro('Não foi possível carregar as utilizações.')
      setDados({ utilizacoes: [], tentativas_falhadas: [] })
      return
    }
    setDados(data)
  }, [dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  const util = dados?.utilizacoes || []
  const falhas = dados?.tentativas_falhadas || []
  const comAlerta = util.filter((u) => u.alertas?.length)
  const lista = soAlertas ? comAlerta : util

  return (
    <section className={`${CARTAO} space-y-4 p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Utilizações do desconto online</h3>
          <p className="text-sm text-grafite-600/80">
            Quem usou cada número Beta no restaurante online. Com alerta quando o padrão foge ao normal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-grafite-700">
            <input type="checkbox" checked={soAlertas} onChange={(e) => setSoAlertas(e.target.checked)} className="h-4 w-4 accent-ambar-500" />
            Só com alerta ({comAlerta.length})
          </label>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-lg border border-creme-300 bg-creme-100 px-2 py-1.5" aria-label="Período">
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={365}>12 meses</option>
          </select>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {falhas.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Números com 3 ou mais validações falhadas nos últimos 7 dias</p>
          <p className="mt-1">
            {falhas.map((f) => `#${f.numero} (${f.falhas}×, última ${dataHora(f.ultima)})`).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-red-700/80">Pode ser o titular a enganar-se no telemóvel, ou alguém a tentar adivinhar. Vale a pena falar com o titular.</p>
        </div>
      )}

      {!dados ? (
        <p className="text-sm text-grafite-600">A carregar…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-grafite-600/80">{soAlertas ? 'Sem utilizações com alerta no período.' : 'Sem utilizações no período.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                <th className="py-1 font-semibold">Quando</th>
                <th className="py-1 font-semibold">N.º Beta</th>
                <th className="py-1 font-semibold">Titular</th>
                <th className="py-1 font-semibold">Pedido</th>
                <th className="py-1 font-semibold">Nome no pedido</th>
                <th className="py-1 font-semibold">Email</th>
                <th className="py-1 text-right font-semibold">Total</th>
                <th className="py-1 text-right font-semibold">Desconto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-300">
              {lista.map((u, i) => (
                <tr key={`${u.pedido}-${i}`} className={u.alertas?.length ? 'bg-ambar-500/5' : ''}>
                  <td className="py-1.5 align-top">{dataHora(u.usado_em)}</td>
                  <td className="py-1.5 align-top font-semibold">#{u.numero}</td>
                  <td className="py-1.5 align-top">{u.titular}</td>
                  <td className="py-1.5 align-top">
                    #{u.pedido} · {u.tipo === 'entrega' ? 'entrega' : 'levantamento'}
                    {u.morada && <span className="block text-xs text-grafite-600/70">{u.morada}</span>}
                  </td>
                  <td className="py-1.5 align-top">{u.nome_pedido}</td>
                  <td className="py-1.5 align-top">{u.email}</td>
                  <td className="py-1.5 text-right align-top">{fmt(u.total)}</td>
                  <td className="py-1.5 text-right align-top">
                    {fmt(u.desconto || 0)}
                    {u.alertas?.length > 0 && (
                      <span className="mt-1 block text-left text-xs font-semibold text-ambar-600 sm:text-right">
                        {u.alertas.map((a) => ALERTAS[a] || a).join(' · ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default UtilizacoesClienteBeta
