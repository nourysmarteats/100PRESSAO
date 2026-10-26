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
import { nifOpcionalValido, nifDeEmpresa, dadosEmpresaValidos } from '../../../lib/nif'
import { CARTAO, BOTAO_SECUNDARIO, useAviso } from './comuns'
import { imprimirTalao } from '../../../lib/talao'

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
  p.estado === 'cancelado'
    ? 'cancelado'
    : p.fatura_documento_numero
      ? 'emitida'
      : p.fatura_erro
        ? 'falhada'
        : 'sem'

const ROTULO_REEMBOLSO = { ifthenpay: 'reembolsado pelo IfThenPay', manual: 'reembolsado por fora' }

// Formulário de cancelamento. Um pedido pago tem três lados: a fatura (anulada
// com nota de crédito, se existir), o dinheiro (devolvido pelo IfThenPay ou por
// fora) e o registo (sai das vendas). O servidor faz os três por esta ordem e
// pára antes do dinheiro se a nota de crédito falhar — ver api/_lib/cancelamento.js.
function FormCancelar({ p, aoFechar, aoConcluir }) {
  const pago = ['pago', 'a_reembolsar'].includes(p.estado_pagamento)
  const soRegisto = p.estado === 'cancelado' // cancelado com reembolso por fazer
  const [motivo, setMotivo] = useState(p.cancelamento_motivo || '')
  const [reembolso, setReembolso] = useState(
    pago ? (p.metodo_pagamento === 'mbway' && !soRegisto ? 'ifthenpay' : 'manual') : 'nenhum',
  )
  const [nota, setNota] = useState('')
  const [confirmo, setConfirmo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const valido =
    motivo.trim().length >= 3 && (reembolso !== 'manual' || nota.trim().length >= 3) && confirmo

  async function enviar() {
    setOcupado(true)
    setErro('')
    try {
      const r = await chamarApiFaturar({
        acao: 'cancelar',
        pedido_id: p.id,
        motivo,
        reembolso,
        nota_reembolso: nota,
      })
      aoConcluir(r)
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }

  const CAMPO_P = 'mt-1 w-full rounded-lg border border-creme-300 px-2 py-1 text-sm outline-none focus:border-ambar-500'
  return (
    <div className="mt-3 w-full rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-left text-xs text-grafite-700">
      <p className="font-semibold text-red-700">
        {soRegisto ? 'Registar o reembolso' : `Cancelar o pedido nº ${p.numero}`} · {fmt(p.total)}
      </p>
      {!soRegisto && p.fatura_documento_numero && (
        <p className="mt-1">
          A fatura {p.fatura_documento_numero} vai ser anulada com uma <b>nota de crédito</b> na Vendus.
        </p>
      )}
      {!soRegisto && (
        <label className="mt-2 block">
          Motivo (curto, sem dados do cliente)
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
            placeholder="Cliente desistiu antes de preparar"
            className={CAMPO_P}
          />
        </label>
      )}
      {pago ? (
        <fieldset className="mt-2">
          <legend>Reembolso</legend>
          {p.metodo_pagamento === 'mbway' && !soRegisto && (
            <label className="mt-1 flex items-center gap-2">
              <input type="radio" checked={reembolso === 'ifthenpay'} onChange={() => setReembolso('ifthenpay')} />
              Devolver agora pelo IfThenPay (MB WAY)
            </label>
          )}
          <label className="mt-1 flex items-center gap-2">
            <input type="radio" checked={reembolso === 'manual'} onChange={() => setReembolso('manual')} />
            Já foi (ou vai ser) devolvido por fora
          </label>
          {reembolso === 'manual' && (
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 200))}
              placeholder="Como? Ex.: Neide, do bolso — a empresa deve-lhe o valor"
              className={CAMPO_P}
            />
          )}
        </fieldset>
      ) : (
        <p className="mt-2">Pagamento por cobrar: não há nada a devolver.</p>
      )}
      <label className="mt-2 flex items-center gap-2">
        <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
        Confirmo — {soRegisto ? 'o dinheiro foi devolvido' : 'isto não se desfaz'}
      </label>
      {erro && <p className="mt-2 text-red-600">{erro}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={aoFechar} disabled={ocupado} className={BOTAO_SECUNDARIO}>
          Voltar
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={!valido || ocupado}
          className="cursor-pointer rounded-full bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ocupado ? 'A tratar…' : soRegisto ? 'Registar reembolso' : 'Cancelar pedido'}
        </button>
      </div>
    </div>
  )
}

