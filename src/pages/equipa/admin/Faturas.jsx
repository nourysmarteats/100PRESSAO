// Registo de faturação (jul 2026, revisto ago 2026). Mostra, dos pedidos
// entregues, o que foi de facto emitido no Vendus, o que falhou e porquê, e o
// que ficou sem fatura.
//
// Antes só se olhava para fatura_pedida, o que dava uma leitura falsa: um
// pedido cuja emissão rebentou contava como "com fatura", porque o pedido de
// fatura tinha sido feito. O que interessa é se existe documento.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt, METODOS_PAGAMENTO } from '../../../lib/pedidos'
import { chamarApiFaturar } from '../../../lib/equipa'
import { CARTAO, BOTAO_SECUNDARIO, useAviso } from './comuns'

const rotuloMetodo = (id) =>
  METODOS_PAGAMENTO.find((m) => m.id === id)?.rotulo || id || '—'

// Três estados, e não dois: emitida (há documento), falhada (tentou-se e o
// Vendus recusou) e sem fatura (ninguém pediu).
// Estado da ligação ao Vendus, à cabeça do painel. Sem isto, "estamos a emitir
// documentos reais ou de ensaio?" respondia-se por suposição — e um documento
// fiscal emitido por engano não se apaga, corrige-se com nota de crédito.
function EstadoVendus() {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const verificar = useCallback(async () => {
    setOcupado(true)
    try {
      const { data } = await supabase.auth.getSession()
      const r = await fetch('/api/vendus-estado', {
        headers: { Authorization: `Bearer ${data?.session?.access_token}` },
      })
      setEstado(await r.json())
    } catch (e) {
      setEstado({ erro: e.message })
    }
    setOcupado(false)
  }, [])

  useEffect(() => {
    verificar()
  }, [verificar])

  const real = estado?.modo === 'normal'
  return (
    <div className={`${CARTAO} mb-6 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
              real ? 'bg-red-500/10 text-red-600' : 'bg-ambar-500/15 text-ambar-600'
            }`}
          >
            {estado ? (real ? 'Faturação real' : 'Modo de ensaio') : 'A verificar…'}
          </span>
          {estado && !estado.api_ok && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600">
              API indisponível
            </span>
          )}
          {estado?.postos_api === 0 && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600">
              Sem posto API
            </span>
          )}
        </div>
        <button type="button" onClick={verificar} disabled={ocupado} className={BOTAO_SECUNDARIO}>
          {ocupado ? 'A verificar…' : 'Verificar de novo'}
        </button>
      </div>

      {estado && (
        <div className="mt-3 space-y-1 text-xs leading-relaxed text-grafite-600">
          <p>
            {real
              ? 'Cada emissão produz um documento fiscal verdadeiro, comunicado à AT.'
              : 'Os documentos saem numa série de ensaio (número com “T”) e não têm valor fiscal.'}
            {estado.modo_explicito === false &&
              ' O modo não está definido no Vercel — é o valor por omissão, não uma decisão.'}
          </p>
          {!estado.chave_configurada && <p className="text-red-600">VENDUS_API_KEY por definir.</p>}
          {estado.api_mensagem && (
            <p className={estado.api_ok ? '' : 'text-red-600'}>{estado.api_mensagem}</p>
          )}
          {estado.subscricao_termina && <p>Subscrição até {estado.subscricao_termina}.</p>}
        </div>
      )}
    </div>
  )
}

const estadoFatura = (p) =>
  p.fatura_documento_numero ? 'emitida' : p.fatura_erro ? 'falhada' : 'sem'

