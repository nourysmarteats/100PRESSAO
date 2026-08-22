// Triagem de candidaturas.
//
// É aqui que uma candidatura anónima se transforma — ou não — num
// colaborador. A transformação é um acto explícito de um administrador e
// corre numa função da base de dados (`promover_candidatura`), numa
// transacção só: nasce o colaborador, os documentos mudam de dono, a
// candidatura fica marcada, e a operação vai ao audit_log. Se alguma parte
// falhar, não fica nada a meio.
//
// Os anexos vivem num bucket privado. Abrem por URL assinado com cinco
// minutos de validade — o suficiente para ler, pouco para reencaminhar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { ESTADOS_CANDIDATURA, TIPOS_DOCUMENTO } from '../../../lib/candidaturas'
import { VINCULOS, fundamentoValido, vinculoExigeFundamento } from '../../../lib/colaboradores'

const CARTAO = 'rounded-xl border border-creme-300 bg-white/70'
const CAMPO =
  'mt-1 w-full rounded-lg border border-creme-300 bg-creme-50 px-3 py-2 text-sm text-grafite-900 outline-none focus:border-ambar-500'
const BOTAO =
  'cursor-pointer rounded-lg bg-cobre-600 px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60'
const BOTAO_LEVE =
  'cursor-pointer rounded-lg border border-creme-300 px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-grafite-700 transition hover:border-cobre-600/50'

const CORES_ESTADO = {
  nova: 'border-cobre-600/40 bg-cobre-600/10 text-cobre-700',
  em_analise: 'border-ambar-500/40 bg-ambar-500/15 text-ambar-700',
  entrevista: 'border-ambar-500/40 bg-ambar-500/15 text-ambar-700',
  aceite: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  recusada: 'border-creme-300 bg-creme-100 text-grafite-600/60',
  arquivada: 'border-creme-300 bg-creme-100 text-grafite-600/60',
}

const dataCurta = (d) => (d ? new Date(d).toLocaleDateString('pt-PT') : '—')