// Um endereço só serve para ser aberto se for mesmo externo. As faturas
// emitidas antes da validação no servidor têm aqui o objeto JSON que o Vendus
// devolveu, e um <a href> com isso lá dentro é lido como caminho relativo: o
// browser resolve-o contra 100pressao.pt, a rota não existe, o catch-all do
// router manda para "/" e o operador perde o painel e vai parar à loja.
//
// Ter esta verificação aqui E no servidor é repetição de propósito. O painel é
// a última porta antes do clique, e é a única que protege as linhas que já
// estão guardadas com lixo.
const linkExterno = (v) => (/^https?:\/\//i.test(String(v || '')) ? String(v) : null)

function Faturas() {
  const [periodo, setPeriodo] = useState('semana')
  const [filtro, setFiltro] = useState('todas')
  const [pedidos, setPedidos] = useState(null)
  const [erro, setErro] = useState('')
  const [aEmitir, setAEmitir] = useState(null)
  // NIFs corrigidos à mão, por pedido. Um cliente engana-se a escrever o NIF,
  // a fatura é recusada, e até aqui só se resolvia mexendo na base de dados —
  // quem está ao balcão ficava sem saída. Só existe enquanto não há documento:
  // depois de emitido, o NIF já não se corrige por aqui, corrige-se com nota
  // de crédito.
  const [nifs, setNifs] = useState({})
  // Nome e morada da empresa, por pedido, quando o NIF é de empresa: a Vendus
  // recusa a fatura sem morada (A001 — encomenda nº 40). Mesma regra dos NIFs:
  // só enquanto não há documento emitido.
  const [empresas, setEmpresas] = useState({})
  const [aCancelar, setACancelar] = useState(null)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const inicio = new Date()
    if (periodo === 'dia') inicio.setHours(0, 0, 0, 0)
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - 7)
    if (periodo === 'mes') inicio.setDate(inicio.getDate() - 30)

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, numero, total, metodo_pagamento, criado_em, fatura_pedida, fatura_nif, fatura_nome, fatura_morada, fatura_codigo_postal, fatura_localidade, fatura_documento_id, fatura_documento_numero, fatura_url, fatura_erro, estado, estado_pagamento, cancelamento_motivo, reembolso_meio, reembolso_nota, reembolso_erro, nota_credito_numero, nota_credito_url, sessions ( nome_cliente, posicao_mesa )',
      )
      // Entregues (venda ao balcão, onde se paga no fim) e também as online já
      // pagas mas ainda em preparação — essas têm fatura devida desde o momento
      // do pagamento, e sem isto nem chegavam a aparecer aqui.
      .or('estado.eq.entregue,estado_pagamento.eq.pago,estado.eq.cancelado')
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

  const cancelados = pedidos.filter((p) => estadoFatura(p) === 'cancelado')
  const ativos = pedidos.filter((p) => estadoFatura(p) !== 'cancelado')
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
          : filtro === 'cancelados'
            ? cancelados
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

      // Caminho normal: o servidor foi buscar o ficheiro ao Vendus com a chave
      // e manda-o em base64. Monta-se aqui e abre-se a partir da memória do
      // browser — não há endereço nenhum a pedir autenticação, que era o que
      // dava a janela de "Sign in" do vendus.pt.
      if (json.pdf_base64) {
        const bytes = Uint8Array.from(atob(json.pdf_base64), (c) => c.charCodeAt(0))
        const endereco = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        window.open(endereco, '_blank', 'noopener')
        // Libertar de imediato fechava o separador que acabou de abrir; um
        // minuto chega para o browser ler o ficheiro e não deixa isto a ocupar
        // memória durante todo o turno.
        setTimeout(() => URL.revokeObjectURL(endereco), 60000)
        return
      }

      // Endereço público, se algum dia o Vendus devolver um. Continua a ter de
      // ser externo: um caminho relativo levava o operador para fora do painel,
      // para a loja, em vez de abrir o PDF.
      if (!/^https?:\/\//i.test(String(json.url || ''))) {
        throw new Error('O Vendus não devolveu o PDF nem um endereço que se possa abrir.')
      }
      window.open(json.url, '_blank', 'noopener')
    } catch (e) {
      mostrarAviso(e.message)
    }
    setAEmitir(null)
    carregar()
  }

  // O que está escrito no painel, ou o que já vinha gravado na encomenda.
  const empresaDe = (p) => ({
    nome: p.fatura_nome ?? '',
    morada: p.fatura_morada ?? '',
    codigo_postal: p.fatura_codigo_postal ?? '',
    localidade: p.fatura_localidade ?? '',
    ...(empresas[p.id] || {}),
  })
  const precisaEmpresa = (p) => nifDeEmpresa(nifs[p.id] ?? p.fatura_nif ?? '')
  const mudarEmpresa = (p, campo, valor) =>
    setEmpresas((atual) => ({ ...atual, [p.id]: { ...empresaDe(p), [campo]: valor } }))

  async function reemitir(p) {
    setAEmitir(p.id)
    try {
      const nif = (nifs[p.id] ?? p.fatura_nif ?? '').replace(/\D/g, '')
      const empresa = nifDeEmpresa(nif) ? empresaDe(p) : undefined
      const r = await chamarApiFaturar({ pedido_id: p.id, nif: nif || undefined, empresa })
      mostrarAviso(
        r.ja_existia ? 'Já existia fatura para este pedido.' : `Fatura ${r.numero || ''} emitida ✓`,
      )
      setNifs((atual) => {
        const { [p.id]: _usado, ...resto } = atual
        return resto
      })
      setEmpresas((atual) => {
        const { [p.id]: _usada, ...resto } = atual
        return resto
      })
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
          { rotulo: 'Total apurado', valor: soma(ativos), n: ativos.length },
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
          { id: 'cancelados', rotulo: `Cancelados (${cancelados.length})` },
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
                {estadoFatura(p) === 'cancelado' ? (
                  <div>
                    <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600">
                      Cancelado
                    </span>
                    {p.nota_credito_numero && (
                      <p className="mt-1 text-xs text-grafite-600">
                        Fatura {p.fatura_documento_numero} anulada pela{' '}
                        {linkExterno(p.nota_credito_url) ? (
                          <a href={linkExterno(p.nota_credito_url)} target="_blank" rel="noopener noreferrer" className="underline">
                            {p.nota_credito_numero}
                          </a>
                        ) : (
                          p.nota_credito_numero
                        )}
                      </p>
                    )}
                    {p.cancelamento_motivo && (
                      <p className="mt-1 text-xs text-grafite-600">Motivo: {p.cancelamento_motivo}</p>
                    )}
                    {p.estado_pagamento === 'reembolsado' && (
                      <p className="mt-1 text-xs text-grafite-600">
                        {fmt(p.total)} {ROTULO_REEMBOLSO[p.reembolso_meio] || 'reembolsado'}
                        {p.reembolso_nota ? ` — ${p.reembolso_nota}` : ''}
                      </p>
                    )}
                    {p.estado_pagamento === 'a_reembolsar' && (
                      <>
                        <p className="mt-1 text-xs text-red-600">
                          Falta devolver {fmt(p.total)}. {p.reembolso_erro}
                        </p>
                        {aCancelar === p.id ? (
                          <FormCancelar
                            p={p}
                            aoFechar={() => setACancelar(null)}
                            aoConcluir={() => {
                              setACancelar(null)
                              mostrarAviso('Reembolso registado ✓')
                              carregar()
                            }}
                          />
                        ) : (
                          <div className="mt-2 flex justify-end">
                            <button type="button" onClick={() => setACancelar(p.id)} className={BOTAO_SECUNDARIO}>
                              Registar reembolso
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                <>
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

                {estadoFatura(p) === 'emitida'
                  ? p.fatura_pedida && (
                      <p className="mt-1 text-xs text-grafite-600">
                        NIF: {p.fatura_nif || 'não indicado'}
                      </p>
                    )
                  : (
                      <label className="mt-2 block text-xs text-grafite-600">
                        NIF
                        <input
                          value={nifs[p.id] ?? p.fatura_nif ?? ''}
                          onChange={(e) =>
                            setNifs((atual) => ({
                              ...atual,
                              [p.id]: e.target.value.replace(/\D/g, '').slice(0, 9),
                            }))
                          }
                          inputMode="numeric"
                          placeholder="sem NIF — consumidor final"
                          className={`mt-1 w-48 rounded-lg border px-2 py-1 text-sm outline-none ${
                            nifOpcionalValido(nifs[p.id] ?? p.fatura_nif ?? '')
                              ? 'border-creme-300 focus:border-ambar-500'
                              : 'border-red-500'
                          }`}
                        />
                        {!nifOpcionalValido(nifs[p.id] ?? p.fatura_nif ?? '') && (
                          <span className="mt-1 block text-xs text-red-600">
                            {(nifs[p.id] ?? p.fatura_nif ?? '').length < 9
                              ? 'O NIF tem 9 dígitos.'
                              : 'Este NIF não é válido — confirme os dígitos.'}
                          </span>
                        )}
                      </label>
                    )}

                {/* A razão da recusa vive aqui: é onde alguém vem procurar por
                    que motivo uma fatura não saiu. */}
                {estadoFatura(p) === 'falhada' && (
                  <p className="mt-1 text-xs leading-relaxed text-red-600">{p.fatura_erro}</p>
                )}

                {estadoFatura(p) !== 'emitida' && precisaEmpresa(p) && (
                  <div className="mt-2 grid max-w-md gap-1 text-xs text-grafite-600">
                    <span className="font-semibold">NIF de empresa — a fatura precisa do nome e da morada fiscal</span>
                    {[
                      { campo: 'nome', rotulo: 'Nome da empresa', ph: 'Empresa, Lda.' },
                      { campo: 'morada', rotulo: 'Morada fiscal', ph: 'Rua, n.º, andar' },
                      { campo: 'codigo_postal', rotulo: 'Código postal', ph: '0000-000' },
                      { campo: 'localidade', rotulo: 'Localidade', ph: 'Lisboa' },
                    ].map(({ campo, rotulo, ph }) => (
                      <label key={campo} className="block">
                        {rotulo}
                        <input
                          value={empresaDe(p)[campo]}
                          onChange={(e) => mudarEmpresa(p, campo, e.target.value)}
                          placeholder={ph}
                          className="mt-1 w-full rounded-lg border border-creme-300 px-2 py-1 text-sm outline-none focus:border-ambar-500"
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex justify-end gap-2">
                  {/* A decisão é pelo endereço ser aproveitável, não por o
                      campo estar preenchido: preenchido com lixo, mostrava
                      "Ver PDF" e escondia o botão que ia buscar o endereço
                      bom — a fatura ficava presa sem forma de se recuperar. */}
                  {linkExterno(p.fatura_url) ? (
                    <a
                      href={linkExterno(p.fatura_url)}
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
                  {/* Reimpressão no balcão: sai sempre como 2.ª via, porque quem
                      vem aqui é porque o original já saiu (ou se perdeu). */}
                  {estadoFatura(p) === 'emitida' && p.fatura_documento_id && (
                    <button
                      type="button"
                      disabled={aEmitir === p.id}
                      onClick={async () => {
                        setAEmitir(p.id)
                        try {
                          await imprimirTalao(p.id, p.fatura_documento_id, { segundaVia: true })
                          mostrarAviso('Talão enviado (2.ª via) ✓')
                        } catch (e) {
                          mostrarAviso(`Talão não imprimiu: ${e.message}`)
                        }
                        setAEmitir(null)
                      }}
                      className={BOTAO_SECUNDARIO}
                    >
                      Imprimir talão
                    </button>
                  )}
                  {estadoFatura(p) !== 'emitida' && (
                    <button
                      type="button"
                      disabled={
                        aEmitir === p.id ||
                        !nifOpcionalValido(nifs[p.id] ?? p.fatura_nif ?? '') ||
                        (precisaEmpresa(p) && !dadosEmpresaValidos(empresaDe(p)))
                      }
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
                  {aCancelar !== p.id && (
                    <button
                      type="button"
                      onClick={() => setACancelar(p.id)}
                      className="cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-500/5"
                    >
                      Cancelar e reembolsar
                    </button>
                  )}
                </div>
                {aCancelar === p.id && (
                  <FormCancelar
                    p={p}
                    aoFechar={() => setACancelar(null)}
                    aoConcluir={(r) => {
                      setACancelar(null)
                      mostrarAviso(
                        `Pedido nº ${r.numero} cancelado` +
                          (r.nota_credito ? ` · nota de crédito ${r.nota_credito}` : '') +
                          (r.reembolso === 'ifthenpay' ? ' · reembolsado pelo IfThenPay' : '') +
                          (r.reembolso === 'manual' ? ' · reembolso por fora registado' : '') +
                          (r.aviso ? ` · ATENÇÃO: ${r.aviso}` : ' ✓'),
                      )
                      carregar()
                    }}
                  />
                )}
                </>
                )}
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
