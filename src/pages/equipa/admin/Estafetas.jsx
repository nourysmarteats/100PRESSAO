// Estafetas próprios: registo, valores acordados e apuramento semanal.
//
// O apuramento existe para uma coisa concreta: o estafeta emite fatura à
// segunda-feira e é pago à terça. Este ecrã diz quanto lhe é devido, entrega a
// entrega, para se conferir contra a fatura que ele manda — e para haver
// suporte documental se as Finanças perguntarem.
//
// O valor de cada entrega é CONGELADO na atribuição (orders.estafeta_taxa).
// Recalcular a partir dos valores atuais faria com que mudar a tabela de preços
// reescrevesse semanas já faturadas.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { useAviso, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CARTAO, CAMPO } from './comuns'

const iso = (d) => d.toISOString().slice(0, 10)

// Semana de segunda a domingo, que é o ciclo de faturação acordado.
function semanaDe(refIso) {
  const d = new Date(`${refIso}T12:00:00`)
  const diaSemana = (d.getDay() + 6) % 7 // 0 = segunda
  const segunda = new Date(d)
  segunda.setDate(d.getDate() - diaSemana)
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  return { de: iso(segunda), ate: iso(domingo) }
}

const VAZIO = { nome: '', nif: '', telefone: '', email: '', notas: '', ativo: true }

