import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/pedidos'

const PRODUTO_VAZIO = {
  nome: '',
  category_id: '',
  descricao: '',
  preco: '',
  estilo: '',
  abv: '',
  alergenios: '',
  ordem: 0,
  disponivel: true,
}

// ── ANALYTICS ──────────────────────────────────────────────

function Analytics() {
  const [periodo, setPeriodo] = useState('dia')
  const [kpis, setKpis] = useState(null)
  const [top, setTop] = useState([])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const inicio = new Date()
      if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
      if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7)
      if (periodo === 'mes') inicio.setDate(inicio.getDate() - 30)

      const [rPedidos, rItens] = await Promise.all([
        supabase
          .from('orders')
          .select('total, criado_em, atualizado_em, metodo_pagamento')
          .eq('estado', 'entregue')
          .gte('criado_em', inicio.toISOString()),
        supabase
          .from('order_items')
          .select('quantidade, preco_unitario, products(nome), orders!inner(estado, criado_em)')
          .eq('orders.estado', 'entregue')
          .gte('orders.criado_em', inicio.toISOString()),
      ])
      if (!ativo) return

      const pedidos = rPedidos.data || []
      const receita = pedidos.reduce((s, o) => s + Number(o.total || 0), 0)
      const tempos = pedidos
        .map((o) => (new Date(o.atualizado_em) - new Date(o.criado_em)) / 60000)
        .filter((t) => t > 0 && t < 120)

      setKpis({
        pedidos: pedidos.length,
        receita,
        ticket: pedidos.length ? receita / pedidos.length : 0,
        tempoMedio: tempos.length
          ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
          : null,
      })

      const porProduto = new Map()
      ;(rItens.data || []).forEach((i) => {
        const nome = i.products?.nome || '—'
        const atual = porProduto.get(nome) || { qtd: 0, receita: 0 }
        atual.qtd += i.quantidade
        atual.receita += i.quantidade * Number(i.preco_unitario)
        porProduto.set(nome, atual)
      })
      setTop(
        [...porProduto.entries()]
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.qtd - a.qtd)
          .slice(0, 8),
      )
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [periodo])

  return (
    <div>
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
                : 'border-grafite-700 text-creme-300 hover:border-creme-500'
            }`}
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: 'Receita', valor: kpis ? fmt(kpis.receita) : '—' },
          { rotulo: 'Pedidos', valor: kpis?.pedidos ?? '—' },
          { rotulo: 'Ticket médio', valor: kpis ? fmt(kpis.ticket) : '—' },
          {
            rotulo: 'Tempo médio',
            valor: kpis?.tempoMedio != null ? `${kpis.tempoMedio} min` : '—',
          },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-xl border border-grafite-700 bg-grafite-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-creme-500">
              {k.rotulo}
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-creme-50">{k.valor}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-display text-lg font-bold uppercase text-creme-300">
        Produtos mais vendidos
      </h3>
      {top.length === 0 ? (
        <p className="mt-3 text-creme-500">Sem vendas no período.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {top.map((p, i) => (
            <li
              key={p.nome}
              className="flex items-center justify-between rounded-lg border border-grafite-700 bg-grafite-900 px-4 py-3"
            >
              <span className="text-creme-50">
                <span className="mr-3 font-display font-bold text-ambar-400">{i + 1}.</span>
                {p.nome}
              </span>
              <span className="text-sm text-creme-300">
                {p.qtd}× · {fmt(p.receita)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── PRODUTOS (CRUD) ────────────────────────────────────────

function CampoTexto({ rotulo, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-400">
        {rotulo}
      </span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg border border-grafite-700 bg-grafite-800 px-3 py-2.5 text-creme-50 outline-none focus:border-ambar-500"
      />
    </label>
  )
}

function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | produto
  const [form, setForm] = useState(PRODUTO_VAZIO)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const [rProd, rCat] = await Promise.all([
      supabase.from('products').select('*, categories(nome)').order('ordem'),
      supabase.from('categories').select('*').order('ordem'),
    ])
    if (!rProd.error) setProdutos(rProd.data)
    if (!rCat.error) setCategorias(rCat.data)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function mostrarAviso(msg) {
    setAviso(msg)
    setTimeout(() => setAviso(''), 3000)
  }

  function abrirEdicao(p) {
    setEmEdicao(p ? p.id : 'novo')
    setForm(
      p
        ? {
            nome: p.nome,
            category_id: p.category_id,
            descricao: p.descricao || '',
            preco: p.preco,
            estilo: p.estilo || '',
            abv: p.abv ?? '',
            alergenios: p.alergenios || '',
            ordem: p.ordem,
            disponivel: p.disponivel,
          }
        : { ...PRODUTO_VAZIO, category_id: categorias[0]?.id || '' },
    )
  }

  async function guardar(e) {
    e.preventDefault()
    const registo = {
      nome: form.nome.trim(),
      category_id: form.category_id,
      descricao: form.descricao.trim() || null,
      preco: Number(form.preco),
      estilo: form.estilo.trim() || null,
      abv: form.abv === '' ? null : Number(form.abv),
      alergenios: form.alergenios.trim() || null,
      ordem: Number(form.ordem) || 0,
      disponivel: form.disponivel,
    }
    const { error } =
      emEdicao === 'novo'
        ? await supabase.from('products').insert(registo)
        : await supabase.from('products').update(registo).eq('id', emEdicao)
    if (error) {
      mostrarAviso('Erro ao guardar.')
      return
    }
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function alternarDisponivel(p) {
    await supabase.from('products').update({ disponivel: !p.disponivel }).eq('id', p.id)
    carregar()
  }

  async function apagar(p) {
    if (!window.confirm(`Apagar "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) {
      mostrarAviso('Não foi possível apagar (tem pedidos associados?). Desativa-o em vez disso.')
      return
    }
    carregar()
  }

  const alterar = (campo) => (e) =>
    setForm((f) => ({
      ...f,
      [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-creme-500">
          {produtos.length} produtos · {categorias.length} categorias
        </p>
        <button
          type="button"
          onClick={() => abrirEdicao(null)}
          className="cursor-pointer rounded-full bg-ambar-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-950 hover:bg-ambar-400"
        >
          + Novo produto
        </button>
      </div>

      {emEdicao && (
        <form
          onSubmit={guardar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-grafite-900 p-6 sm:grid-cols-2"
        >
          <CampoTexto rotulo="Nome *" value={form.nome} onChange={alterar('nome')} required />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-400">
              Categoria *
            </span>
            <select
              value={form.category_id}
              onChange={alterar('category_id')}
              required
              className="mt-1.5 w-full rounded-lg border border-grafite-700 bg-grafite-800 px-3 py-2.5 text-creme-50 outline-none focus:border-ambar-500"
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <CampoTexto rotulo="Descrição" value={form.descricao} onChange={alterar('descricao')} />
          </div>
          <CampoTexto
            rotulo="Preço (€) *"
            type="number"
            step="0.01"
            min="0"
            value={form.preco}
            onChange={alterar('preco')}
            required
          />
          <CampoTexto rotulo="Ordem" type="number" value={form.ordem} onChange={alterar('ordem')} />
          <CampoTexto
            rotulo="Estilo (cerveja)"
            value={form.estilo}
            onChange={alterar('estilo')}
            placeholder="Ex.: IPA"
          />
          <CampoTexto
            rotulo="ABV % (cerveja)"
            type="number"
            step="0.1"
            min="0"
            value={form.abv}
            onChange={alterar('abv')}
          />
          <div className="sm:col-span-2">
            <CampoTexto
              rotulo="Alergénios (petisco)"
              value={form.alergenios}
              onChange={alterar('alergenios')}
              placeholder="Ex.: Glúten, lacticínios"
            />
          </div>
          <label className="flex items-center gap-3 text-creme-50">
            <input
              type="checkbox"
              checked={form.disponivel}
              onChange={alterar('disponivel')}
              className="h-5 w-5 accent-ambar-500"
            />
            Disponível no cardápio
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEmEdicao(null)}
              className="cursor-pointer rounded-full border border-grafite-700 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-creme-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-full bg-ambar-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-950 hover:bg-ambar-400"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {produtos.map((p) => (
          <li
            key={p.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-grafite-700 bg-grafite-900 px-4 py-3 ${
              p.disponivel ? '' : 'opacity-50'
            }`}
          >
            <div>
              <p className="font-semibold text-creme-50">
                {p.nome}
                <span className="ml-3 text-xs uppercase tracking-widest text-creme-500">
                  {p.categories?.nome}
                </span>
              </p>
              <p className="text-sm text-creme-500">
                {fmt(p.preco)}
                {p.estilo ? ` · ${p.estilo}` : ''}
                {p.abv != null ? ` · ${Number(p.abv).toFixed(1)}%` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => alternarDisponivel(p)}
                className="cursor-pointer rounded-full border border-grafite-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-creme-300 hover:border-ambar-500"
              >
                {p.disponivel ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                onClick={() => abrirEdicao(p)}
                className="cursor-pointer rounded-full border border-grafite-700 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-creme-300 hover:border-ambar-500"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => apagar(p)}
                className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-400 hover:border-red-500"
              >
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {aviso && (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-creme-50 px-6 py-3 text-sm font-semibold text-grafite-900 shadow-lg"
        >
          {aviso}
        </p>
      )}
    </div>
  )
}

// ── PÁGINA ─────────────────────────────────────────────────

function Admin() {
  const [aba, setAba] = useState('analytics')

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex gap-2">
        {[
          { id: 'analytics', rotulo: 'Analytics' },
          { id: 'produtos', rotulo: 'Produtos' },
        ].map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors ${
              aba === a.id
                ? 'bg-creme-50 text-grafite-950'
                : 'text-creme-300 hover:text-creme-50'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="mt-8">{aba === 'analytics' ? <Analytics /> : <Produtos />}</div>
    </main>
  )
}

export default Admin
