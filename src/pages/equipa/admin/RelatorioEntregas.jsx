// Relatório mensal das empresas de entrega (Fase 2B).
//
// Para cada empresa: entregas concluídas, km e custo PREVISTO (congelado em cada
// encomenda com o preço da empresa no momento em que o estafeta aceitou). Serve para
// conferir a fatura mensal da empresa antes de pagar.
//
// "Lançar fatura" cria a despesa no Financeiro com o valor REAL da fatura (categoria
// Serviços externos, fornecedor = a empresa, criado pelo NIPC se ainda não existir) e
// mostra a diferença para o previsto. Empresas de simulação ficam de fora.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { fin, guardarFornecedor, lancarDespesa, listarCategorias, listarFornecedores, hojeISO } from '../../../lib/financeiro'
import { paraNumero } from '../../../lib/empresasEntrega'
import { BOTAO_SECUNDARIO, CARTAO, CAMPO } from './comuns'

const IVA = 0.23
const doMes = (m) => ({ de: `${m}-01T00:00:00`, ate: new Date(new Date(`${m}-01T00:00:00`).setMonth(new Date(`${m}-01T00:00:00`).getMonth() + 1)).toISOString() })

function csv(linhas) {
  const cab = ['numero', 'data', 'km', 'custo_previsto_sem_iva']
  const corpo = linhas.map((l) => [l.numero, l.criado_em.slice(0, 16).replace('T', ' '), l.distancia_km, l.custo_entrega].join(';'))
  return [cab.join(';'), ...corpo].join('\n')
}

function LancarFatura({ empresa, mes, previsto, aoAvisar }) {
  const [valor, setValor] = useState('')
  const [iva, setIva] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const total = paraNumero(valor)
  const diferenca = total > 0 ? Math.round((total - previsto * (1 + IVA)) * 100) / 100 : null

  async function lancar() {
    if (!(total > 0)) return
    setOcupado(true)
    try {
      const categorias = await listarCategorias()
      const categoria = categorias.find((c) => /servi[cç]os externos/i.test(c.nome)) || categorias.find((c) => /outros/i.test(c.nome))
      let fornecedor = (await listarFornecedores()).find((f) => f.nif === empresa.nipc)
      if (!fornecedor) {
        await guardarFornecedor({ nome: empresa.nome_legal, nif: empresa.nipc, email: empresa.contacto_email || null })
        fornecedor = (await listarFornecedores()).find((f) => f.nif === empresa.nipc)
      }
      const { enviado } = await lancarDespesa({
        despesa: {
          data: hojeISO(),
          valor: total,
          iva: paraNumero(iva) || 0,
          categoria_id: categoria.id,
          fornecedor_id: fornecedor?.id || null,
          descricao: `Entregas ${mes} — ${empresa.nome_comercial || empresa.nome_legal} (previsto ${fmt(previsto * (1 + IVA))} c/ IVA)`,
          metodo_pagamento: 'transferencia',
          arranque: false,
        },
      })
      aoAvisar(enviado ? 'Fatura lançada no Financeiro ✓' : 'Guardada; sincroniza quando houver rede.')
      setValor('')
      setIva('')
    } catch {
      aoAvisar('Erro ao lançar a fatura.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-creme-300 pt-3">
      <label className="block"><span className="text-xs text-grafite-600/70">Valor da fatura (c/ IVA)</span>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={`${CAMPO} w-32`} /></label>
      <label className="block"><span className="text-xs text-grafite-600/70">IVA</span>
        <input value={iva} onChange={(e) => setIva(e.target.value)} inputMode="decimal" className={`${CAMPO} w-28`} /></label>
      <button type="button" disabled={ocupado || !(total > 0)} onClick={lancar} className={BOTAO_SECUNDARIO}>Lançar fatura</button>
      {diferenca !== null && (
        <span className={`text-xs font-semibold ${Math.abs(diferenca) < 0.05 ? 'text-emerald-700' : 'text-red-600'}`}>
          {Math.abs(diferenca) < 0.05 ? 'Bate com o previsto' : `Diferença de ${fmt(diferenca)} face ao previsto`}
        </span>
      )}
    </div>
  )
}

function RelatorioEntregas({ empresas, mostrarAviso }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [linhas, setLinhas] = useState([])

  const carregar = useCallback(async () => {
    const { de, ate } = doMes(mes)
    const { data } = await supabase
      .from('orders')
      .select('numero, criado_em, distancia_km, custo_entrega, empresa_entrega_id')
      .not('empresa_entrega_id', 'is', null)
      .eq('entrega_estado', 'entregue')
      .gte('criado_em', new Date(de).toISOString())
      .lt('criado_em', ate)
      .order('criado_em')
    setLinhas(data || [])
  }, [mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  const porEmpresa = useMemo(() => {
    const m = new Map()
    for (const l of linhas) {
      const g = m.get(l.empresa_entrega_id) || { linhas: [], km: 0, previsto: 0 }
      g.linhas.push(l)
      g.km += Number(l.distancia_km || 0)
      g.previsto += Number(l.custo_entrega || 0)
      m.set(l.empresa_entrega_id, g)
    }
    return [...m.entries()].map(([id, g]) => ({ empresa: empresas.find((e) => e.id === id), ...g }))
  }, [linhas, empresas])

  function exportar(g) {
    const blob = new Blob([`﻿${csv(g.linhas)}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `entregas-${mes}-${(g.empresa?.nome_comercial || g.empresa?.nome_legal || 'empresa').replace(/\W+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Lê o financeiro só para garantir que o esquema existe antes de mostrar o botão.
  const [temFinanceiro, setTemFinanceiro] = useState(false)
  useEffect(() => {
    fin()?.from('categorias').select('id').limit(1).then(({ error }) => setTemFinanceiro(!error))
  }, [])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Relatório mensal</h3>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-lg border border-creme-300 bg-creme-50 px-3 py-2 text-sm" />
      </div>
      {porEmpresa.length === 0 ? (
        <p className={`${CARTAO} p-5 text-sm text-grafite-600`}>Sem entregas concluídas neste mês.</p>
      ) : (
        porEmpresa.map((g) => (
          <div key={g.empresa?.id || 'x'} className={`${CARTAO} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-grafite-900">
                  {g.empresa?.nome_comercial || g.empresa?.nome_legal || '—'}
                  {g.empresa?.simulacao && <span className="ml-2 text-xs font-semibold uppercase text-cobre-600">Simulação</span>}
                </p>
                <p className="text-sm text-grafite-600">
                  {g.linhas.length} entregas · {g.km.toFixed(1).replace('.', ',')} km · previsto {fmt(g.previsto)} + IVA = <strong>{fmt(g.previsto * (1 + IVA))}</strong>
                </p>
              </div>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => exportar(g)}>Exportar CSV</button>
            </div>
            {temFinanceiro && g.empresa && !g.empresa.simulacao && (
              <LancarFatura empresa={g.empresa} mes={mes} previsto={g.previsto} aoAvisar={mostrarAviso} />
            )}
          </div>
        ))
      )}
    </section>
  )
}

export default RelatorioEntregas
