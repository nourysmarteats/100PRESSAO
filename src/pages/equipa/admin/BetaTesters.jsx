// Beta testers — lista, vagas, leitura por origem e export.
//
// Não há gestão automática de vagas e não é esquecimento: a vaga é uma decisão
// de quem conhece as pessoas, tomada a olhar para a lista. O que este ecrã faz
// é dar uma lista onde essa decisão se toma sem abrir o SQL.
//
// A leitura por origem é a única métrica que a campanha tem. Não é quantas
// pessoas se inscreveram — é por onde entraram, e sobretudo quantas dizem ter
// vindo de um QR sem trazerem o parâmetro do cartaz. Essas são as que
// escreveram o endereço à mão, ou receberam um print reenviado. Se essa
// percentagem for alta, o problema não é o cartaz: é o QR não estar a ser lido.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  BOTAO_PERIGO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CARTAO,
  useAviso,
} from './comuns'
import {
  COLUNAS_EXPORT,
  ROTULOS_ORIGEM,
  csv,
  numeroFormatado,
  porOrigem,
} from '../../../lib/beta'

const ESTADOS = { inscrito: 'Inscrito', convocado: 'Convocado', compareceu: 'Compareceu' }
const VAGAS = { 1: 'Beta 1 — amigos e família', 2: 'Beta 2 — mercado e bairro', 3: 'Beta 3 — aberto' }

