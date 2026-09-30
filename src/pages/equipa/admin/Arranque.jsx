// Arranque e Estabilização: acompanha a abertura online, a fase Beta presencial
// e a inauguração com pedidos, margem líquida, equilíbrio e alertas.
//
// Fontes (nada é lançado duas vezes):
//  - site: orders + order_items (só a partir da abertura online; as simulações ficam de fora)
//  - plataformas: financeiro.receitas_externas (o mesmo lançamento serve o Financeiro)
//  - custos: fichas técnicas (stock_receitas × stock_items.custo)
//  - arranque_config, arranque_checklist, arranque_ocorrencias (só admin)
//  - cliente_beta_validacoes (falhas de validação)
// O cálculo vive em lib/arranque.js e nunca inventa: sem dado, mostra "sem dados".
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { custosPorChave } from '../../../lib/rentabilidade'
import { fin, guardarReceitaExterna, hojeISO } from '../../../lib/financeiro'
import {
  calcularArranque,
  estadoChecklist,
  addDias,
  rotuloCanal,
  CANAIS,
  PLATAFORMAS,
  TIPOS_OCORRENCIA,
} from '../../../lib/arranque'
import { CARTAO, CAMPO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, useAviso } from './comuns'

const SEM = 'sem dados'
const eur = (n) => (n == null ? SEM : fmt(n))
const dataPT = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-PT') : '')
const ABAS = [
  { id: 'geral', rotulo: 'Visão geral' },
  { id: 'registo', rotulo: 'Registo diário' },
  { id: 'checklist', rotulo: 'Checklist' },
  { id: 'config', rotulo: 'Configuração' },
]
const COR_ESTADO = {
  acima: { borda: 'border-l-green-600', texto: 'text-green-700', rotulo: 'acima do equilíbrio' },
  proximo: { borda: 'border-l-ambar-500', texto: 'text-ambar-600', rotulo: 'próximo do equilíbrio' },
  abaixo: { borda: 'border-l-red-500', texto: 'text-red-600', rotulo: 'abaixo do equilíbrio' },
  sem_dados: { borda: 'border-l-creme-300', texto: 'text-grafite-600/70', rotulo: SEM },
}

function Kpi({ rotulo, valor, nota, corNota, borda }) {
  return (
    <div className={`${CARTAO} p-4 ${borda ? `border-l-4 ${borda}` : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{rotulo}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${valor === SEM ? 'text-grafite-600/50' : 'text-grafite-900'}`}>{valor}</p>
      {nota && <p className={`mt-1 text-xs ${corNota || 'text-grafite-600/70'}`}>{nota}</p>}
    </div>
  )
}

