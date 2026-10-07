// Bloco financeiro do separador Analytics: para onde foi o dinheiro desde o
// início, quem o pôs, e quanto a empresa deve aos sócios.
//
// Não segue o filtro Hoje/7/30 dias do resto do Analytics: o arranque vê-se
// mês a mês, desde o primeiro lançamento.
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { fin } from '../../../lib/financeiro'
import { fmt } from '../../../lib/pedidos'
import { resumoFinanceiro } from '../../../lib/financeiroAnalytics'
import { GRAFICO, TooltipGrafico, CARTAO } from './comuns'

const EIXO = { fill: GRAFICO.tinta, fontSize: 11 }
const eurosEixo = (v) => `${Math.round(v)} €`

function Titulo({ children, nota }) {
  return (
    <div>
      <h3 className="font-display text-lg font-bold uppercase text-grafite-600">{children}</h3>
      {nota && <p className="mt-0.5 text-xs text-grafite-600/70">{nota}</p>}
    </div>
  )
}

function LegendaTexto({ payload }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-grafite-600">
      {payload.map((p) => (
        <li key={p.value} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.value}
        </li>
      ))}
    </ul>
  )
}

export default function FinanceiroAnalytics() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const [rD, rR] = await Promise.all([
          fin().from('v_despesas').select('data, valor, categoria, descricao').range(0, 4999),
          fin().from('receitas_externas').select('data, canal, valor, notas').range(0, 4999),
        ])
        if (rD.error) throw rD.error
        if (rR.error) throw rR.error
        if (ativo) setDados(resumoFinanceiro(rD.data || [], rR.data || []))
      } catch (e) {
        if (ativo) setErro(e?.message || 'Não foi possível carregar o financeiro.')
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <section className="mt-12 border-t border-creme-300 pt-8">
      <h2 className="font-display text-2xl font-bold uppercase text-grafite-900">Financeiro</h2>
      <p className="mt-1 text-sm text-grafite-600/70">
        Desde o primeiro lançamento. Controlo de gestão, não substitui a contabilidade.
      </p>

      {erro && <p className="mt-4 text-sm text-cobre-600">{erro}</p>}
      {!dados && !erro && <p className="mt-4 text-sm text-grafite-600/70">A carregar…</p>}

      {dados && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { rotulo: 'Investido até hoje', valor: dados.totais.investido },
              { rotulo: 'Pago pelo banco', valor: dados.totais.pagoBanco },
              { rotulo: 'Pago do bolso', valor: dados.totais.pagoBolso, nota: 'a reembolsar aos sócios' },
              { rotulo: 'Saldo Revolut (calculado)', valor: dados.totais.saldoBanco, nota: 'conferir com o extrato' },
            ].map((k) => (
              <div key={k.rotulo} className={`${CARTAO} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                  {k.rotulo}
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-grafite-900">{fmt(k.valor)}</p>
                {k.nota && <p className="mt-0.5 text-xs text-grafite-600/70">{k.nota}</p>}
              </div>
            ))}
          </div>

          {/* Despesas por mês, separadas pela origem do dinheiro */}
          <div className={`${CARTAO} mt-6 p-4`}>
            <Titulo nota="Quanto saiu em cada mês, e se saiu da conta da empresa ou do bolso dos sócios.">
              Despesas por mês
            </Titulo>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dados.meses} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRAFICO.grelha} vertical={false} />
                  <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
                  <YAxis tick={EIXO} axisLine={false} tickLine={false} width={56} tickFormatter={eurosEixo} />
                  <Tooltip
                    content={<TooltipGrafico formatador={fmt} />}
                    cursor={{ fill: 'rgba(201, 130, 46, 0.08)' }}
                  />
                  <Legend content={<LegendaTexto />} />
                  <Bar
                    dataKey="banco"
                    name="Pago pelo banco"
                    stackId="d"
                    fill={GRAFICO.serieB}
                    stroke="#f6f1e7"
                    strokeWidth={2}
                    barSize={28}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="bolso"
                    name="Pago do bolso"
                    stackId="d"
                    fill={GRAFICO.serie}
                    stroke="#f6f1e7"
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mesmos números em tabela — leitura exacta e alternativa acessível */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                    <th className="py-2 pr-3 font-semibold">Mês</th>
                    <th className="py-2 pr-3 text-right font-semibold">Banco</th>
                    <th className="py-2 pr-3 text-right font-semibold">Bolso</th>
                    <th className="py-2 pr-3 text-right font-semibold">Total</th>
                    <th className="py-2 text-right font-semibold">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.meses.map((m) => (
                    <tr key={m.chave} className="border-t border-creme-300 text-grafite-900">
                      <td className="py-2 pr-3">{m.rotulo}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.banco)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.bolso)}</td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmt(m.total)}</td>
                      <td className="py-2 text-right tabular-nums text-grafite-600">{fmt(m.acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Curva do investimento acumulado */}
          <div className={`${CARTAO} mt-6 p-4`}>
            <Titulo nota="Tudo o que o 100PRESSÃO já custou, somado mês a mês.">Investimento acumulado</Titulo>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dados.meses} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRAFICO.grelha} vertical={false} />
                  <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
                  <YAxis tick={EIXO} axisLine={false} tickLine={false} width={56} tickFormatter={eurosEixo} />
                  <Tooltip
                    content={<TooltipGrafico formatador={fmt} />}
                    cursor={{ stroke: GRAFICO.tinta, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    name="Acumulado"
                    stroke={GRAFICO.serie}
                    strokeWidth={2}
                    fill={GRAFICO.serie}
                    fillOpacity={0.15}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Por sócio */}
            <div className={`${CARTAO} p-4`}>
              <Titulo nota="Aportes = depósitos na conta. A reembolsar = despesas pagas do bolso.">
                Por sócio
              </Titulo>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                    <th className="py-2 pr-3 font-semibold">Sócio</th>
                    <th className="py-2 pr-3 text-right font-semibold">Aportes</th>
                    <th className="py-2 pr-3 text-right font-semibold">A reembolsar</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.socios.map((s) => (
                    <tr key={s.nome} className="border-t border-creme-300 text-grafite-900">
                      <td className="py-2 pr-3">{s.nome}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(s.aportes)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(s.divida)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{fmt(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Por categoria */}
            <div className={`${CARTAO} p-4`}>
              <Titulo>Despesas por categoria</Titulo>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={dados.categorias.length * 32 + 16}>
                  <BarChart
                    data={dados.categorias}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      width={190}
                      tick={{ fill: GRAFICO.tintaForte, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<TooltipGrafico formatador={fmt} />}
                      cursor={{ fill: 'rgba(201, 130, 46, 0.08)' }}
                    />
                    <Bar
                      dataKey="valor"
                      name="Total"
                      fill={GRAFICO.serie}
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
