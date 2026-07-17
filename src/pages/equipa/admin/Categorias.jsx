import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { registarAuditoria } from '../../../lib/equipa'
import {
  CampoTexto,
  useAviso,
  useReordenacao,
  SetasOrdem,
  PegaArrasto,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_PERIGO,
  CARTAO,
} from './comuns'

const CATEGORIA_VAZIA = { nome: '', ordem: 0, visivel: true }

function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [form, setForm] = useState(CATEGORIA_VAZIA)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('ordem')
    if (!error) setCategorias(data)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

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
    const novo = emEdicao === 'novo'
    const { error } = novo
      ? await supabase.from('categories').insert(registo)
      : await supabase.from('categories').update(registo).eq('id', emEdicao)
    if (error) {
      mostrarAviso('Erro ao guardar — a migração SQL (coluna "visivel") já foi aplicada?')
      return
    }
    registarAuditoria(novo ? 'categoria_criada' : 'categoria_editada', { nome: registo.nome })
    setEmEdicao(null)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function alternarVisivel(c) {
    const visivel = !(c.visivel !== false)
    const { error } = await supabase.from('categories').update({ visivel }).eq('id', c.id)
    if (error) {
      mostrarAviso('Erro — a migração SQL (coluna "visivel") já foi aplicada?')
      return
    }
    registarAuditoria('categoria_visibilidade', { nome: c.nome, visivel })
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
    registarAuditoria('categoria_apagada', { nome: c.nome })
    carregar()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-grafite-600/70">
          {categorias.length} categorias · ocultas não aparecem em /cardapio
        </p>
        <button type="button" onClick={() => abrirEdicao(null)} className={BOTAO_PRIMARIO}>
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
            Visível na ementa
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
        {categorias.map((c, i) => {
          const visivel = c.visivel !== false
          return (
            <li
              key={c.id}
              {...propsArrasto(i)}
              className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                visivel ? '' : 'opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <PegaArrasto />
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
                <button type="button" onClick={() => alternarVisivel(c)} className={BOTAO_SECUNDARIO}>
                  {visivel ? 'Ocultar' : 'Mostrar'}
                </button>
                <button type="button" onClick={() => abrirEdicao(c)} className={BOTAO_SECUNDARIO}>
                  Editar
                </button>
                <button type="button" onClick={() => apagar(c)} className={BOTAO_PERIGO}>
                  Apagar
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {Aviso}
    </div>
  )
}

export default Categorias