function Arranque() {
  const [aba, setAba] = useState('geral')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const { mostrarAviso, Aviso } = useAviso()
  const hoje = hojeISO()

  const carregar = useCallback(async () => {
    setErro('')
    const rCfg = await supabase.from('arranque_config').select('*').maybeSingle()
    if (rCfg.error || !rCfg.data) {
      setErro('Não foi possível carregar a configuração do arranque.')
      return
    }
    const config = rCfg.data
    const inicio = config.inicio_online
    const [rPed, rRec, rPlat, rOc, rBeta, rCk] = await Promise.all([
      supabase
        .from('orders')
        .select('id, criado_em, estado, estado_pagamento, metodo_pagamento, total, portes, estafeta_taxa, desconto_beta, order_items(product_id, variant_id, combo_id, quantidade, preco_unitario)')
        .eq('canal', 'online')
        .gte('criado_em', `${inicio}T00:00:00`)
        .limit(5000),
      supabase.from('stock_receitas').select('product_id, variant_id, combo_id, quantidade, stock_items(custo)'),
      fin().from('receitas_externas').select('id, data, canal, valor, comissao, num_transacoes, notas').in('canal', PLATAFORMAS).gte('data', inicio),
      supabase.from('arranque_ocorrencias').select('*').gte('data', addDias(hoje, -60)).order('data', { ascending: false }).order('criado_em', { ascending: false }),
      supabase.from('cliente_beta_validacoes').select('criado_em').eq('resultado', 'falhou').gte('criado_em', `${addDias(hoje, -7)}T00:00:00`),
      supabase.from('arranque_checklist').select('*').order('canal').order('ordem'),
    ])
    const falhou = [rPed, rRec, rPlat, rOc, rBeta, rCk].find((r) => r.error)
    if (falhou) {
      setErro('Não foi possível carregar todos os dados do arranque.')
      return
    }
    setDados({
      config,
      pedidos: rPed.data,
      custos: custosPorChave(rRec.data),
      plataformas: rPlat.data,
      ocorrencias: rOc.data,
      falhasBeta: rBeta.data,
      checklist: rCk.data,
    })
  }, [hoje])

  useEffect(() => {
    carregar()
  }, [carregar])

  const r = useMemo(() => (dados ? calcularArranque({ ...dados, hoje }) : null), [dados, hoje])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!dados || !r) return <p className="text-grafite-600">A carregar…</p>

  const { config } = dados
  const fases = [
    { id: 'online', rotulo: 'Online', data: config.inicio_online },
    { id: 'beta', rotulo: 'Beta presencial', data: config.inicio_beta_presencial },
    { id: 'inauguracao', rotulo: 'Inauguração', data: config.inauguracao },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Arranque e estabilização</h3>
          <p className="text-sm text-grafite-600/80">
            {r.abriu ? `Dia ${r.diasDecorridos} desde a abertura online` : `Abertura online a ${dataPT(config.inicio_online)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fases.map((f) => (
            <span
              key={f.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                r.fase === f.id ? 'bg-grafite-900 text-creme-50' : 'border border-creme-300 text-grafite-600'
              }`}
            >
              {f.rotulo} · {dataPT(f.data)}
            </span>
          ))}
        </div>
      </header>

      <nav className="flex flex-wrap gap-1" aria-label="Separadores do arranque">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold ${
              aba === a.id ? 'bg-ambar-500 text-grafite-950' : 'text-grafite-600 hover:text-grafite-900'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      {aba === 'geral' && <VisaoGeral r={r} config={config} checklist={dados.checklist} irPara={setAba} />}
      {aba === 'registo' && <Registo r={r} dados={dados} hoje={hoje} recarregar={carregar} mostrarAviso={mostrarAviso} />}
      {aba === 'checklist' && <Checklist itens={dados.checklist} recarregar={carregar} mostrarAviso={mostrarAviso} />}
      {aba === 'config' && <Configuracao key={config.atualizado_em} config={config} recarregar={carregar} mostrarAviso={mostrarAviso} />}
      {Aviso}
    </div>
  )
}