function Estafetas() {
  const [lista, setLista] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [emEdicao, setEmEdicao] = useState(null) // null | 'novo' | id
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [valores, setValores] = useState({ base: 2, km: 0.4 })
  const [semana, setSemana] = useState(() => semanaDe(iso(new Date())))
  const [entregas, setEntregas] = useState([])
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const [rEst, rCfg] = await Promise.all([
      supabase.from('estafetas').select('*').order('nome'),
      supabase.from('definicoes').select('valor').eq('chave', 'entrega').maybeSingle(),
    ])
    if (rEst.error) {
      setTabelaEmFalta(true)
      setLista([])
      return
    }
    setLista(rEst.data)
    const v = rCfg.data?.valor || {}
    setValores({ base: Number(v.estafeta_base ?? 2), km: Number(v.estafeta_km ?? 0.4) })
  }, [])

  const carregarEntregas = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('numero, estafeta_id, estafeta_taxa, distancia_km, morada, criado_em, estado')
      .not('estafeta_id', 'is', null)
      .gte('criado_em', `${semana.de}T00:00:00`)
      .lte('criado_em', `${semana.ate}T23:59:59`)
      .order('criado_em')
    if (!error) setEntregas(data || [])
  }, [semana])

  useEffect(() => {
    carregar()
  }, [carregar])
  useEffect(() => {
    carregarEntregas()
  }, [carregarEntregas])

  const porEstafeta = useMemo(() => {
    const mapa = new Map()
    for (const e of entregas) {
      const a = mapa.get(e.estafeta_id) || { linhas: [], total: 0, km: 0 }
      a.linhas.push(e)
      a.total += Number(e.estafeta_taxa || 0)
      a.km += Number(e.distancia_km || 0)
      mapa.set(e.estafeta_id, a)
    }
    return mapa
  }, [entregas])

  async function guardar(ev) {
    ev.preventDefault()
    const registo = {
      nome: form.nome.trim(),
      nif: form.nif.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      notas: form.notas.trim() || null,
      ativo: !!form.ativo,
    }
    if (!registo.nome) return
    if (registo.nif && !/^\d{9}$/.test(registo.nif)) {
      mostrarAviso('NIF inválido (9 dígitos).')
      return
    }
    const { error } =
      emEdicao === 'novo'
        ? await supabase.from('estafetas').insert(registo)
        : await supabase.from('estafetas').update(registo).eq('id', emEdicao)
    if (error) {
      mostrarAviso('Erro ao guardar.')
      return
    }
    setEmEdicao(null)
    setForm(VAZIO)
    carregar()
    mostrarAviso('Guardado ✓')
  }

  async function guardarValores(ev) {
    ev.preventDefault()
    const { data } = await supabase.from('definicoes').select('valor').eq('chave', 'entrega').maybeSingle()
    const { error } = await supabase.from('definicoes').upsert({
      chave: 'entrega',
      valor: { ...(data?.valor || {}), estafeta_base: valores.base, estafeta_km: valores.km },
      atualizado_em: new Date().toISOString(),
    })
    mostrarAviso(error ? 'Erro ao guardar os valores.' : 'Valores guardados ✓')
  }

  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        A tabela de estafetas ainda não existe. Aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">2026-08-09-estafetas.sql</code>
        no Supabase.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Valores acordados ── */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Valores por entrega
        </h3>
        <p className="mt-1 text-sm text-grafite-600/70">
          Aplicam-se às entregas atribuídas a partir de agora. As já atribuídas
          mantêm o valor com que foram registadas — mudar aqui não reescreve
          semanas já faturadas.
        </p>
        <form onSubmit={guardarValores} className={`${CARTAO} mt-3 flex flex-wrap items-end gap-4 p-5`}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Recolha e entrega
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={valores.base}
                onChange={(e) => setValores((v) => ({ ...v, base: Number(e.target.value) }))}
                className={`${CAMPO} mt-0 w-28`}
              />
              <span className="text-sm text-grafite-600/70">€</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Por quilómetro
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={valores.km}
                onChange={(e) => setValores((v) => ({ ...v, km: Number(e.target.value) }))}
                className={`${CAMPO} mt-0 w-28`}
              />
              <span className="text-sm text-grafite-600/70">€/km</span>
            </div>
          </label>
          <button type="submit" className={BOTAO_PRIMARIO}>Guardar valores</button>
          <p className="w-full text-xs text-grafite-600/70">
            Exemplo: uma entrega de 3,25 km paga {fmt(valores.base + valores.km * 3.25)}.
          </p>
        </form>
      </section>

      {/* ── Registo ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Estafetas</h3>
          <button
            type="button"
            onClick={() => {
              setEmEdicao('novo')
              setForm(VAZIO)
            }}
            className={BOTAO_PRIMARIO}
          >
            Novo estafeta
          </button>
        </div>

        {emEdicao && (
          <form onSubmit={guardar} className={`${CARTAO} mt-3 grid gap-4 p-5 sm:grid-cols-2`}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Nome</span>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className={CAMPO} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">NIF</span>
              <input
                value={form.nif}
                onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                inputMode="numeric"
                className={CAMPO}
                placeholder="para conferir a fatura"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Telemóvel</span>
              <input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                inputMode="numeric"
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Email</span>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={CAMPO} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Notas</span>
              <input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} className={CAMPO} placeholder="mota própria, dias que costuma fazer…" />
            </label>
            <label className="flex items-center gap-2 text-sm text-grafite-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                className="h-4 w-4 accent-ambar-500"
              />
              Ativo
            </label>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={() => setEmEdicao(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
              <button type="submit" className={BOTAO_PRIMARIO}>Guardar</button>
            </div>
          </form>
        )}

        {lista === null ? (
          <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
        ) : lista.length === 0 ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            Ainda não há estafetas registados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lista.map((e) => (
              <li key={e.id} className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 p-4`}>
                <div>
                  <p className="font-semibold text-grafite-900">
                    {e.nome}
                    {!e.ativo && <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/60">inativo</span>}
                  </p>
                  <p className="text-xs text-grafite-600/70">
                    {[e.nif && `NIF ${e.nif}`, e.telefone, e.email].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmEdicao(e.id)
                    setForm({
                      nome: e.nome || '',
                      nif: e.nif || '',
                      telefone: e.telefone || '',
                      email: e.email || '',
                      notas: e.notas || '',
                      ativo: e.ativo !== false,
                    })
                  }}
                  className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-cobre-600 hover:underline"
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Apuramento da semana ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            A pagar — semana de {semana.de} a {semana.ate}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${semana.de}T12:00:00`)
                d.setDate(d.getDate() - 7)
                setSemana(semanaDe(iso(d)))
              }}
              className={BOTAO_SECUNDARIO}
            >
              ← Semana anterior
            </button>
            <button type="button" onClick={() => setSemana(semanaDe(iso(new Date())))} className={BOTAO_SECUNDARIO}>
              Esta semana
            </button>
          </div>
        </div>

        {porEstafeta.size === 0 ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>Sem entregas atribuídas nesta semana.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {[...porEstafeta.entries()].map(([id, dados]) => {
              const est = (lista || []).find((e) => e.id === id)
              return (
                <div key={id} className={`${CARTAO} p-5`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-lg font-bold uppercase text-grafite-900">
                      {est?.nome || 'Estafeta removido'}
                      {est?.nif && <span className="ml-2 text-sm font-normal text-grafite-600/70">NIF {est.nif}</span>}
                    </p>
                    <p className="font-display text-xl font-bold text-cobre-600">{fmt(dados.total)}</p>
                  </div>
                  <p className="mt-1 text-xs text-grafite-600/70">
                    {dados.linhas.length} {dados.linhas.length === 1 ? 'entrega' : 'entregas'} ·{' '}
                    {dados.km.toFixed(1)} km
                  </p>
                  <ul className="mt-3 divide-y divide-creme-200 text-sm">
                    {dados.linhas.map((l) => (
                      <li key={l.numero} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <span className="text-grafite-900">
                          nº {l.numero}
                          <span className="ml-2 text-xs text-grafite-600/70">
                            {new Date(l.criado_em).toLocaleDateString('pt-PT')} ·{' '}
                            {Number(l.distancia_km || 0).toFixed(1)} km
                            {l.estado !== 'entregue' && ' · por entregar'}
                          </span>
                        </span>
                        <span className="font-semibold text-grafite-900">{fmt(l.estafeta_taxa || 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {Aviso}
    </div>
  )
}

export default Estafetas