function Candidaturas() {
  const [lista, setLista] = useState(null)
  const [documentos, setDocumentos] = useState({})
  const [filtro, setFiltro] = useState('nova')
  const [aberta, setAberta] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState('')
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('colaborador_candidaturas')
      .select('*')
      .order('criado_em', { ascending: false })
    if (error) {
      if (error.code === '42P01') setTabelaEmFalta(true)
      setLista([])
      return
    }
    setLista(data || [])

    const { data: docs } = await supabase
      .from('colaborador_documentos')
      .select('*')
      .not('candidatura_id', 'is', null)
    const por = {}
    for (const d of docs || []) (por[d.candidatura_id] ||= []).push(d)
    setDocumentos(por)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtradas = useMemo(
    () => (lista || []).filter((c) => !filtro || c.estado === filtro),
    [lista, filtro],
  )

  const contagem = useMemo(() => {
    const n = {}
    for (const c of lista || []) n[c.estado] = (n[c.estado] || 0) + 1
    return n
  }, [lista])

  async function mudarEstado(id, estado) {
    setOcupado(true)
    const { error } = await supabase
      .from('colaborador_candidaturas')
      .update({ estado, decidido_em: ['aceite', 'recusada'].includes(estado) ? new Date().toISOString() : null })
      .eq('id', id)
    setOcupado(false)
    if (error) return setNota(`Erro: ${error.message}`)
    carregar()
  }

  async function guardarNotas(id, texto) {
    setOcupado(true)
    await supabase.from('colaborador_candidaturas').update({ notas_internas: texto || null }).eq('id', id)
    setOcupado(false)
    carregar()
  }

  async function abrirAnexo(caminho) {
    const { data, error } = await supabase.storage
      .from('candidaturas')
      .createSignedUrl(caminho, 300)
    if (error || !data?.signedUrl) return setNota('Não foi possível abrir o anexo.')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function promover(candidatura, { funcao, vinculo, fundamento }) {
    if (!vinculo) return setNota('Escolhe o vínculo antes de promover.')
    if (!fundamentoValido(vinculo, fundamento)) {
      return setNota(`${VINCULOS[vinculo].rotulo} exige fundamento escrito.`)
    }
    setOcupado(true)
    const { error } = await supabase.rpc('promover_candidatura', {
      p_candidatura: candidatura.id,
      p_funcao: funcao || null,
      p_vinculo: vinculo,
      p_fundamento: fundamento || null,
    })
    setOcupado(false)
    if (error) return setNota(`Erro ao promover: ${error.message}`)
    setNota(`${candidatura.nome} passou a colaborador.`)
    setAberta(null)
    carregar()
  }

  async function apagar(candidatura) {
    const docs = documentos[candidatura.id] || []
    setOcupado(true)
    if (docs.length) {
      await supabase.storage.from('candidaturas').remove(docs.map((d) => d.caminho))
    }
    const { error } = await supabase
      .from('colaborador_candidaturas')
      .delete()
      .eq('id', candidatura.id)
    setOcupado(false)
    if (error) return setNota(`Erro ao apagar: ${error.message}`)
    setNota('Candidatura e anexos apagados.')
    carregar()
  }

  if (tabelaEmFalta) {
    return (
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Candidaturas</h3>
        <p className={`${CARTAO} mt-3 p-6 text-sm text-grafite-600`}>
          A tabela de candidaturas ainda não existe nesta base de dados.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Candidaturas</h3>
        <button type="button" onClick={carregar} className={BOTAO_LEVE}>
          Actualizar
        </button>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-grafite-600/70">
        Uma candidatura só se torna colaborador por decisão escrita aqui. Até
        lá não existe em lado nenhum do apuramento.
      </p>

      {nota && (
        <p className="mt-3 rounded-lg border border-cobre-600/30 bg-cobre-600/5 p-3 text-sm text-grafite-700">
          {nota}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFiltro('')}
          className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
            filtro === ''
              ? 'border-cobre-600 bg-cobre-600 text-creme-100'
              : 'border-creme-300 bg-creme-100 text-grafite-600'
          }`}
        >
          todas ({(lista || []).length})
        </button>
        {Object.entries(ESTADOS_CANDIDATURA).map(([k, r]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltro(k)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
              filtro === k
                ? 'border-cobre-600 bg-cobre-600 text-creme-100'
                : 'border-creme-300 bg-creme-100 text-grafite-600'
            }`}
          >
            {r.toLowerCase()} ({contagem[k] || 0})
          </button>
        ))}
      </div>

      {lista === null ? (
        <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
      ) : filtradas.length === 0 ? (
        <p className={`${CARTAO} mt-3 p-6 text-sm text-grafite-600`}>
          Nenhuma candidatura com este filtro.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtradas.map((c) => (
            <Ficha
              key={c.id}
              candidatura={c}
              documentos={documentos[c.id] || []}
              aberta={aberta === c.id}
              ocupado={ocupado}
              aoAbrir={() => setAberta(aberta === c.id ? null : c.id)}
              aoMudarEstado={mudarEstado}
              aoGuardarNotas={guardarNotas}
              aoAbrirAnexo={abrirAnexo}
              aoPromover={promover}
              aoApagar={apagar}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Ficha({
  candidatura: c,
  documentos,
  aberta,
  ocupado,
  aoAbrir,
  aoMudarEstado,
  aoGuardarNotas,
  aoAbrirAnexo,
  aoPromover,
  aoApagar,
}) {
  const [notas, setNotas] = useState(c.notas_internas || '')
  const [funcao, setFuncao] = useState(c.funcao_pretendida || '')
  const [vinculo, setVinculo] = useState('')
  const [fundamento, setFundamento] = useState('')
  const [confirmarApagar, setConfirmarApagar] = useState(false)

  const promovida = !!c.colaborador_id

  return (
    <li className={`${CARTAO} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-grafite-900">
            {c.nome}
            <span
              className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${CORES_ESTADO[c.estado]}`}
            >
              {ESTADOS_CANDIDATURA[c.estado]}
            </span>
            {documentos.length > 0 && (
              <span className="rounded-full border border-creme-300 bg-creme-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-grafite-600">
                {documentos.length} anexo{documentos.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-grafite-600/70">
            {[c.funcao_pretendida, c.email, c.telefone].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-grafite-600/60">
            Recebida a {dataCurta(c.criado_em)} · apaga-se a {dataCurta(c.expira_em)}
            {c.consentimento_reserva && ' (autorizou reserva de 12 meses)'}
          </p>
        </div>
        <button type="button" onClick={aoAbrir} className={BOTAO_LEVE}>
          {aberta ? 'Fechar' : 'Ver'}
        </button>
      </div>

      {aberta && (
        <div className="mt-4 space-y-4 border-t border-creme-200 pt-4">
          {c.disponibilidade && (
            <p className="text-sm text-grafite-700">
              <span className="font-semibold">Disponibilidade:</span> {c.disponibilidade}
            </p>
          )}
          {c.experiencia && (
            <p className="whitespace-pre-wrap text-sm text-grafite-700">
              <span className="font-semibold">Experiência:</span> {c.experiencia}
            </p>
          )}
          {c.mensagem && (
            <p className="whitespace-pre-wrap text-sm text-grafite-700">
              <span className="font-semibold">Mensagem:</span> {c.mensagem}
            </p>
          )}

          {documentos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
                Anexos
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {documentos.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => aoAbrirAnexo(d.caminho)}
                      className={BOTAO_LEVE}
                      title={`${d.nome_original || ''} · ${Math.round((d.bytes || 0) / 1024)} kB`}
                    >
                      {TIPOS_DOCUMENTO[d.tipo]?.rotulo || d.tipo}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-grafite-600/60">
                Abrem numa ligação assinada válida por 5 minutos.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Notas internas
            </span>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={() => notas !== (c.notas_internas || '') && aoGuardarNotas(c.id, notas)}
              className={CAMPO}
              placeholder="Nunca é mostrado ao candidato."
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
              Estado
            </span>
            {Object.entries(ESTADOS_CANDIDATURA)
              .filter(([k]) => k !== 'aceite')
              .map(([k, r]) => (
                <button
                  key={k}
                  type="button"
                  disabled={ocupado || promovida}
                  onClick={() => aoMudarEstado(c.id, k)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest disabled:opacity-40 ${
                    c.estado === k
                      ? 'border-cobre-600 bg-cobre-600 text-creme-100'
                      : 'border-creme-300 bg-creme-100 text-grafite-600'
                  }`}
                >
                  {r.toLowerCase()}
                </button>
              ))}
          </div>

          {/* Promoção */}
          {promovida ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              Já é colaborador desde {dataCurta(c.decidido_em)}.
            </p>
          ) : (
            <div className="rounded-lg border border-cobre-600/30 bg-cobre-600/5 p-4">
              <p className="text-sm font-semibold text-grafite-900">Promover a colaborador</p>
              <p className="mt-1 text-xs text-grafite-600/70">
                O vínculo é decidido aqui, depois da entrevista — nunca foi
                oferecido ao candidato como escolha.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                    Função
                  </span>
                  <input value={funcao} onChange={(e) => setFuncao(e.target.value)} className={CAMPO} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                    Vínculo
                  </span>
                  <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={CAMPO}>
                    <option value="">Escolhe</option>
                    {Object.entries(VINCULOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.rotulo}</option>
                    ))}
                  </select>
                </label>
                {vinculoExigeFundamento(vinculo) && (
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                      Fundamento (obrigatório)
                    </span>
                    <textarea
                      rows={2}
                      value={fundamento}
                      onChange={(e) => setFundamento(e.target.value)}
                      className={CAMPO}
                      placeholder="ex.: início de laboração do estabelecimento, art. 140.º/2/b"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => aoPromover(c, { funcao, vinculo, fundamento })}
                className={`${BOTAO} mt-3`}
              >
                Promover
              </button>
            </div>
          )}

          {/* Apagar */}
          <div className="flex flex-wrap items-center gap-3 border-t border-creme-200 pt-3">
            {confirmarApagar ? (
              <>
                <span className="text-xs text-red-600">
                  Apaga o registo e os anexos. Não há volta.
                </span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => aoApagar(c)}
                  className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
                >
                  Apagar mesmo
                </button>
                <button type="button" onClick={() => setConfirmarApagar(false)} className={BOTAO_LEVE}>
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarApagar(true)}
                className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-red-600 hover:underline"
              >
                Apagar definitivamente
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export default Candidaturas
