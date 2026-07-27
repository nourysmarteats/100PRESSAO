// Inventário / controlo de stock — v1. Catálogo de itens (por categoria/
// subcategoria), com alerta de stock baixo e movimentos manuais (entrada/
// saída/ajuste) através da função atómica aplicar_movimento_stock.
// Escrita reservada a admin (RLS). Ver docs/sql/2026-07-27-stock-inventario.sql.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { registarAuditoria } from '../../../lib/equipa'
import { useAviso, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, BOTAO_PERIGO, CARTAO, CAMPO } from './comuns'

const UNIDADES = ['unidade', 'porção', 'dose', 'fatia', 'garrafa', 'lata', 'litro', 'kg', 'g', 'pacote', 'caixa']
const ITEM_VAZIO = { nome: '', categoria: '', subcategoria: '', unidade: 'unidade', alerta_minimo: '', custo: '', quantidade: '' }
const MOVIMENTOS = [
  { tipo: 'entrada', rotulo: 'Entrada', dica: 'chegou stock (+)' },
  { tipo: 'saida', rotulo: 'Saída', dica: 'consumo/quebra (−)' },
  { tipo: 'ajuste', rotulo: 'Ajustar', dica: 'define o total contado' },
]
const ROTULO_MOV = {
  entrada: { rotulo: 'Entrada', sinal: '+', cor: 'text-green-600' },
  saida: { rotulo: 'Saída', sinal: '−', cor: 'text-red-600' },
  venda: { rotulo: 'Venda', sinal: '−', cor: 'text-red-600' },
  ajuste: { rotulo: 'Ajuste', sinal: '=', cor: 'text-grafite-900' },
}

const nf = (n) => Number(n ?? 0).toLocaleString('pt-PT', { maximumFractionDigits: 2 })
const abaixoMin = (it) => Number(it.alerta_minimo) > 0 && Number(it.quantidade) <= Number(it.alerta_minimo)

