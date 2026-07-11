import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { registarAuditoria } from '../../../lib/equipa'
import {
  CampoTexto,
  UploadImagem,
  useAviso,
  useReordenacao,
  SetasOrdem,
  PegaArrasto,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_PERIGO,
  CARTAO,
  CAMPO,
} from './comuns'

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

// Variantes de tamanho/preço (item 8 da v2) — sub-itens do produto
function Variantes({ produtoId, aoAvisar }) {
  const [variantes, setVariantes] = useState([])
  const [nova, setNova] = useState({ nome: '', preco: '' })

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', produtoId)
      .order('ordem')
    if (!error) setVariantes(data)
  }, [produtoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar() {
    if (!nova.nome.trim() || nova.preco === '') return
    const { error } = await supabase.from('product_variants').insert({
      product_id: produtoId,
      nome: nova.nome.trim(),
      preco: Number(nova.preco),
      ordem: (variantes.length + 1) * 10,
    })
    if (error) {
      aoAvisar('Erro ao criar a variante — migração SQL v2 aplicada?')
      return
    }
    registarAuditoria('variante_criada', { produto_id: produtoId, nome: nova.nome, preco: nova.preco })
    setNova({ nome: '', preco: '' })
    carregar()
  }

  async function alternar(v) {
    await supabase
      .from('product_variants')
      .update({ disponivel: !v.disponivel })
      .eq('id', v.id)
    carregar()
  }

  async function apagar(v) {
    const { error } = await supabase.from('product_variants').delete().eq('id', v.id)
    if (error) {
      aoAvisar('Não foi possível apagar (tem pedidos associados?). Desativa-a.')
      return
    }
    registarAuditoria('variante_apagada', { produto_id: produtoId, nome: v.nome })
    carregar()
  }

  return (
    <div className="sm:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        Variantes de tamanho/preço (ex.: 20cl / 30cl / 50cl)
      </span>
      {variantes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {variantes.map((v) => (
            <li
              key={v.id}
              className={`flex items-center justify-between gap-3 rounded-lg border border-creme-300 bg-creme-50 px-3 py-2 ${
                v.disponivel ? '' : 'opacity-50'
              }`}
            >
              <span className="text-sm text-grafite-900">
                {v.nome} · <strong>{fmt(v.preco)}</strong>
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => alternar(v)} className={BOTAO_SECUNDARIO}>
                  {v.disponivel ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" onClick={() => apagar(v)} className={BOTAO_PERIGO}>
                  Apagar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-end gap-2">
        <input
          value={nova.nome}
          onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))}
          placeholder="Nome (ex.: 30cl)"
          aria-label="Nome da variante"
          className={`${CAMPO} mt-0 flex-1`}
        />
        <input
          value={nova.preco}
          onChange={(e) => setNova((n) => ({ ...n, preco: e.target.value }))}
          placeholder="Preço €"
          type="number"
          step="0.01"
          min="0"
          aria-label="Preço da variante"
          className={`${CAMPO} mt-0 w-28`}
        />
        <button type="button" onClick={adicionar} className={BOTAO_SECUNDARIO}>
          + Variante
        </button>
      </div>
      <p className="mt-1.5 text-xs text-grafite-600/70">
        Sem variantes, vale o preço base do produto. Com variantes, o cliente
        escolhe uma no cardápio.
      </p>
    </div>
  )
}

function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(PRODUTO_VAZIO)
  const [precoOriginal, setPrecoOriginal] = useState(null)
  const [selecionados, setSelecionados] = useState(() => new Set())
  const { mostrarAviso, Aviso } = useAviso()

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

  const { mover, propsArrasto } = useReordenacao(produtos, setProdutos, 'products', () =>
    mostrarAviso('Erro ao gravar a ordem.'),
  )

  function abrirEdicao(p) {
    setEmEdicao(p ? p.id : 'novo')
    setPrecoOriginal(p ? Number(p.preco) : null)
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
    const novo = emEdicao === 'novo'
    const { error } = novo
      ? await supabase.from('products').insert(registo)
      : await supabase.from('products').update(registo).eq('id', emEdicao)
    if (error) {
      mostrarAviso('Erro ao guardar.')
      return
    }
    // Auditoria: edição + alteração de preço em separado (item 5 da v2)
    registarAuditoria(novo ? 'produto_criado' : 'produto_editado', {
      nome: registo.nome,
      preco: registo.preco,
    })
    if (!novo && precoOriginal != null && registo.preco !== precoOriginal) {
      registarAuditoria('preco_alterado', {
        nome: registo.nome,
        antes: precoOriginal,
        depois: registo.preco,
      })
    }
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function alternarDisponivel(p) {
    await supabase.from('products').update({ disponivel: !p.disponivel }).eq('id', p.id)
    registarAuditoria('disponibilidade_alterada', { nome: p.nome, disponivel: !p.disponivel })
    carregar()
  }

  async function apagar(p) {
    if (!window.confirm(`Apagar "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) {
      mostrarAviso('Não foi possível apagar (tem pedidos associados?). Desativa-o em vez disso.')
      return
    }
    registarAuditoria('produto_apagado', { nome: p.nome })
    carregar()
  }

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
    const { error } = await supabase.from('products').update({ disponivel }).in('id', ids)
    if (error) {
      mostrarAviso('Erro na ação em lote.')
    } else {
      registarAuditoria('esgotado_lote', { quantidade: ids.length, disponivel })
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
        <button type="button" onClick={() => abrirEdicao(null)} className={BOTAO_PRIMARIO}>
          + Novo produto
        </button>
      </div>

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
          <button type="button" onClick={() => loteDisponibilidade(true)} className={BOTAO_SECUNDARIO}>
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
              className={CAMPO}
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
            rotulo="Preço base (€) *"
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
            <select value={form.origem} onChange={alterar('origem')} className={CAMPO}>
              <option value="">—</option>
              <option value="Portugues">Português</option>
              <option value="Brasileiro">Brasileiro</option>
            </select>
          </label>

          {emEdicao !== 'novo' ? (
            <Variantes produtoId={emEdicao} aoAvisar={mostrarAviso} />
          ) : (
            <p className="text-xs text-grafite-600/70 sm:col-span-2">
              Guarda o produto primeiro para poderes adicionar variantes de
              tamanho/preço.
            </p>
          )}

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
            <button type="submit" className={BOTAO_PRIMARIO}>
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
            className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
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
              <PegaArrasto />
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
              <button type="button" onClick={() => alternarDisponivel(p)} className={BOTAO_SECUNDARIO}>
                {p.disponivel ? 'Desativar' : 'Ativar'}
              </button>
              <button type="button" onClick={() => abrirEdicao(p)} className={BOTAO_SECUNDARIO}>
                Editar
              </button>
              <button type="button" onClick={() => apagar(p)} className={BOTAO_PERIGO}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {Aviso}
    </div>
  )
}

export default Produtos
