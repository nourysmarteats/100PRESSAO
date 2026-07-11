// Combos (item 2 da v2): menus compostos a preço fixo — ex.: tábua + 2
// cervejas. Cada combo referencia produtos existentes com quantidade.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { registarAuditoria } from '../../../lib/equipa'
import {
  CampoTexto,
  UploadImagem,
  useAviso,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_PERIGO,
  CARTAO,
  CAMPO,
} from './comuns'

const COMBO_VAZIO = {
  nome: '',
  descricao: '',
  preco: '',
  category_id: '',
  imagem_url: '',
  disponivel: true,
}

function Combos() {
  const [combos, setCombos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(COMBO_VAZIO)
  const [itens, setItens] = useState([]) // [{ product_id, quantidade }]
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const [rCombos, rProd, rCat] = await Promise.all([
      supabase
        .from('combos')
        .select('*, combo_items(id, product_id, quantidade, products(nome))')
        .order('ordem'),
      supabase.from('products').select('id, nome').order('nome'),
      supabase.from('categories').select('id, nome').order('ordem'),
    ])
    if (rCombos.error) setTabelaEmFalta(true)
    else {
      setTabelaEmFalta(false)
      setCombos(rCombos.data)
    }
    if (!rProd.error) setProdutos(rProd.data)
    if (!rCat.error) setCategorias(rCat.data)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirEdicao(c) {
    setEmEdicao(c ? c.id : 'novo')
    setForm(
      c
        ? {
            nome: c.nome,
            descricao: c.descricao || '',
            preco: c.preco,
            category_id: c.category_id || '',
            imagem_url: c.imagem_url || '',
            disponivel: c.disponivel,
          }
        : COMBO_VAZIO,
    )
    setItens(
      c
        ? c.combo_items.map((i) => ({ product_id: i.product_id, quantidade: i.quantidade }))
        : [],
    )
  }

  function adicionarItem() {
    const primeiro = produtos.find((p) => !itens.some((i) => i.product_id === p.id))
    if (primeiro) setItens((l) => [...l, { product_id: primeiro.id, quantidade: 1 }])
  }

  async function guardar(e) {
    e.preventDefault()
    const validos = itens.filter((i) => i.product_id && i.quantidade > 0)
    if (validos.length < 1) {
      mostrarAviso('Um combo precisa de pelo menos 1 produto.')
      return
    }
    const registo = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      preco: Number(form.preco),
      category_id: form.category_id || null,
      imagem_url: form.imagem_url.trim() || null,
      disponivel: form.disponivel,
    }
    const novo = emEdicao === 'novo'
    let comboId = emEdicao
    if (novo) {
      const { data, error } = await supabase.from('combos').insert(registo).select().single()
      if (error) {
        mostrarAviso('Erro ao guardar — migração SQL v2 aplicada?')
        return
      }
      comboId = data.id
    } else {
      const { error } = await supabase.from('combos').update(registo).eq('id', comboId)
      if (error) {
        mostrarAviso('Erro ao guardar.')
        return
      }
    }
    // Itens: substituição simples (apagar + inserir) — volumes minúsculos
    await supabase.from('combo_items').delete().eq('combo_id', comboId)
    const { error: erroItens } = await supabase.from('combo_items').insert(
      validos.map((i) => ({ combo_id: comboId, product_id: i.product_id, quantidade: i.quantidade })),
    )
    if (erroItens) {
      mostrarAviso('Combo gravado mas houve erro nos produtos — revê a composição.')
      return
    }
    registarAuditoria(novo ? 'combo_criado' : 'combo_editado', {
      nome: registo.nome,
      preco: registo.preco,
      produtos: validos.length,
    })
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function alternarDisponivel(c) {
    await supabase.from('combos').update({ disponivel: !c.disponivel }).eq('id', c.id)
    registarAuditoria('combo_disponibilidade', { nome: c.nome, disponivel: !c.disponivel })
    carregar()
  }

  async function apagar(c) {
    if (!window.confirm(`Apagar o combo "${c.nome}"?`)) return
    const { error } = await supabase.from('combos').delete().eq('id', c.id)
    if (error) {
      mostrarAviso('Não foi possível apagar (tem pedidos associados?). Desativa-o.')
      return
    }
    registarAuditoria('combo_apagado', { nome: c.nome })
    carregar()
  }

  const alterar = (campo) => (e) =>
    setForm((f) => ({
      ...f,
      [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        A tabela de combos ainda não existe — aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">docs/sql/2026-07-11-v2-equipa-combos-config.sql</code>
        no SQL Editor do Supabase.
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-grafite-600/70">{combos.length} combos</p>
        <button type="button" onClick={() => abrirEdicao(null)} className={BOTAO_PRIMARIO}>
          + Novo combo
        </button>
      </div>

      {emEdicao && (
        <form
          onSubmit={guardar}
          className="mt-6 grid gap-4 rounded-2xl border border-ambar-500/40 bg-white/70 p-6 sm:grid-cols-2"
        >
          <CampoTexto rotulo="Nome *" value={form.nome} onChange={alterar('nome')} required />
          <CampoTexto
            rotulo="Preço fixo (€) *"
            type="number"
            step="0.01"
            min="0"
            value={form.preco}
            onChange={alterar('preco')}
            required
          />
          <div className="sm:col-span-2">
            <CampoTexto
              rotulo="Descrição"
              value={form.descricao}
              onChange={alterar('descricao')}
              placeholder="Ex.: Tábua de petiscos + 2 cervejas à pressão"
            />
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Categoria no cardápio
            </span>
            <select value={form.category_id} onChange={alterar('category_id')} className={CAMPO}>
              <option value="">Secção própria "Combos"</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-3 pb-2 text-grafite-900">
            <input
              type="checkbox"
              checked={form.disponivel}
              onChange={alterar('disponivel')}
              className="h-5 w-5 accent-ambar-500"
            />
            Disponível no cardápio
          </label>

          {/* Composição do combo */}
          <div className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Produtos incluídos *
            </span>
            <ul className="mt-2 space-y-2">
              {itens.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <select
                    value={item.product_id}
                    onChange={(e) =>
                      setItens((l) =>
                        l.map((x, i) => (i === idx ? { ...x, product_id: e.target.value } : x)),
                      )
                    }
                    aria-label="Produto do combo"
                    className={`${CAMPO} mt-0 flex-1`}
                  >
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantidade}
                    onChange={(e) =>
                      setItens((l) =>
                        l.map((x, i) =>
                          i === idx ? { ...x, quantidade: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    aria-label="Quantidade"
                    className={`${CAMPO} mt-0 w-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setItens((l) => l.filter((_, i) => i !== idx))}
                    className={BOTAO_PERIGO}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={adicionarItem} className={`${BOTAO_SECUNDARIO} mt-2`}>
              + Adicionar produto
            </button>
          </div>

          <div className="sm:col-span-2">
            <UploadImagem
              valor={form.imagem_url}
              aoMudar={(url) => setForm((f) => ({ ...f, imagem_url: url }))}
              aoAvisar={mostrarAviso}
            />
          </div>

          <div className="flex justify-end gap-3 sm:col-span-2">
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
        {combos.map((c) => (
          <li
            key={c.id}
            className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
              c.disponivel ? '' : 'opacity-50'
            }`}
          >
            <div>
              <p className="font-semibold text-grafite-900">
                {c.nome}
                <span className="ml-3 font-display font-bold text-cobre-600">{fmt(c.preco)}</span>
              </p>
              <p className="text-sm text-grafite-600/70">
                {c.combo_items
                  .map((i) => `${i.quantidade}× ${i.products?.nome || '?'}`)
                  .join(' + ') || 'sem produtos'}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => alternarDisponivel(c)} className={BOTAO_SECUNDARIO}>
                {c.disponivel ? 'Desativar' : 'Ativar'}
              </button>
              <button type="button" onClick={() => abrirEdicao(c)} className={BOTAO_SECUNDARIO}>
                Editar
              </button>
              <button type="button" onClick={() => apagar(c)} className={BOTAO_PERIGO}>
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

export default Combos