function Stock() {
  const [itens, setItens] = useState(null)
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(ITEM_VAZIO)
  const [mov, setMov] = useState(null) // { id, tipo, quantidade, motivo }
  const [vendaveis, setVendaveis] = useState([]) // itens vendáveis (p/ receitas)
  const [receitas, setReceitas] = useState([]) // stock_receitas
  const [receitaDe, setReceitaDe] = useState(null) // item cujo painel de receitas está aberto
  const [novaReceita, setNovaReceita] = useState({ chave: '', quantidade: '' })
  const [soBaixo, setSoBaixo] = useState(false) // filtro: só itens abaixo do mínimo
  const [movimentos, setMovimentos] = useState(null) // histórico
  const [verMov, setVerMov] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .order('categoria', { nullsFirst: false })
      .order('subcategoria', { nullsFirst: true })
      .order('nome')
    if (error) {
      setTabelaEmFalta(true)
      setItens([])
    } else {
      setTabelaEmFalta(false)
      setItens(data)
    }
  }, [])
  const carregarReceitas = useCallback(async () => {
    const { data } = await supabase.from('stock_receitas').select('*')
    setReceitas(data || [])
  }, [])

  // Itens vendáveis (produtos sem variante, variantes, combos) para ligar receitas
  const carregarVendaveis = useCallback(async () => {
    const [rProd, rVar, rCombos] = await Promise.all([
      supabase.from('products').select('id, nome').order('nome'),
      supabase.from('product_variants').select('id, product_id, nome'),
      supabase.from('combos').select('id, nome').order('nome'),
    ])
    const varsPorProduto = {}
    ;(rVar.data || []).forEach((v) => {
      ;(varsPorProduto[v.product_id] = varsPorProduto[v.product_id] || []).push(v)
    })
    const opts = []
    ;(rProd.data || []).forEach((p) => {
      const vs = varsPorProduto[p.id] || []
      if (vs.length) {
        vs.forEach((v) =>
          opts.push({ chave: `v:${v.id}`, label: `${p.nome} — ${v.nome}`, product_id: null, variant_id: v.id, combo_id: null }),
        )
      } else {
        opts.push({ chave: `p:${p.id}`, label: p.nome, product_id: p.id, variant_id: null, combo_id: null })
      }
    })
    ;(rCombos.data || []).forEach((c) =>
      opts.push({ chave: `c:${c.id}`, label: `Combo ${c.nome}`, product_id: null, variant_id: null, combo_id: c.id }),
    )
    setVendaveis(opts.sort((a, b) => a.label.localeCompare(b.label)))
  }, [])

  const carregarMovimentos = useCallback(async () => {
    const { data } = await supabase
      .from('stock_movements')
      .select('id, tipo, quantidade, motivo, criado_em, stock_items(nome, unidade)')
      .order('criado_em', { ascending: false })
      .limit(80)
    setMovimentos(data || [])
  }, [])

  useEffect(() => {
    carregar()
    carregarReceitas()
    carregarVendaveis()
    carregarMovimentos()
  }, [carregar, carregarReceitas, carregarVendaveis, carregarMovimentos])

  const categorias = useMemo(
    () => [...new Set((itens || []).map((i) => i.categoria).filter(Boolean))].sort(),
    [itens],
  )
  const subcategorias = useMemo(
    () => [...new Set((itens || []).map((i) => i.subcategoria).filter(Boolean))].sort(),
    [itens],
  )
  const nBaixo = useMemo(() => (itens || []).filter(abaixoMin).length, [itens])
  const valorStock = useMemo(
    () => (itens || []).reduce((s, i) => s + (i.custo != null ? Number(i.quantidade) * Number(i.custo) : 0), 0),
    [itens],
  )

  // Agrupar por categoria › subcategoria (com filtro opcional de stock baixo)
  const grupos = useMemo(() => {
    const m = new Map()
    for (const it of soBaixo ? (itens || []).filter(abaixoMin) : itens || []) {
      const cat = it.categoria || 'Sem categoria'
      const sub = it.subcategoria || ''
      if (!m.has(cat)) m.set(cat, new Map())
      const sm = m.get(cat)
      if (!sm.has(sub)) sm.set(sub, [])
      sm.get(sub).push(it)
    }
    return m
  }, [itens, soBaixo])

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  function abrir(it) {
    setEmEdicao(it ? it.id : 'novo')
    setMov(null)
    setForm(
      it
        ? {
            nome: it.nome,
            categoria: it.categoria || '',
            subcategoria: it.subcategoria || '',
            unidade: it.unidade || 'unidade',
            alerta_minimo: it.alerta_minimo ?? '',
            custo: it.custo ?? '',
            quantidade: '',
          }
        : ITEM_VAZIO,
    )
  }

  async function guardar(e) {
    e.preventDefault()
    const base = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      subcategoria: form.subcategoria.trim() || null,
      unidade: form.unidade.trim() || 'unidade',
      alerta_minimo: form.alerta_minimo === '' ? 0 : Number(form.alerta_minimo),
      custo: form.custo === '' ? null : Number(form.custo),
    }
    let error
    if (emEdicao === 'novo') {
      ;({ error } = await supabase
        .from('stock_items')
        .insert({ ...base, quantidade: form.quantidade === '' ? 0 : Number(form.quantidade) }))
    } else {
      ;({ error } = await supabase.from('stock_items').update(base).eq('id', emEdicao))
    }
    if (error) {
      mostrarAviso(emEdicao === 'novo' ? 'Erro ao criar. Migração de stock aplicada?' : 'Erro ao guardar.')
      return
    }
    registarAuditoria(emEdicao === 'novo' ? 'stock_item_criado' : 'stock_item_editado', { nome: base.nome })
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function apagar(it) {
    if (!window.confirm(`Apagar "${it.nome}" do stock? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('stock_items').delete().eq('id', it.id)
    if (error) {
      mostrarAviso('Não foi possível apagar.')
      return
    }
    registarAuditoria('stock_item_apagado', { nome: it.nome })
    carregar()
  }

  async function confirmarMov() {
    const q = Number(String(mov.quantidade).replace(',', '.'))
    if (!Number.isFinite(q) || q < 0) {
      mostrarAviso('Quantidade inválida.')
      return
    }
    const { error } = await supabase.rpc('aplicar_movimento_stock', {
      p_item: mov.id,
      p_tipo: mov.tipo,
      p_quantidade: q,
      p_motivo: mov.motivo?.trim() || null,
    })
    if (error) {
      mostrarAviso(error.message || 'Erro ao registar o movimento.')
      return
    }
    registarAuditoria('stock_movimento', { tipo: mov.tipo, quantidade: q })
    setMov(null)
    carregar()
    carregarMovimentos()
    mostrarAviso('Movimento registado ✓')
  }

  const receitasPorItem = useMemo(() => {
    const m = {}
    for (const r of receitas) (m[r.stock_item_id] = m[r.stock_item_id] || []).push(r)
    return m
  }, [receitas])

  const labelVendavel = (r) => {
    const o = vendaveis.find(
      (x) =>
        (r.variant_id && x.variant_id === r.variant_id) ||
        (r.combo_id && x.combo_id === r.combo_id) ||
        (r.product_id && x.product_id === r.product_id),
    )
    return o?.label || '(item removido)'
  }

  async function adicionarReceita(stockItemId) {
    const o = vendaveis.find((x) => x.chave === novaReceita.chave)
    const q = Number(String(novaReceita.quantidade).replace(',', '.'))
    if (!o || !Number.isFinite(q) || q <= 0) {
      mostrarAviso('Escolhe o item vendável e a quantidade consumida.')
      return
    }
    const { error } = await supabase.from('stock_receitas').insert({
      stock_item_id: stockItemId,
      product_id: o.product_id,
      variant_id: o.variant_id,
      combo_id: o.combo_id,
      quantidade: q,
    })
    if (error) {
      mostrarAviso('Erro ao ligar a receita. Migração de receitas aplicada?')
      return
    }
    registarAuditoria('stock_receita_ligada', { item: stockItemId, vendavel: o.label, quantidade: q })
    setNovaReceita({ chave: '', quantidade: '' })
    carregarReceitas()
    mostrarAviso('Receita ligada ✓')
  }

  async function apagarReceita(id) {
    const { error } = await supabase.from('stock_receitas').delete().eq('id', id)
    if (error) {
      mostrarAviso('Não foi possível remover.')
      return
    }
    carregarReceitas()
  }

  if (itens === null) return <p className="text-grafite-600/70">A carregar…</p>
  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        As tabelas de stock ainda não existem. Aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">docs/sql/2026-07-27-stock-inventario.sql</code>
        no SQL Editor do Supabase.
      </p>
    )
  }

  return (
    <div>
      <datalist id="stk-cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="stk-subs">{subcategorias.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="stk-uni">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-grafite-600/70">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'} em stock
          {nBaixo > 0 && (
            <span className="ml-2 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest text-red-600">
              {nBaixo} abaixo do mínimo
            </span>
          )}
        </p>
        <button type="button" onClick={() => abrir(null)} className={BOTAO_PRIMARIO}>
          + Novo item
        </button>
      </div>

      {/* Resumo / relatório de stock */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { rotulo: 'Itens', valor: itens.length },
          { rotulo: 'Abaixo do mínimo', valor: nBaixo, alerta: nBaixo > 0 },
          { rotulo: 'Valor em stock', valor: `${nf(valorStock)} €` },
        ].map((k) => (
          <div key={k.rotulo} className={`${CARTAO} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">{k.rotulo}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${k.alerta ? 'text-red-600' : 'text-grafite-900'}`}>
              {k.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSoBaixo((v) => !v)}
          className={soBaixo ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO}
        >
          {soBaixo ? '✓ Só abaixo do mínimo' : 'Só abaixo do mínimo'}
        </button>
        <button type="button" onClick={() => setVerMov((v) => !v)} className={BOTAO_SECUNDARIO}>
          {verMov ? 'Ocultar movimentos' : 'Ver movimentos'}
        </button>
      </div>

      {verMov && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Movimentos recentes</h3>
          {movimentos === null ? (
            <p className="mt-2 text-sm text-grafite-600/70">A carregar…</p>
          ) : movimentos.length === 0 ? (
            <p className="mt-2 text-sm text-grafite-600/70">Sem movimentos registados.</p>
          ) : (
            <ul className="mt-3 divide-y divide-creme-300 rounded-2xl border border-creme-300 bg-white/70">
              {movimentos.map((mv) => {
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
      )}

      {emEdicao && (
        <form
          onSubmit={guardar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-white/70 p-6 sm:grid-cols-2"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Nome *</span>
            <input value={form.nome} onChange={alterar('nome')} required className={CAMPO} placeholder="Ex.: Pão saloio" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Unidade</span>
            <input value={form.unidade} onChange={alterar('unidade')} list="stk-uni" className={CAMPO} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Categoria</span>
            <input value={form.categoria} onChange={alterar('categoria')} list="stk-cats" className={CAMPO} placeholder="Ex.: Bebidas" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Subcategoria</span>
            <input value={form.subcategoria} onChange={alterar('subcategoria')} list="stk-subs" className={CAMPO} placeholder="Ex.: Refrigerantes" />
          </label>
          {emEdicao === 'novo' && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Quantidade inicial</span>
              <input value={form.quantidade} onChange={alterar('quantidade')} type="number" step="0.01" min="0" className={CAMPO} placeholder="0" />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Alerta de stock baixo</span>
            <input value={form.alerta_minimo} onChange={alterar('alerta_minimo')} type="number" step="0.01" min="0" className={CAMPO} placeholder="0 = sem alerta" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Custo por unidade (€)</span>
            <input value={form.custo} onChange={alterar('custo')} type="number" step="0.01" min="0" className={CAMPO} placeholder="opcional" />
          </label>
          {emEdicao !== 'novo' && (
            <p className="text-xs text-grafite-600/70 sm:col-span-2">
              A quantidade em stock altera-se pelos botões Entrada/Saída/Ajustar na lista, não aqui.
            </p>
          )}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => setEmEdicao(null)}
              className="cursor-pointer rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600"
            >
              Cancelar
            </button>
            <button type="submit" className={BOTAO_PRIMARIO}>Guardar</button>
          </div>
        </form>
      )}

      {itens.length === 0 ? (
        <p className={`${CARTAO} mt-6 p-6 text-grafite-600`}>Ainda não há itens. Cria o primeiro com “+ Novo item”.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...grupos.entries()].map(([cat, subs]) => (
            <section key={cat}>
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-grafite-900">{cat}</h3>
              {[...subs.entries()].map(([sub, lista]) => (
                <div key={sub || '_'} className="mt-3">
                  {sub && (
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cobre-600">{sub}</p>
                  )}
                  <ul className="space-y-2">
                    {lista.map((it) => (
                      <li key={it.id} className={`${CARTAO} px-4 py-3`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-grafite-900">
                              {it.nome}
                              {abaixoMin(it) && (
                                <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-red-600">
                                  baixo
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-grafite-600/70">
                              <strong className={abaixoMin(it) ? 'text-red-600' : 'text-grafite-900'}>
                                {nf(it.quantidade)} {it.unidade}
                              </strong>
                              {Number(it.alerta_minimo) > 0 ? ` · mín. ${nf(it.alerta_minimo)}` : ''}
                              {it.custo != null ? ` · custo ${nf(it.custo)} €` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {MOVIMENTOS.map((m) => (
                              <button
                                key={m.tipo}
                                type="button"
                                title={m.dica}
                                onClick={() => {
                                  setMov({ id: it.id, tipo: m.tipo, quantidade: '', motivo: '' })
                                  setReceitaDe(null)
                                }}
                                className={BOTAO_SECUNDARIO}
                              >
                                {m.rotulo}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setReceitaDe(receitaDe === it.id ? null : it.id)
                                setMov(null)
                                setNovaReceita({ chave: '', quantidade: '' })
                              }}
                              className={BOTAO_SECUNDARIO}
                            >
                              Receitas{receitasPorItem[it.id]?.length ? ` (${receitasPorItem[it.id].length})` : ''}
                            </button>
                            <button type="button" onClick={() => abrir(it)} className={BOTAO_SECUNDARIO}>Editar</button>
                            <button type="button" onClick={() => apagar(it)} className={BOTAO_PERIGO}>Apagar</button>
                          </div>
                        </div>

                        {mov?.id === it.id && (
                          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-creme-300 pt-3">
                            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                              {MOVIMENTOS.find((m) => m.tipo === mov.tipo)?.rotulo}
                            </span>
                            <input
                              autoFocus
                              value={mov.quantidade}
                              onChange={(e) => setMov((v) => ({ ...v, quantidade: e.target.value }))}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={mov.tipo === 'ajuste' ? 'total contado' : 'quantidade'}
                              className={`${CAMPO} mt-0 w-32`}
                            />
                            <input
                              value={mov.motivo}
                              onChange={(e) => setMov((v) => ({ ...v, motivo: e.target.value }))}
                              placeholder="Motivo (opcional)"
                              className={`${CAMPO} mt-0 min-w-40 flex-1`}
                            />
                            <button type="button" onClick={confirmarMov} className={BOTAO_PRIMARIO}>Confirmar</button>
                            <button
                              type="button"
                              onClick={() => setMov(null)}
                              className="cursor-pointer px-3 text-xs font-semibold uppercase tracking-widest text-grafite-600/70 hover:text-grafite-900"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}

                        {receitaDe === it.id && (
                          <div className="mt-3 border-t border-creme-300 pt-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                              Consumido por (receitas)
                            </p>
                            {(receitasPorItem[it.id] || []).length === 0 ? (
                              <p className="mt-1 text-sm text-grafite-600/70">
                                Sem receitas. Liga um item vendável que gaste “{it.nome}”.
                              </p>
                            ) : (
                              <ul className="mt-2 space-y-1">
                                {receitasPorItem[it.id].map((r) => (
                                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-grafite-900">
                                      {labelVendavel(r)} · <strong>{nf(r.quantidade)} {it.unidade}</strong> por unidade
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => apagarReceita(r.id)}
                                      className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-red-600 hover:text-red-700"
                                    >
                                      Remover
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-3 flex flex-wrap items-end gap-2">
                              <select
                                value={novaReceita.chave}
                                onChange={(e) => setNovaReceita((v) => ({ ...v, chave: e.target.value }))}
                                className={`${CAMPO} mt-0 min-w-48 flex-1`}
                              >
                                <option value="">Escolhe o item vendável…</option>
                                {vendaveis.map((o) => (
                                  <option key={o.chave} value={o.chave}>{o.label}</option>
                                ))}
                              </select>
                              <input
                                value={novaReceita.quantidade}
                                onChange={(e) => setNovaReceita((v) => ({ ...v, quantidade: e.target.value }))}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={`${it.unidade}/unid.`}
                                className={`${CAMPO} mt-0 w-28`}
                              />
                              <button type="button" onClick={() => adicionarReceita(it.id)} className={BOTAO_SECUNDARIO}>
                                + Ligar
                              </button>
                            </div>
                            <p className="mt-1.5 text-xs text-grafite-600/70">
                              Quanto deste item se gasta por cada unidade vendida (ex.: 2 fatias de pão por tosta).
                              Desconta sozinho na venda.
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {Aviso}
    </div>
  )
}

export default Stock
