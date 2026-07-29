// Ementa — vista de gestão do menu agrupado por categoria (como o cliente o
// vê), com disponibilidade rápida e edição. Não substitui Produtos/Categorias/
// Combos; é uma "capa" por cima deles. "Editar" num produto abre o editor de
// Produtos já nesse item (via irPara(secao, alvo)).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { registarAuditoria } from '../../../lib/equipa'
import { useAviso, CARTAO, BOTAO_SECUNDARIO } from './comuns'

function Linha({ nome, sub, disponivel, aoAlternar, aoEditar, tag }) {
  return (
    <li
      className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
        disponivel ? '' : 'opacity-50'
      }`}
    >
      <div>
        <p className="font-semibold text-grafite-900">
          {nome}
          {tag && (
            <span className="ml-2 rounded-full border border-grafite-600/30 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-grafite-600/70">
              {tag}
            </span>
          )}
          {!disponivel && (
            <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-red-600">
              esgotado
            </span>
          )}
        </p>
        <p className="text-sm text-grafite-600/70">{sub}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={aoAlternar} className={BOTAO_SECUNDARIO}>
          {disponivel ? 'Esgotar' : 'Ativar'}
        </button>
        <button type="button" onClick={aoEditar} className={BOTAO_SECUNDARIO}>
          Editar
        </button>
      </div>
    </li>
  )
}

function Ementa({ irPara }) {
  const [categorias, setCategorias] = useState([])
  const [produtos, setProdutos] = useState([])
  const [combos, setCombos] = useState([])
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const [rc, rp, rco] = await Promise.all([
      supabase.from('categories').select('*').order('ordem'),
      supabase.from('products').select('id, nome, preco, disponivel, category_id, estilo, abv').order('ordem'),
      supabase.from('combos').select('id, nome, preco, disponivel, category_id').order('ordem'),
    ])
    if (!rc.error) setCategorias(rc.data)
    if (!rp.error) setProdutos(rp.data)
    if (!rco.error) setCombos(rco.data)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarProduto(p) {
    const { error } = await supabase.from('products').update({ disponivel: !p.disponivel }).eq('id', p.id)
    if (error) {
      mostrarAviso('Sem permissão para alterar (só admin).')
      return
    }
    registarAuditoria('disponibilidade_alterada', { nome: p.nome, disponivel: !p.disponivel })
    carregar()
  }
  async function alternarCombo(c) {
    const { error } = await supabase.from('combos').update({ disponivel: !c.disponivel }).eq('id', c.id)
    if (error) {
      mostrarAviso('Sem permissão para alterar (só admin).')
      return
    }
    carregar()
  }

  const combosSemCat = combos.filter((c) => !c.category_id)

  return (
    <div>
      <p className="text-grafite-600/70">
        {produtos.length} produtos · {combos.length} combos · {categorias.length} categorias — o menu
        como o cliente o vê. Edita aqui ou nas secções Produtos/Categorias/Combos.
      </p>

      <div className="mt-6 space-y-8">
        {categorias.map((cat) => {
          const prods = produtos.filter((p) => p.category_id === cat.id)
          const cbs = combos.filter((c) => c.category_id === cat.id)
          return (
            <section key={cat.id}>
              <div className="flex items-center gap-3">
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-grafite-900">{cat.nome}</h3>
                {cat.visivel === false && (
                  <span className="rounded-full border border-grafite-600/30 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-grafite-600/70">
                    oculta
                  </span>
                )}
              </div>
              {prods.length === 0 && cbs.length === 0 ? (
                <p className="mt-2 text-sm text-grafite-600/70">Sem itens nesta categoria.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {prods.map((p) => (
                    <Linha
                      key={p.id}
                      nome={p.nome}
                      sub={`${fmt(p.preco)}${p.estilo ? ` · ${p.estilo}` : ''}${p.abv != null ? ` · ${Number(p.abv).toFixed(1)}%` : ''}`}
                      disponivel={p.disponivel}
                      aoAlternar={() => alternarProduto(p)}
                      aoEditar={() => irPara?.('produtos', p.id)}
                    />
                  ))}
                  {cbs.map((c) => (
                    <Linha
                      key={c.id}
                      tag="Combo"
                      nome={c.nome}
                      sub={fmt(c.preco)}
                      disponivel={c.disponivel}
                      aoAlternar={() => alternarCombo(c)}
                      aoEditar={() => irPara?.('combos')}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {combosSemCat.length > 0 && (
          <section>
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-grafite-900">Combos</h3>
            <ul className="mt-3 space-y-2">
              {combosSemCat.map((c) => (
                <Linha
                  key={c.id}
                  tag="Combo"
                  nome={c.nome}
                  sub={fmt(c.preco)}
                  disponivel={c.disponivel}
                  aoAlternar={() => alternarCombo(c)}
                  aoEditar={() => irPara?.('combos')}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {Aviso}
    </div>
  )
}

export default Ementa