function BetaTesters() {
  const [linhas, setLinhas] = useState([])
  const [aCarregar, setACarregar] = useState(true)
  const [filtroVaga, setFiltroVaga] = useState('')
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    setACarregar(true)
    const { data, error } = await supabase
      .from('beta_testers')
      .select(['id', ...COLUNAS_EXPORT].join(','))
      .order('numero', { ascending: true })
    setACarregar(false)
    if (error) return mostrarAviso('Não foi possível carregar a lista.')
    setLinhas(data || [])
  }, [mostrarAviso])

  useEffect(() => {
    carregar()
  }, [carregar])

  const origens = useMemo(() => porOrigem(linhas), [linhas])
  const visiveis = useMemo(
    () => (filtroVaga === '' ? linhas : linhas.filter((l) => String(l.vaga ?? '') === filtroVaga)),
    [linhas, filtroVaga],
  )

  async function alterar(id, campo, valor) {
    const antes = linhas
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)))
    const { error } = await supabase
      .from('beta_testers')
      .update({ [campo]: valor === '' ? null : valor })
      .eq('id', id)
    if (error) {
      setLinhas(antes)
      mostrarAviso('Não foi possível gravar.')
    }
  }

  // Direito ao apagamento. Passa pela RPC e não por um delete directo, para
  // ficar rasto no audit_log de que foi honrado — sem o rasto, cumprir e não
  // cumprir são indistinguíveis numa auditoria.
  async function apagar(linha) {
    const nome = linha.nome
    if (!window.confirm(
      `Apagar definitivamente o beta tester n.º ${numeroFormatado(linha.numero)} (${nome})?\n\n`
      + 'Isto cumpre um pedido de apagamento e não se desfaz. O número não é reatribuído.',
    )) return
    const { error } = await supabase.rpc('apagar_beta_tester', {
      p_id: linha.id,
      p_motivo: 'pedido do titular',
    })
    if (error) return mostrarAviso('Não foi possível apagar.')
    setLinhas((ls) => ls.filter((l) => l.id !== linha.id))
    mostrarAviso('Apagado e registado na auditoria.')
  }

  // Ficheiro gerado no browser, a partir do que já está no ecrã. Um export de
  // dados pessoais é uma cópia que sai do sistema e deixa de ter prazo de
  // conservação — quem o descarrega fica responsável por o apagar.
  function exportar() {
    const ficheiro = new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' })
    const endereco = URL.createObjectURL(ficheiro)
    const a = document.createElement('a')
    a.href = endereco
    a.download = `100pressao-beta-testers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(endereco)
    mostrarAviso('CSV descarregado. Apaga-o do computador quando deixares de precisar.')
  }

  const porVaga = (v) => linhas.filter((l) => l.vaga === v).length

  return (
    <div className="space-y-8">
      {Aviso}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
              Beta testers
            </h3>
            <p className="mt-1 text-sm text-grafite-600/70">
              {linhas.length} inscritos · sem vaga atribuída: {linhas.filter((l) => !l.vaga).length}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={carregar} className={BOTAO_SECUNDARIO}>
              Actualizar
            </button>
            <button type="button" onClick={exportar} disabled={!linhas.length} className={BOTAO_PRIMARIO}>
              Export CSV
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-grafite-600/70">
          O total de beta testers é a contagem de linhas, não o número mais alto:
          a sequência salta números quando uma inscrição falha a meio.
        </p>
      </section>

      {/* ── Leitura por origem ── */}
      <section className={`${CARTAO} p-5`}>
        <h4 className="font-display text-sm font-bold uppercase tracking-widest text-grafite-600">
          Por onde entraram
        </h4>
        {origens.length === 0 ? (
          <p className="mt-3 text-sm text-grafite-600/70">Ainda não há inscrições.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                  <th className="pb-2 font-semibold">Dizem que vieram de</th>
                  <th className="pb-2 font-semibold">Inscritos</th>
                  <th className="pb-2 font-semibold">Sem parâmetro no URL</th>
                  <th className="pb-2 font-semibold">Códigos que trouxeram</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-creme-300">
                {origens.map((o) => (
                  <tr key={o.origem}>
                    <td className="py-2 font-semibold text-grafite-900">{o.rotulo}</td>
                    <td className="py-2 text-grafite-700">{o.total}</td>
                    <td className="py-2">
                      <span
                        className={
                          o.pctSemParametro >= 50
                            ? 'font-semibold text-red-600'
                            : 'text-grafite-700'
                        }
                      >
                        {o.semParametro} ({o.pctSemParametro}%)
                      </span>
                    </td>
                    <td className="py-2 text-xs text-grafite-600/70">
                      {o.params.map(([p, n]) => `${p} (${n})`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-grafite-600/70">
          Quem diz ter visto a loja ou um cartaz e chega sem parâmetro não leu o
          QR: escreveu o endereço, ou recebeu um print reenviado. Acima de
          metade, o problema é do código, não do cartaz. Em "alguém do mercado"
          a ausência de parâmetro é normal e não diz nada — não há link nenhum
          numa recomendação dita de viva voz.
        </p>
      </section>

      {/* ── Vagas ── */}
      <section className="flex flex-wrap gap-2">
        {['', '1', '2', '3'].map((v) => (
          <button
            key={v || 'todos'}
            type="button"
            onClick={() => setFiltroVaga(v)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              filtroVaga === v
                ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {v === '' ? `Todos (${linhas.length})` : `Beta ${v} (${porVaga(Number(v))})`}
          </button>
        ))}
      </section>

      {/* ── Lista ── */}
      <section className={`${CARTAO} overflow-x-auto`}>
        {aCarregar ? (
          <p className="p-5 text-sm text-grafite-600/70">A carregar…</p>
        ) : visiveis.length === 0 ? (
          <p className="p-5 text-sm text-grafite-600/70">Nada para mostrar.</p>
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-grafite-600/70">
                <th className="p-3 font-semibold">N.º</th>
                <th className="p-3 font-semibold">Nome</th>
                <th className="p-3 font-semibold">Telemóvel</th>
                <th className="p-3 font-semibold">Origem</th>
                <th className="p-3 font-semibold" title="Consentiu contacto depois da beta">Pós-beta</th>
                <th className="p-3 font-semibold">Vaga</th>
                <th className="p-3 font-semibold">Estado</th>
                <th className="p-3 font-semibold">RGPD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-creme-300">
              {visiveis.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 font-display font-bold text-grafite-900">
                    {numeroFormatado(l.numero)}
                  </td>
                  <td className="p-3 text-grafite-900">{l.nome}</td>
                  <td className="p-3 font-mono text-grafite-700">{l.telemovel}</td>
                  <td className="p-3 text-xs text-grafite-600/70">
                    {ROTULOS_ORIGEM[l.origem_declarada] || l.origem_declarada}
                    <span className="block text-grafite-600/50">{l.origem_param}</span>
                  </td>
                  {/* Só de leitura, e de propósito: o consentimento é da pessoa.
                      Só ela o dá e só ela o retira — nunca se marca daqui. */}
                  <td className="p-3 text-xs">
                    {l.contacto_pos_beta
                      ? <span className="font-semibold text-grafite-900">sim</span>
                      : <span className="text-grafite-600/50">não</span>}
                  </td>
                  <td className="p-3">
                    <select
                      value={l.vaga ?? ''}
                      onChange={(e) => alterar(l.id, 'vaga', e.target.value ? Number(e.target.value) : '')}
                      className="rounded-lg border border-creme-300 bg-creme-100 px-2 py-1.5 text-xs text-grafite-900 outline-none focus:border-ambar-500"
                    >
                      <option value="">—</option>
                      {Object.entries(VAGAS).map(([v, rotulo]) => (
                        <option key={v} value={v}>{rotulo}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={l.estado ?? ''}
                      onChange={(e) => alterar(l.id, 'estado', e.target.value)}
                      className="rounded-lg border border-creme-300 bg-creme-100 px-2 py-1.5 text-xs text-grafite-900 outline-none focus:border-ambar-500"
                    >
                      <option value="">—</option>
                      {Object.entries(ESTADOS).map(([v, rotulo]) => (
                        <option key={v} value={v}>{rotulo}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => apagar(l)} className={BOTAO_PERIGO}>
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default BetaTesters
