import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
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
  origem: '',
  imagem_url: '',
  ordem: 0,
  disponivel: true,
}

const CATEGORIA_VAZIA = { nome: '', ordem: 0, visivel: true }

// Cores dos gráficos: ambar-500/cobre-500 validados para contraste e CVD
// tanto na superfície escura atual como na clara (tema futuro)
const GRAFICO = {
  serie: '#c9822e',
  grelha: '#d9cfba',
  tinta: '#3a3f48',
  tintaForte: '#16181d',
}

// ── REORDENAÇÃO (partilhada por produtos e categorias) ─────

function moverItem(lista, de, para) {
  const nova = [...lista]
  const [movido] = nova.splice(de, 1)
  nova.splice(para, 0, movido)
  return nova
}

// Drag-and-drop nativo + setas de fallback (teclado/touch), gravando no
// campo `ordem` já existente e usado por /cardapio
function useReordenacao(itens, setItens, tabela, aoErro) {
  const arrastado = useRef(null)

  async function aplicar(novaLista) {
    const comOrdem = novaLista.map((item, i) => ({ ...item, ordem: (i + 1) * 10 }))
    setItens(comOrdem)
    const alteracoes = comOrdem.filter(
      (item, i) => novaLista[i].ordem !== item.ordem,
    )
    const resultados = await Promise.all(
      alteracoes.map((u) =>
        supabase.from(tabela).update({ ordem: u.ordem }).eq('id', u.id),
      ),
    )
    if (resultados.some((r) => r.error)) aoErro?.()
  }

  function mover(de, para) {
    if (de === para || para < 0 || para >= itens.length) return
    aplicar(moverItem(itens, de, para))
  }

  const propsArrasto = (i) => ({
    draggable: true,
    onDragStart: (e) => {
      arrastado.current = i
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      if (arrastado.current != null && arrastado.current !== i) {
        mover(arrastado.current, i)
      }
      arrastado.current = null
    },
  })

  return { mover, propsArrasto }
}

function SetasOrdem({ i, total, mover, rotulo }) {
  return (
    <span className="flex flex-col">
      <button
        type="button"
        onClick={() => mover(i, i - 1)}
        disabled={i === 0}
        aria-label={`Subir ${rotulo}`}
        className="cursor-pointer px-1 text-grafite-600/70 hover:text-ambar-600 disabled:opacity-20"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => mover(i, i + 1)}
        disabled={i === total - 1}
        aria-label={`Descer ${rotulo}`}
        className="cursor-pointer px-1 text-grafite-600/70 hover:text-ambar-600 disabled:opacity-20"
      >
        ▼
      </button>
    </span>
  )
}

// ── ANALYTICS ──────────────────────────────────────────────