function Faturas() {
  const [periodo, setPeriodo] = useState('semana')
  const [filtro, setFiltro] = useState('todas')
  const [pedidos, setPedidos] = useState(null)
  const [erro, setErro] = useState('')
  const [aEmitir, setAEmitir] = useState(null)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const inicio = new Date()
    if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7)
    if (periodo === 'mes') inicio.setDate(inicio.getDate() - 30)

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, numero, total, metodo_pagamento, criado_em, fatura_pedida, fatura_nif, fatura_documento_numero, fatura_url, fatura_erro, sessions ( nome_cliente, posicao_mesa )',
      )
      // Entregues (venda ao balcão, onde se paga no fim) e também as online já
      // pagas mas ainda em preparação — essas têm fatura devida desde o momento
      // do pagamento, e sem isto nem chegavam a aparecer aqui.
      .or('estado.eq.entregue,estado_pagamento.eq.pago')
      .gte('criado_em', inicio.toISOString())
      .order('criado_em', { ascending: false })
      .limit(500)
    if (error) {
      setErro(
        'Sem acesso aos dados de fatura. A migração SQL (fatura_pedida) já foi aplicada?',
      )
      setPedidos([])
      return
    }
    setErro('')
    setPedidos(data)
  }, [periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (pedidos === null) return <p className="text-grafite-600/70">A carregar…</p>
  if (erro) return <p className={`${CARTAO} p-6 text-grafite-600`}>{erro}</p>

  const emitidas = pedidos.filter((p) => estadoFatura(p) === 'emitida')
  const falhadas = pedidos.filter((p) => estadoFatura(p) === 'falhada')
  const semFatura = pedidos.filter((p) => estadoFatura(p) === 'sem')
  const soma = (arr) => arr.reduce((s, p) => s + Number(p.total || 0), 0)
  const lista =
    filtro === 'com'
      ? emitidas
      : filtro === 'falhou'
        ? falhadas
        : filtro === 'sem'
          ? semFatura
          : pedidos

  // Voltar a tentar sem sair do painel: os pedidos entregues já não aparecem no
  // ecrã de Staff, pelo que sem isto uma fatura falhada não teria como ser
  // reemitida.
  // Faturas emitidas sem o link do PDF: vai buscá-lo pelo ID do documento.
  async function buscarPdf(p) {
    setAEmitir(p.id)
    try {
      const { data } = await supabase.auth.getSession()
      const r = await fetch('/api/fatura-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data?.session?.access_token}`,
        },
        body: JSON.stringify({ pedido_id: p.id }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.erro || 'Erro no servidor.')
      window.open(json.url, '_blank', 'noopener')
    } catch (e) {
      mostrarAviso(e.message)
    }
    setAEmitir(null)
    carregar()
  }

  async function reemitir(p) {
    setAEmitir(p.id)
    try {
      const r = await chamarApiFaturar({ pedido_id: p.id, nif: p.fatura_nif || undefined })
      mostrarAviso(
        r.ja_existia ? 'Já existia fatura para este pedido.' : `Fatura ${r.numero || ''} emitida ✓`,
      )
    } catch (e) {
      mostrarAviso(e.message)
    }
    setAEmitir(null)
    carregar()
  }

  return (
    <div>
      <EstadoVendus />

      {/* Período */}
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

      {/* Apuração (€) por grupo */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { rotulo: 'Total apurado', valor: soma(pedidos), n: pedidos.length },
          { rotulo: 'Emitidas', valor: soma(emitidas), n: emitidas.length },
          { rotulo: 'Por emitir', valor: soma(falhadas) + soma(semFatura), n: falhadas.length + semFatura.length },
        ].map((k) => (
          <div key={k.rotulo} className={`${CARTAO} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
              {k.rotulo}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-grafite-900">{fmt(k.valor)}</p>
            <p className="mt-0.5 text-xs text-grafite-600/70">
              {k.n} {k.n === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="mt-6 flex gap-2">
        {[
          { id: 'todas', rotulo: `Todas (${pedidos.length})` },
          { id: 'com', rotulo: `Emitidas (${emitidas.length})` },
          { id: 'falhou', rotulo: `Falharam (${falhadas.length})` },
          { id: 'sem', rotulo: `Sem fatura (${semFatura.length})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              filtro === f.id
                ? 'border-grafite-900 bg-grafite-900 text-creme-50'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className={`${CARTAO} mt-4 p-6 text-grafite-600`}>Nada neste filtro.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {lista.map((p) => (
            <li
              key={p.id}
              className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
            >
              <div>
                <p className="font-semibold text-grafite-900">
                  <span className="font-display text-ambar-600">nº {p.numero}</span>
                  <span className="ml-3">{p.sessions?.nome_cliente || '—'}</span>
                  {p.sessions?.posicao_mesa && (
                    <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/70">
                      {p.sessions.posicao_mesa}
                    </span>
                  )}
                </p>
                <p className="text-sm text-grafite-600/70">
                  {new Date(p.criado_em).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {fmt(p.total)} · {rotuloMetodo(p.metodo_pagamento)}
                </p>
              </div>
              <div className="max-w-md text-right">
                {estadoFatura(p) === 'emitida' && (
                  <span className="rounded-full bg-ambar-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-ambar-600">
                    {p.fatura_documento_numero}
                  </span>
                )}
                {estadoFatura(p) === 'falhada' && (
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600">
                    Falhou
                  </span>
                )}
                {estadoFatura(p) === 'sem' && (
                  <span className="rounded-full border border-grafite-600/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-grafite-600/70">
                    Sem fatura
                  </span>
                )}

                {p.fatura_pedida && (
                  <p className="mt-1 text-xs text-grafite-600">
                    NIF: {p.fatura_nif || 'não indicado'}
                  </p>
                )}

                {/* A razão da recusa vive aqui: é onde alguém vem procurar por
                    que motivo uma fatura não saiu. */}
                {estadoFatura(p) === 'falhada' && (
                  <p className="mt-1 text-xs leading-relaxed text-red-600">{p.fatura_erro}</p>
                )}

                <div className="mt-2 flex justify-end gap-2">
                  {p.fatura_url ? (
                    <a
                      href={p.fatura_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={BOTAO_SECUNDARIO}
                    >
                      Ver PDF
                    </a>
                  ) : (
                    estadoFatura(p) === 'emitida' && (
                      <button
                        type="button"
                        disabled={aEmitir === p.id}
                        onClick={() => buscarPdf(p)}
                        className={BOTAO_SECUNDARIO}
                      >
                        {aEmitir === p.id ? 'A obter…' : 'Obter PDF'}
                      </button>
                    )
                  )}
                  {estadoFatura(p) !== 'emitida' && (
                    <button
                      type="button"
                      disabled={aEmitir === p.id}
                      onClick={() => reemitir(p)}
                      className={BOTAO_SECUNDARIO}
                    >
                      {aEmitir === p.id
                        ? 'A emitir…'
                        : estadoFatura(p) === 'falhada'
                          ? 'Tentar de novo'
                          : 'Emitir fatura'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-relaxed text-grafite-600/70">
        Só aparecem pedidos já entregues — é nesse momento que a fatura pode ser
        emitida. Enquanto o Vendus estiver em modo de testes, os documentos saem
        numa série de ensaio (número com “T”) e não têm valor fiscal.
      </p>

      {Aviso}
    </div>
  )
}

export default Faturas