function VisaoGeral({ r, config, checklist, irPara }) {
  const cor = COR_ESTADO[r.estado]
  const estadoCk = estadoChecklist(checklist)
  const meses =
    r.mesesAutonomia == null ? null : r.mesesAutonomia === Infinity ? 'a margem cobre os fixos' : `${r.mesesAutonomia.toFixed(1).replace('.', ',')} meses de autonomia`

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          rotulo={`Pedidos/dia (${r.diasJanela || 7}d)`}
          valor={r.pedidosDia == null ? SEM : r.pedidosDia.toFixed(1).replace('.', ',')}
          nota={r.equilibrioDia == null ? `meta mínima: ${config.meta_minima_dia}/dia` : `equilíbrio: ${r.equilibrioDia.toFixed(1).replace('.', ',')}/dia · ${cor.rotulo}`}
          corNota={cor.texto}
          borda={cor.borda}
        />
        <Kpi
          rotulo="Margem líquida/pedido"
          valor={eur(r.margemMedia)}
          nota={r.janela.pedidosSemMargem ? `${r.janela.pedidosSemMargem} pedido(s) sem margem calculável` : 'depois de comissões e custos'}
          corNota={r.janela.pedidosSemMargem ? 'text-ambar-600' : undefined}
        />
        <Kpi rotulo="Caixa estimada" valor={eur(r.caixa)} nota={meses || `inicial: ${fmt(config.caixa_inicial)}`} />
        <Kpi rotulo="Custo por pedido ADS" valor={SEM} nota="Campanhas chegam na fase 2" />
        <Kpi
          rotulo="Canal mais rentável"
          valor={r.canalTop ? rotuloCanal(r.canalTop.id) : SEM}
          nota={r.canalTop ? `${fmt(r.canalTop.margemMedia)}/pedido${r.canalTop.estimado ? ' (estimado)' : ''}` : undefined}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={`${CARTAO} p-4`}>
          <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Alertas</h4>
          {r.alertas.length === 0 ? (
            <p className="mt-3 text-sm text-grafite-600/80">Sem alertas.</p>
          ) : (
            <ul className="mt-2 divide-y divide-creme-300">
              {r.alertas.map((a, i) => (
                <li key={i} className="flex gap-2 py-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.nivel === 'critico' ? 'bg-red-500' : 'bg-ambar-500'}`} aria-hidden="true" />
                  <span className="text-grafite-900">{a.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`${CARTAO} p-4`}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Checklist de abertura</h4>
            <button type="button" onClick={() => irPara('checklist')} className="text-xs font-semibold text-cobre-600 hover:underline">
              Abrir
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {estadoCk.map((c) => (
              <li key={c.canal} className="flex justify-between">
                <span>{rotuloCanal(c.canal)}</span>
                <span className={c.pronto ? 'text-green-700' : c.criticosPendentes ? 'text-red-600' : 'text-ambar-600'}>
                  {c.feitos}/{c.total} · {c.pronto ? 'pronto' : `${c.criticosPendentes} crítico(s) pendente(s)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${CARTAO} overflow-x-auto p-4`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Por canal, desde a abertura</h4>
        <table className="mt-3 w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
              <th className="py-1 font-semibold">Canal</th>
              <th className="py-1 text-right font-semibold">Pedidos</th>
              <th className="py-1 text-right font-semibold">Faturação</th>
              <th className="py-1 text-right font-semibold">Ticket médio</th>
              <th className="py-1 text-right font-semibold">Margem/pedido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-creme-300">
            {r.porCanal.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5">{c.rotulo}{c.estimado && c.pedidos > 0 ? <span className="ml-1 text-xs text-grafite-600/60">(custo estimado)</span> : null}</td>
                <td className="py-1.5 text-right">{c.pedidos || SEM}</td>
                <td className="py-1.5 text-right">{c.pedidos ? fmt(c.faturacao) : SEM}</td>
                <td className="py-1.5 text-right">{eur(c.ticketMedio)}</td>
                <td className={`py-1.5 text-right ${c.margemMedia < 0 ? 'text-red-600' : ''}`}>{eur(c.margemMedia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-grafite-600/70">
          Custos fixos em vigor: {fmt(r.custosFixos)}/mês. Equilíbrio = custos fixos ÷ margem média por pedido
          {r.equilibrioMes != null ? ` = ${Math.ceil(r.equilibrioMes)} pedidos/mês` : ''}. Food cost do site:{' '}
          {r.foodCost == null ? SEM : `${(r.foodCost * 100).toFixed(1).replace('.', ',')}%`}.
        </p>
      </section>
    </div>
  )
}

function Registo({ r, dados, hoje, recarregar, mostrarAviso }) {
  const [plat, setPlat] = useState({ data: hoje, canal: 'ubereats', num_transacoes: '', valor: '', comissao: '', notas: '' })
  const [oc, setOc] = useState({ data: hoje, canal: 'online', tipo: 'atraso', valor: '', descricao: '' })
  const [aGuardar, setAGuardar] = useState(false)

  async function guardarPlataforma(e) {
    e.preventDefault()
    const pedidos = Number(plat.num_transacoes)
    const valor = Number(String(plat.valor).replace(',', '.'))
    if (!Number.isInteger(pedidos) || pedidos < 0 || !(valor >= 0) || plat.valor === '') {
      mostrarAviso('Indica o número de pedidos e a faturação do dia.')
      return
    }
    setAGuardar(true)
    try {
      await guardarReceitaExterna({
        data: plat.data,
        canal: plat.canal,
        num_transacoes: pedidos,
        valor,
        comissao: plat.comissao === '' ? 0 : Number(String(plat.comissao).replace(',', '.')),
        notas: plat.notas || null,
      })
      mostrarAviso('Dia registado')
      setPlat({ ...plat, num_transacoes: '', valor: '', comissao: '', notas: '' })
      recarregar()
    } catch {
      mostrarAviso('Não foi possível guardar. Tenta de novo.')
    } finally {
      setAGuardar(false)
    }
  }

  async function guardarOcorrencia(e) {
    e.preventDefault()
    setAGuardar(true)
    const { error } = await supabase.from('arranque_ocorrencias').insert({
      data: oc.data,
      canal: oc.canal,
      tipo: oc.tipo,
      valor: oc.valor === '' ? null : Number(String(oc.valor).replace(',', '.')),
      descricao: oc.descricao.trim() || null,
    })
    setAGuardar(false)
    if (error) {
      mostrarAviso('Não foi possível guardar a ocorrência.')
      return
    }
    mostrarAviso('Ocorrência registada')
    setOc({ ...oc, valor: '', descricao: '' })
    recarregar()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={guardarPlataforma} className={`${CARTAO} space-y-3 p-4`}>
          <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Fecho do dia nas plataformas</h4>
          <p className="text-xs text-grafite-600/70">
            Um registo por dia e plataforma; relançar o mesmo dia corrige. Entra também no Financeiro. Comissão vazia usa a percentagem da configuração.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Data<input type="date" value={plat.data} max={hoje} onChange={(e) => setPlat({ ...plat, data: e.target.value })} className={CAMPO} /></label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Plataforma
              <select value={plat.canal} onChange={(e) => setPlat({ ...plat, canal: e.target.value })} className={CAMPO}>
                {PLATAFORMAS.map((p) => <option key={p} value={p}>{rotuloCanal(p)}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Pedidos<input inputMode="numeric" value={plat.num_transacoes} onChange={(e) => setPlat({ ...plat, num_transacoes: e.target.value.replace(/\D/g, '') })} className={CAMPO} /></label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Faturação (€)<input inputMode="decimal" value={plat.valor} onChange={(e) => setPlat({ ...plat, valor: e.target.value })} className={CAMPO} /></label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Comissão (€)<input inputMode="decimal" value={plat.comissao} onChange={(e) => setPlat({ ...plat, comissao: e.target.value })} className={CAMPO} placeholder="da fatura da plataforma" /></label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Notas<input value={plat.notas} onChange={(e) => setPlat({ ...plat, notas: e.target.value })} className={CAMPO} /></label>
          </div>
          <button type="submit" disabled={aGuardar} className={BOTAO_PRIMARIO}>Registar dia</button>
        </form>

        <form onSubmit={guardarOcorrencia} className={`${CARTAO} space-y-3 p-4`}>
          <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Ocorrência</h4>
          <p className="text-xs text-grafite-600/70">Cancelamentos, reembolsos, atrasos, reclamações e artigos em falta. Sem dados pessoais de clientes na descrição.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Data<input type="date" value={oc.data} max={hoje} onChange={(e) => setOc({ ...oc, data: e.target.value })} className={CAMPO} /></label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Canal
              <select value={oc.canal} onChange={(e) => setOc({ ...oc, canal: e.target.value })} className={CAMPO}>
                {CANAIS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Tipo
              <select value={oc.tipo} onChange={(e) => setOc({ ...oc, tipo: e.target.value })} className={CAMPO}>
                {TIPOS_OCORRENCIA.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Valor (€, opcional)<input inputMode="decimal" value={oc.valor} onChange={(e) => setOc({ ...oc, valor: e.target.value })} className={CAMPO} /></label>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-ambar-600">Descrição<input maxLength={500} value={oc.descricao} onChange={(e) => setOc({ ...oc, descricao: e.target.value })} className={CAMPO} placeholder="ex.: feijoada esgotada às 20h" /></label>
          <button type="submit" disabled={aGuardar} className={BOTAO_PRIMARIO}>Registar ocorrência</button>
        </form>
      </div>

      <section className={`${CARTAO} overflow-x-auto p-4`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Dia a dia</h4>
        {r.serie.length === 0 ? (
          <p className="mt-3 text-sm text-grafite-600/80">Sem dados registados desde a abertura.</p>
        ) : (
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                <th className="py-1 font-semibold">Dia</th>
                <th className="py-1 font-semibold">Canal</th>
                <th className="py-1 text-right font-semibold">Pedidos</th>
                <th className="py-1 text-right font-semibold">Faturação</th>
                <th className="py-1 text-right font-semibold">Ticket médio</th>
                <th className="py-1 text-right font-semibold">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-300">
              {r.serie.map((d) => (
                <tr key={`${d.dia}-${d.canal}`}>
                  <td className="py-1.5">{dataPT(d.dia)}</td>
                  <td className="py-1.5">{rotuloCanal(d.canal)}{d.estimado ? <span className="ml-1 text-xs text-grafite-600/60">(est.)</span> : null}</td>
                  <td className="py-1.5 text-right">{d.pedidos}</td>
                  <td className="py-1.5 text-right">{fmt(d.faturacao)}</td>
                  <td className="py-1.5 text-right">{eur(d.ticketMedio)}</td>
                  <td className={`py-1.5 text-right ${d.pedidosSemMargem ? 'text-grafite-600/50' : d.margem < 0 ? 'text-red-600' : ''}`}>
                    {d.pedidosSemMargem ? SEM : fmt(d.margem)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${CARTAO} p-4`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Ocorrências (60 dias)</h4>
        {dados.ocorrencias.length === 0 ? (
          <p className="mt-3 text-sm text-grafite-600/80">Sem ocorrências registadas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-creme-300 text-sm">
            {dados.ocorrencias.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {dataPT(o.data)} · {rotuloCanal(o.canal)} · <strong>{TIPOS_OCORRENCIA.find((t) => t.id === o.tipo)?.rotulo}</strong>
                  {o.descricao ? ` · ${o.descricao}` : ''}
                </span>
                {o.valor != null && <span>{fmt(o.valor)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Checklist({ itens, recarregar, mostrarAviso }) {
  const estados = estadoChecklist(itens)

  async function alternar(item) {
    const { error } = await supabase.from('arranque_checklist').update({ feito: !item.feito }).eq('id', item.id)
    if (error) mostrarAviso('Não foi possível atualizar.')
    else recarregar()
  }
  async function guardarNota(item, notas) {
    if ((item.notas || '') === notas) return
    const { error } = await supabase.from('arranque_checklist').update({ notas: notas || null }).eq('id', item.id)
    if (error) mostrarAviso('Não foi possível guardar a nota.')
    else recarregar()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {estados.map((c) => (
        <section key={c.canal} className={`${CARTAO} p-4`}>
          <div className="flex items-center justify-between">
            <h4 className="font-display text-base font-bold uppercase text-grafite-900">{rotuloCanal(c.canal)}</h4>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${c.pronto ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {c.pronto ? 'Pronto para abrir' : `Bloqueado · ${c.criticosPendentes} crítico(s)`}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {itens.filter((i) => i.canal === c.canal).map((i) => (
              <li key={i.id} className="text-sm">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={i.feito} onChange={() => alternar(i)} className="mt-0.5 h-4 w-4 accent-ambar-500" />
                  <span className={i.feito ? 'text-grafite-600/70 line-through' : 'text-grafite-900'}>
                    {i.item}
                    {i.critico && <span className="ml-1.5 rounded bg-red-50 px-1.5 text-[0.65rem] font-semibold uppercase text-red-700">crítico</span>}
                  </span>
                </label>
                <input
                  defaultValue={i.notas || ''}
                  onBlur={(e) => guardarNota(i, e.target.value.trim())}
                  placeholder="nota (opcional)"
                  className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded border border-transparent bg-transparent px-1 text-xs text-grafite-600 outline-none hover:border-creme-300 focus:border-ambar-500"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const METODOS = [
  { id: 'mbway', rotulo: 'MB Way' },
  { id: 'multibanco', rotulo: 'Multibanco' },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'pix', rotulo: 'Pix' },
  { id: 'dinheiro', rotulo: 'Dinheiro' },
]

const txt = (v) => (v == null ? '' : String(v))
function formInicial(config) {
  return {
    ...Object.fromEntries(
      ['inicio_online', 'inicio_beta_presencial', 'inauguracao', 'custos_fixos_online', 'custos_fixos_presencial', 'caixa_inicial', 'meta_minima_dia', 'meta_estavel_min', 'meta_estavel_max', 'iva_medio_pct', 'embalagem_por_pedido'].map((k) => [k, txt(config[k])]),
    ),
    pag: Object.fromEntries(METODOS.map((m) => {
      const c = config.comissao_pagamento?.[m.id]
      return [m.id, { pct: txt(typeof c === 'number' ? c : c?.pct), fixo: txt(typeof c === 'object' ? c?.fixo : '') }]
    })),
    plat: Object.fromEntries(PLATAFORMAS.map((p) => [p, txt(config.comissao_plataforma_pct?.[p])])),
  }
}

function Configuracao({ config, recarregar, mostrarAviso }) {
  const [f, setF] = useState(() => formInicial(config))
  const n = (v) => (v === '' ? null : Number(String(v).replace(',', '.')))

  async function guardar(e) {
    e.preventDefault()
    const obrig = ['custos_fixos_online', 'custos_fixos_presencial', 'caixa_inicial', 'meta_minima_dia', 'meta_estavel_min', 'meta_estavel_max']
    if (obrig.some((k) => !(n(f[k]) >= 0)) || !f.inicio_online || !f.inicio_beta_presencial || !f.inauguracao) {
      mostrarAviso('Datas, custos fixos, caixa e metas são obrigatórios.')
      return
    }
    const comissao_pagamento = Object.fromEntries(
      METODOS.map((m) => {
        const { pct, fixo } = f.pag[m.id]
        return [m.id, pct === '' && fixo === '' ? null : { pct: n(pct) || 0, fixo: n(fixo) || 0 }]
      }),
    )
    const { error } = await supabase
      .from('arranque_config')
      .update({
        inicio_online: f.inicio_online,
        inicio_beta_presencial: f.inicio_beta_presencial,
        inauguracao: f.inauguracao,
        ...Object.fromEntries([...obrig, 'iva_medio_pct', 'embalagem_por_pedido'].map((k) => [k, n(f[k])])),
        comissao_pagamento,
        comissao_plataforma_pct: Object.fromEntries(PLATAFORMAS.map((p) => [p, n(f.plat[p])])),
      })
      .eq('id', true)
    if (error) {
      mostrarAviso('Não foi possível guardar a configuração.')
      return
    }
    mostrarAviso('Configuração guardada')
    recarregar()
  }

  const campo = (k, rotulo, tipo = 'text') => (
    <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
      {rotulo}
      <input type={tipo} inputMode={tipo === 'text' ? 'decimal' : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={CAMPO} />
    </label>
  )

  return (
    <form onSubmit={guardar} className="space-y-4">
      <section className={`${CARTAO} grid gap-3 p-4 sm:grid-cols-3`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600 sm:col-span-3">Datas e metas</h4>
        {campo('inicio_online', 'Abertura online', 'date')}
        {campo('inicio_beta_presencial', 'Início Beta presencial', 'date')}
        {campo('inauguracao', 'Inauguração', 'date')}
        {campo('meta_minima_dia', 'Meta mínima (pedidos/dia)')}
        {campo('meta_estavel_min', 'Estabilidade: de')}
        {campo('meta_estavel_max', 'Estabilidade: até')}
      </section>
      <section className={`${CARTAO} grid gap-3 p-4 sm:grid-cols-3`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600 sm:col-span-3">Custos e caixa</h4>
        {campo('custos_fixos_online', 'Custos fixos só online (€/mês)')}
        {campo('custos_fixos_presencial', 'Custos fixos com presencial (€/mês)')}
        {campo('caixa_inicial', 'Caixa inicial (€)')}
        {campo('iva_medio_pct', 'IVA médio das vendas (%)')}
        {campo('embalagem_por_pedido', 'Embalagem por pedido (€)')}
      </section>
      <section className={`${CARTAO} p-4`}>
        <h4 className="text-sm font-bold uppercase tracking-widest text-grafite-600">Comissões</h4>
        <p className="mt-1 text-xs text-grafite-600/70">Campo vazio = por configurar: a margem fica "sem dados" até ser preenchido.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METODOS.map((m) => (
            <div key={m.id} className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">{m.rotulo} (%)
                <input inputMode="decimal" value={f.pag[m.id].pct} onChange={(e) => setF({ ...f, pag: { ...f.pag, [m.id]: { ...f.pag[m.id], pct: e.target.value } } })} className={CAMPO} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-widest text-ambar-600">+ fixo (€)
                <input inputMode="decimal" value={f.pag[m.id].fixo} onChange={(e) => setF({ ...f, pag: { ...f.pag, [m.id]: { ...f.pag[m.id], fixo: e.target.value } } })} className={CAMPO} />
              </label>
            </div>
          ))}
          {PLATAFORMAS.map((p) => (
            <label key={p} className="text-xs font-semibold uppercase tracking-widest text-ambar-600">{rotuloCanal(p)} (% sobre a venda)
              <input inputMode="decimal" value={f.plat[p]} onChange={(e) => setF({ ...f, plat: { ...f.plat, [p]: e.target.value } })} className={CAMPO} />
            </label>
          ))}
        </div>
      </section>
      <div className="flex gap-2">
        <button type="submit" className={BOTAO_PRIMARIO}>Guardar</button>
        <button type="button" onClick={() => setF(formInicial(config))} className={BOTAO_SECUNDARIO}>Repor</button>
      </div>
    </form>
  )
}

export default Arranque