function TooltipGrafico({ active, payload, label, formatador }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-creme-300 bg-creme-50 px-3 py-2 text-xs shadow-lg">
      <p className="text-grafite-600/70">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5 font-semibold text-grafite-900">
          {p.name}: {formatador ? formatador(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// Série temporal de receita: por hora (Hoje) ou por dia (7/30 dias),
// com buckets vazios preenchidos a zero para a linha ser contínua
function construirSerie(pedidos, periodo) {
  const chaveDia = (d) => d.toLocaleDateString('sv-SE')
  const buckets = []
  const porChave = new Map()

  if (periodo === 'dia') {
    const horaAtual = new Date().getHours()
    for (let h = 0; h <= horaAtual; h++) {
      const item = { chave: String(h), rotulo: `${h}h`, receita: 0 }
      buckets.push(item)
      porChave.set(item.chave, item)
    }
  } else {
    const dias = periodo === 'semana' ? 7 : 30
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const item = {
        chave: chaveDia(d),
        rotulo: `${d.getDate()}/${d.getMonth() + 1}`,
        receita: 0,
      }
      buckets.push(item)
      porChave.set(item.chave, item)
    }
  }

  pedidos.forEach((o) => {
    const d = new Date(o.criado_em)
    const chave = periodo === 'dia' ? String(d.getHours()) : chaveDia(d)
    const bucket = porChave.get(chave)
    if (bucket) bucket.receita += Number(o.total || 0)
  })

  return buckets.map((b) => ({ ...b, receita: Number(b.receita.toFixed(2)) }))
}

function Analytics() {
  const [periodo, setPeriodo] = useState('dia')
  const [kpis, setKpis] = useState(null)
  const [top, setTop] = useState([])
  const [serie, setSerie] = useState([])

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
      setSerie(construirSerie(pedidos, periodo))

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
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
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
          <div key={k.rotulo} className="rounded-xl border border-creme-300 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
              {k.rotulo}
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-grafite-900">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Tendência de receita no período */}
      <div className="mt-6 rounded-xl border border-creme-300 bg-white/70 p-4">
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Tendência de receita
        </h3>
        {serie.every((b) => b.receita === 0) ? (
          <p className="mt-3 text-sm text-grafite-600/70">Sem receita no período.</p>
        ) : (
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRAFICO.grelha} vertical={false} />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: GRAFICO.tinta, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => `${v} €`}
                />
                <Tooltip content={<TooltipGrafico formatador={fmt} />} cursor={{ stroke: GRAFICO.tinta, strokeDasharray: '3 3' }} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
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
        )}
      </div>

      <h3 className="mt-8 font-display text-lg font-bold uppercase text-grafite-600">
        Produtos mais vendidos
      </h3>
      {top.length === 0 ? (
        <p className="mt-3 text-grafite-600/70">Sem vendas no período.</p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-creme-300 bg-white/70 p-4">
            <ResponsiveContainer width="100%" height={top.length * 36 + 24}>
              <BarChart
                data={top}
                layout="vertical"
                margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={140}
                  tick={{ fill: GRAFICO.tintaForte, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TooltipGrafico formatador={(v) => `${v} unidades`} />}
                  cursor={{ fill: 'rgba(201, 130, 46, 0.08)' }}
                />
                <Bar
                  dataKey="qtd"
                  name="Vendidos"
                  fill={GRAFICO.serie}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vista em lista (com receita) — também serve de alternativa acessível ao gráfico */}
          <ul className="mt-4 space-y-2">
            {top.map((p, i) => (
              <li
                key={p.nome}
                className="flex items-center justify-between rounded-lg border border-creme-300 bg-white/70 px-4 py-3"
              >
                <span className="text-grafite-900">
                  <span className="mr-3 font-display font-bold text-ambar-600">{i + 1}.</span>
                  {p.nome}
                </span>
                <span className="text-sm text-grafite-600">
                  {p.qtd}× · {fmt(p.receita)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ── FORMULÁRIO (campos partilhados) ────────────────────────

function CampoTexto({ rotulo, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        {rotulo}
      </span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg border border-creme-300 bg-creme-100 px-3 py-2.5 text-grafite-900 outline-none focus:border-ambar-500"
      />
    </label>
  )
}

// Upload directo para o Supabase Storage (bucket "produtos"), preenchendo
// imagem_url automaticamente; o campo de URL manual continua disponível
function UploadImagem({ valor, aoMudar, aoAvisar }) {
  const [aEnviar, setAEnviar] = useState(false)
  const inputRef = useRef(null)

  async function enviar(e) {
    const ficheiro = e.target.files?.[0]
    e.target.value = ''
    if (!ficheiro) return
    if (!ficheiro.type.startsWith('image/')) {
      aoAvisar('Escolhe um ficheiro de imagem (JPG, PNG, WebP…).')
      return
    }
    if (ficheiro.size > 5 * 1024 * 1024) {
      aoAvisar('Imagem acima de 5 MB — reduz o tamanho antes de enviar.')
      return
    }
    setAEnviar(true)
    const ext = (ficheiro.name.split('.').pop() || 'jpg').toLowerCase()
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from('produtos')
      .upload(caminho, ficheiro, { cacheControl: '31536000' })
    setAEnviar(false)
    if (error) {
      aoAvisar('Erro no upload — confirma que o bucket "produtos" existe (migração SQL).')
      return
    }
    const { data } = supabase.storage.from('produtos').getPublicUrl(caminho)
    aoMudar(data.publicUrl)
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        Imagem do produto
      </span>
      {valor && (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-creme-300">
          <img src={valor} alt="Pré-visualização da imagem do produto" className="aspect-[16/9] w-full object-cover" />
          <button
            type="button"
            onClick={() => aoMudar('')}
            className="absolute right-2 top-2 cursor-pointer rounded-full bg-grafite-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-grafite-900 hover:bg-red-500/80"
          >
            Remover
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={enviar}
          className="hidden"
          aria-label="Enviar imagem do produto"
        />
        <button
          type="button"
          disabled={aEnviar}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500 disabled:opacity-40"
        >
          {aEnviar ? 'A enviar…' : valor ? 'Substituir imagem' : '↑ Enviar imagem'}
        </button>
        <span className="text-xs text-grafite-600/70">ou cola um URL abaixo</span>
      </div>
    </div>
  )
}

// ── PRODUTOS (CRUD + lote + reordenação) ───────────────────

function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(PRODUTO_VAZIO)
  const [aviso, setAviso] = useState('')
  const [selecionados, setSelecionados] = useState(() => new Set())

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

  const { mover, propsArrasto } = useReordenacao(produtos, setProdutos, 'products', () =>
    mostrarAviso('Erro ao gravar a ordem.'),
  )

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
            origem: p.origem || '',
            imagem_url: p.imagem_url || '',
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
      origem: form.origem || null,
      imagem_url: form.imagem_url.trim() || null,
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

  // ── seleção múltipla + ação em lote ──
  function alternarSelecao(id) {
    setSelecionados((s) => {
      const nova = new Set(s)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  const todosSelecionados = produtos.length > 0 && selecionados.size === produtos.length

  async function loteDisponibilidade(disponivel) {
    const ids = [...selecionados]
    const { error } = await supabase
      .from('products')
      .update({ disponivel })
      .in('id', ids)
    if (error) {
      mostrarAviso('Erro na ação em lote.')
    } else {
      mostrarAviso(
        `${ids.length} ${ids.length === 1 ? 'produto' : 'produtos'} ${disponivel ? 'disponíveis' : 'esgotados'} ✓`,
      )
      setSelecionados(new Set())
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-grafite-600/70">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={() =>
              setSelecionados(todosSelecionados ? new Set() : new Set(produtos.map((p) => p.id)))
            }
            className="h-5 w-5 accent-ambar-500"
          />
          {produtos.length} produtos · {categorias.length} categorias
        </label>
        <button
          type="button"
          onClick={() => abrirEdicao(null)}
          className="cursor-pointer rounded-full bg-ambar-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-950 hover:bg-ambar-400"
        >
          + Novo produto
        </button>
      </div>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-ambar-500/40 bg-white/70 px-4 py-3">
          <span className="text-sm font-semibold text-grafite-900">
            {selecionados.size} {selecionados.size === 1 ? 'selecionado' : 'selecionados'}
          </span>
          <button
            type="button"
            onClick={() => loteDisponibilidade(false)}
            className="cursor-pointer rounded-full bg-red-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-500/25"
          >
            Marcar esgotados
          </button>
          <button
            type="button"
            onClick={() => loteDisponibilidade(true)}
            className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
          >
            Marcar disponíveis
          </button>
          <button
            type="button"
            onClick={() => setSelecionados(new Set())}
            className="cursor-pointer px-2 text-xs font-semibold uppercase tracking-widest text-grafite-600/70 hover:text-grafite-900"
          >
            Limpar
          </button>
        </div>
      )}

      {emEdicao && (
        <form
          onSubmit={guardar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-white/70 p-6 sm:grid-cols-2"
        >
          <CampoTexto rotulo="Nome *" value={form.nome} onChange={alterar('nome')} required />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Categoria *
            </span>
            <select
              value={form.category_id}
              onChange={alterar('category_id')}
              required
              className="mt-1.5 w-full rounded-lg border border-creme-300 bg-creme-100 px-3 py-2.5 text-grafite-900 outline-none focus:border-ambar-500"
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
          <CampoTexto
            rotulo="Alergénios (petisco)"
            value={form.alergenios}
            onChange={alterar('alergenios')}
            placeholder="Ex.: Glúten, lacticínios"
          />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Origem (petisco)
            </span>
            <select
              value={form.origem}
              onChange={alterar('origem')}
              className="mt-1.5 w-full rounded-lg border border-creme-300 bg-creme-100 px-3 py-2.5 text-grafite-900 outline-none focus:border-ambar-500"
            >
              <option value="">—</option>
              <option value="Portugues">Português</option>
              <option value="Brasileiro">Brasileiro</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <UploadImagem
              valor={form.imagem_url}
              aoMudar={(url) => setForm((f) => ({ ...f, imagem_url: url }))}
              aoAvisar={mostrarAviso}
            />
          </div>
          <div className="sm:col-span-2">
            <CampoTexto
              rotulo="URL da imagem (alternativa manual)"
              value={form.imagem_url}
              onChange={alterar('imagem_url')}
              placeholder="https://… (deixa vazio se ainda não houver foto)"
            />
          </div>
          <label className="flex items-center gap-3 text-grafite-900">
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
              className="cursor-pointer rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600"
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
        {produtos.map((p, i) => (
          <li
            key={p.id}
            {...propsArrasto(i)}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-creme-300 bg-white/70 px-4 py-3 ${
              p.disponivel ? '' : 'opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selecionados.has(p.id)}
                onChange={() => alternarSelecao(p.id)}
                aria-label={`Selecionar ${p.nome}`}
                className="h-5 w-5 accent-ambar-500"
              />
              <span
                aria-hidden="true"
                title="Arrasta para reordenar"
                className="cursor-grab text-grafite-600/50 active:cursor-grabbing"
              >
                ⠿
              </span>
              <SetasOrdem i={i} total={produtos.length} mover={mover} rotulo={p.nome} />
              <div>
                <p className="font-semibold text-grafite-900">
                  {p.nome}
                  <span className="ml-3 text-xs uppercase tracking-widest text-grafite-600/70">
                    {p.categories?.nome}
                  </span>
                </p>
                <p className="text-sm text-grafite-600/70">
                  {fmt(p.preco)}
                  {p.estilo ? ` · ${p.estilo}` : ''}
                  {p.abv != null ? ` · ${Number(p.abv).toFixed(1)}%` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => alternarDisponivel(p)}
                className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
              >
                {p.disponivel ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                onClick={() => abrirEdicao(p)}
                className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => apagar(p)}
                className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:border-red-500"
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
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-grafite-900 px-6 py-3 text-sm font-semibold text-creme-50 shadow-lg"
        >
          {aviso}
        </p>
      )}
    </div>
  )
}

// ── CATEGORIAS (CRUD + reordenação) ────────────────────────

function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(CATEGORIA_VAZIA)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('ordem')
    if (!error) setCategorias(data)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function mostrarAviso(msg) {
    setAviso(msg)
    setTimeout(() => setAviso(''), 3000)
  }

  const { mover, propsArrasto } = useReordenacao(categorias, setCategorias, 'categories', () =>
    mostrarAviso('Erro ao gravar a ordem.'),
  )

  function abrirEdicao(c) {
    setEmEdicao(c ? c.id : 'novo')
    setForm(
      c
        ? { nome: c.nome, ordem: c.ordem, visivel: c.visivel !== false }
        : { ...CATEGORIA_VAZIA, ordem: (categorias.length + 1) * 10 },
    )
  }

  async function guardar(e) {
    e.preventDefault()
    const registo = {
      nome: form.nome.trim(),
      ordem: Number(form.ordem) || 0,
      visivel: form.visivel,
    }
    const { error } =
      emEdicao === 'novo'
        ? await supabase.from('categories').insert(registo)
        : await supabase.from('categories').update(registo).eq('id', emEdicao)
    if (error) {
      mostrarAviso('Erro ao guardar — a migração SQL (coluna "visivel") já foi aplicada?')
      return
    }
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function alternarVisivel(c) {
    const { error } = await supabase
      .from('categories')
      .update({ visivel: !(c.visivel !== false) })
      .eq('id', c.id)
    if (error) {
      mostrarAviso('Erro — a migração SQL (coluna "visivel") já foi aplicada?')
      return
    }
    carregar()
  }

  async function apagar(c) {
    if (!window.confirm(`Apagar a categoria "${c.nome}"? Esta ação não pode ser desfeita.`))
      return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) {
      mostrarAviso('Não foi possível apagar (tem produtos associados). Oculta-a em vez disso.')
      return
    }
    carregar()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-grafite-600/70">
          {categorias.length} categorias · ocultas não aparecem em /cardapio
        </p>
        <button
          type="button"
          onClick={() => abrirEdicao(null)}
          className="cursor-pointer rounded-full bg-ambar-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-950 hover:bg-ambar-400"
        >
          + Nova categoria
        </button>
      </div>

      {emEdicao && (
        <form
          onSubmit={guardar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-white/70 p-6 sm:grid-cols-2"
        >
          <CampoTexto
            rotulo="Nome *"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <CampoTexto
            rotulo="Ordem"
            type="number"
            value={form.ordem}
            onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
          />
          <label className="flex items-center gap-3 text-grafite-900">
            <input
              type="checkbox"
              checked={form.visivel}
              onChange={(e) => setForm((f) => ({ ...f, visivel: e.target.checked }))}
              className="h-5 w-5 accent-ambar-500"
            />
            Visível no cardápio
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEmEdicao(null)}
              className="cursor-pointer rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600"
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
        {categorias.map((c, i) => {
          const visivel = c.visivel !== false
          return (
            <li
              key={c.id}
              {...propsArrasto(i)}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-creme-300 bg-white/70 px-4 py-3 ${
                visivel ? '' : 'opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  title="Arrasta para reordenar"
                  className="cursor-grab text-grafite-600/50 active:cursor-grabbing"
                >
                  ⠿
                </span>
                <SetasOrdem i={i} total={categorias.length} mover={mover} rotulo={c.nome} />
                <p className="font-semibold text-grafite-900">
                  {c.nome}
                  {!visivel && (
                    <span className="ml-3 rounded-full border border-grafite-600/30 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-grafite-600/70">
                      Oculta
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alternarVisivel(c)}
                  className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
                >
                  {visivel ? 'Ocultar' : 'Mostrar'}
                </button>
                <button
                  type="button"
                  onClick={() => abrirEdicao(c)}
                  className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => apagar(c)}
                  className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:border-red-500"
                >
                  Apagar
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {aviso && (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-grafite-900 px-6 py-3 text-sm font-semibold text-creme-50 shadow-lg"
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
          { id: 'categorias', rotulo: 'Categorias' },
        ].map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors ${
              aba === a.id
                ? 'bg-grafite-900 text-creme-50'
                : 'text-grafite-600 hover:text-grafite-900'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {aba === 'analytics' && <Analytics />}
        {aba === 'produtos' && <Produtos />}
        {aba === 'categorias' && <Categorias />}
      </div>
    </main>
  )
}

export default Admin
