// Vendas efetuadas — painel do /caixa (Leandro, 26 out 2026).
//
// Lista as vendas do balcão e do site (takeaway e entrega) de um dia — por
// defeito hoje —, com detalhe e duas acções de balcão:
//   · Reimprimir talão (2.ª via), quando já há fatura;
//   · Emitir fatura, quando a venda foi em dinheiro sem fatura e o cliente a
//     pede depois (consumidor final ou NIF de particular).
// Anular venda e nota de crédito ficam de fora de propósito: mexem em
// documentos fiscais e dinheiro, e vivem só no Admin → Faturas. Fatura a
// empresa também vai para lá, porque exige nome e morada do adquirente.
// As plataformas (Uber Eats, Glovo, Bolt Food) não entram aqui: faturam elas.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt, METODOS_PAGAMENTO, nomeItemPedido, SELECT_PEDIDO_COMPLETO } from '../../lib/pedidos'
import { nifOpcionalValido, nifDeEmpresa } from '../../lib/nif'
import { chamarApiFaturar } from '../../lib/equipa'
import { imprimirTalao, jaFoiImpresso } from '../../lib/talao'
import { ePlataforma, rotuloPlataforma } from '../../lib/plataformas'

const BTN =
  'cursor-pointer rounded-2xl px-4 py-3 text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-40'
const BTN_PRIMARIO = `${BTN} bg-ambar-500 text-grafite-950 hover:bg-ambar-400`
const BTN_SECUNDARIO = `${BTN} border border-grafite-600 text-creme-300 hover:border-creme-300`

// Só o que foi de facto vendido: pago, pago na entrega, ou já reembolsado
// (este último aparece, marcado, para o operador perceber o que aconteceu).
const ESTADOS_PAGAMENTO_VISIVEIS = ['pago', 'na_entrega', 'reembolsado']

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Limites do dia na hora local do balcão (Lisboa), em ISO para a consulta.
function limitesDoDia(diaISO) {
  const [a, m, d] = diaISO.split('-').map(Number)
  const inicio = new Date(a, m - 1, d, 0, 0, 0, 0)
  const fim = new Date(a, m - 1, d + 1, 0, 0, 0, 0)
  return [inicio.toISOString(), fim.toISOString()]
}

const hora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

const rotuloMetodo = (id) =>
  id === 'plataforma' ? 'Pago na plataforma' : METODOS_PAGAMENTO.find((m) => m.id === id)?.rotulo || id || '—'

function origemDaVenda(p) {
  const posicao = p.sessions?.posicao_mesa || ''
  if (ePlataforma(p.canal)) {
    return `${rotuloPlataforma(p.canal)}${p.plataforma_ref ? ` · ${p.plataforma_ref}` : ''}`
  }
  if (p.canal === 'online') {
    if (/entrega/i.test(posicao) || p.tipo_entrega === 'entrega') return 'Site · Entrega'
    return 'Site · Takeaway'
  }
  if (posicao === 'PDV' || !posicao) return 'Balcão'
  return posicao
}

function Etiqueta({ children, cor = 'creme' }) {
  const cores = {
    creme: 'border-creme-500/30 text-creme-400',
    ambar: 'border-ambar-500/40 text-ambar-400',
    vermelho: 'border-red-500/40 text-red-400',
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cores[cor]}`}
    >
      {children}
    </span>
  )
}

function estadoEspecial(p) {
  if (p.estado === 'cancelado') return 'Cancelada'
  if (p.estado_pagamento === 'reembolsado') return 'Reembolsada'
  return null
}

// ---------------------------------------------------------------
// Detalhe de uma venda
// ---------------------------------------------------------------
function DetalheVenda({ venda, aoVoltar, aoAtualizar }) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [pedirNif, setPedirNif] = useState(false)
  const [nif, setNif] = useState('')

  const especial = estadoEspecial(venda)
  const temFatura = !!venda.fatura_documento_id
  const podeReimprimir = temFatura && !especial
  const podeFaturar = !temFatura && !especial && venda.estado_pagamento === 'pago'
  const nifLimpo = nif.replace(/\D/g, '')
  const nifOk = nifOpcionalValido(nifLimpo)
  const eEmpresa = nifLimpo.length === 9 && nifDeEmpresa(nifLimpo)

  async function reimprimir() {
    setOcupado(true)
    setAviso('')
    try {
      const { via, rawbt, modo } = await imprimirTalao(venda.id, venda.fatura_documento_id, { segundaVia: true })
      setAviso(`${via === 'SECOND' ? '✓ Talão enviado (2.ª via)' : '✓ Talão enviado'}${rawbt ? ` · RawBT (${modo})` : ''}`)
    } catch (e) {
      setAviso(`Talão não imprimiu: ${e.message}`)
    }
    setOcupado(false)
  }

  async function emitirFatura() {
    if (!nifOk || eEmpresa) return
    setOcupado(true)
    setAviso('')
    try {
      const r = await chamarApiFaturar({ pedido_id: venda.id, nif: nifLimpo || undefined })
      let talao = ''
      if (r.documento_id) {
        try {
          await imprimirTalao(venda.id, String(r.documento_id))
          talao = ' · talão impresso'
        } catch (e) {
          talao = ` · talão não imprimiu (${e.message})`
        }
      }
      setAviso(`✓ Fatura ${r.numero || ''} emitida${talao}`)
      setPedirNif(false)
      aoAtualizar()
    } catch (e) {
      setAviso(`Fatura falhou: ${e.message}`)
    }
    setOcupado(false)
  }

  const subtotal = (venda.order_items || []).reduce(
    (s, i) => s + Number(i.preco_unitario || 0) * Number(i.quantidade || 0),
    0,
  )

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={aoVoltar}
        className="mb-4 cursor-pointer self-start text-xs font-semibold uppercase tracking-widest text-creme-500/60 hover:text-creme-300"
      >
        ← Vendas
      </button>

      <div className="flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-ambar-500">nº {venda.numero}</span>
        <span className="text-sm text-creme-400">
          {new Date(venda.criado_em).toLocaleDateString('pt-PT')} · {hora(venda.criado_em)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Etiqueta>{origemDaVenda(venda)}</Etiqueta>
        <Etiqueta>{rotuloMetodo(venda.metodo_pagamento)}</Etiqueta>
        {venda.numero_beta && <Etiqueta cor="ambar">Beta #{venda.numero_beta}</Etiqueta>}
        {especial && <Etiqueta cor="vermelho">{especial}</Etiqueta>}
      </div>

      <ul className="mt-4 flex-1 space-y-1 overflow-y-auto border-t border-grafite-700 pt-3">
        {(venda.order_items || []).map((item) => (
          <li key={item.id} className="flex justify-between gap-3 text-sm text-creme-300">
            <span>
              {item.quantidade}× {nomeItemPedido(item)}
            </span>
            <span className="shrink-0 text-creme-500/70">
              {fmt(Number(item.preco_unitario) * Number(item.quantidade))}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 border-t border-grafite-700 pt-3 text-sm">
        {Number(venda.desconto_beta) > 0 && (
          <div className="flex justify-between text-creme-400">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
        )}
        {Number(venda.desconto_beta) > 0 && (
          <div className="flex justify-between text-ambar-400">
            <span>Desconto Cliente Beta</span>
            <span>−{fmt(Number(venda.desconto_beta))}</span>
          </div>
        )}
        {Number(venda.portes) > 0 && (
          <div className="flex justify-between text-creme-400">
            <span>Entrega</span>
            <span>{fmt(Number(venda.portes))}</span>
          </div>
        )}
        <div className="flex justify-between font-display text-2xl font-bold text-creme-50">
          <span>Total</span>
          <span>{fmt(Number(venda.total || 0))}</span>
        </div>
        <p className="text-xs text-creme-500/60">
          {temFatura
            ? `Fatura ${venda.fatura_documento_numero || 'emitida'}${venda.fatura_nif ? ` · NIF ${venda.fatura_nif}` : ''}`
            : 'Sem fatura'}
        </p>
      </div>

      {aviso && (
        <p className="mt-3 rounded-xl border border-ambar-500/30 bg-ambar-500/10 px-4 py-2 text-sm text-ambar-400">
          {aviso}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {podeReimprimir && (
          <button type="button" disabled={ocupado} onClick={reimprimir} className={BTN_PRIMARIO}>
            {ocupado ? 'A imprimir…' : 'Reimprimir talão (2.ª via)'}
          </button>
        )}

        {podeFaturar && !pedirNif && (
          <button type="button" disabled={ocupado} onClick={() => setPedirNif(true)} className={BTN_SECUNDARIO}>
            Emitir fatura
          </button>
        )}

        {podeFaturar && pedirNif && (
          <div className="rounded-2xl border border-grafite-700 p-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-creme-500/70">
              NIF do cliente (opcional)
            </label>
            <input
              inputMode="numeric"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              placeholder="Vazio = consumidor final"
              className={`mt-1 w-full rounded-xl border bg-grafite-800 px-3 py-2 text-creme-50 outline-none focus:border-ambar-500 ${
                nifOk ? 'border-grafite-600' : 'border-red-500'
              }`}
            />
            {!nifOk && <p className="mt-1 text-xs text-red-400">NIF inválido.</p>}
            {eEmpresa && (
              <p className="mt-1 text-xs text-ambar-400">
                NIF de empresa: a fatura precisa de nome e morada. Emite-a em Admin → Faturas.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={ocupado || !nifOk || eEmpresa}
                onClick={emitirFatura}
                className={`${BTN_PRIMARIO} flex-1`}
              >
                {ocupado ? 'A emitir…' : 'Emitir e imprimir'}
              </button>
              <button type="button" disabled={ocupado} onClick={() => setPedirNif(false)} className={BTN_SECUNDARIO}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!temFatura && !podeFaturar && !especial && (
          <p className="text-xs text-creme-500/60">
            Esta venda ainda não está paga — não se emite fatura daqui.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Painel (gaveta lateral sobre o PDV)
// ---------------------------------------------------------------
export default function PainelVendas({ aoFechar }) {
  const [dia, setDia] = useState(hojeISO)
  const [vendas, setVendas] = useState([])
  const [aCarregar, setACarregar] = useState(true)
  const [erro, setErro] = useState('')
  const [selecionadaId, setSelecionadaId] = useState(null)
  const [pesquisa, setPesquisa] = useState('')

  const carregar = useCallback(async () => {
    if (!supabase) return
    setACarregar(true)
    setErro('')
    const [inicio, fim] = limitesDoDia(dia)
    const { data, error } = await supabase
      .from('orders')
      .select(SELECT_PEDIDO_COMPLETO)
      .gte('criado_em', inicio)
      .lt('criado_em', fim)
      .in('estado_pagamento', ESTADOS_PAGAMENTO_VISIVEIS)
      .order('criado_em', { ascending: false })
      .limit(500)
    if (error) setErro(error.message)
    else setVendas(data || [])
    setACarregar(false)
  }, [dia])

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtradas = useMemo(() => {
    const t = pesquisa.trim().toLowerCase()
    if (!t) return vendas
    return vendas.filter(
      (v) =>
        String(v.numero).includes(t) ||
        (v.fatura_documento_numero || '').toLowerCase().includes(t) ||
        (v.cliente_nome || '').toLowerCase().includes(t),
    )
  }, [vendas, pesquisa])

  const totalDia = vendas
    .filter((v) => !estadoEspecial(v))
    .reduce((s, v) => s + Number(v.total || 0), 0)
  const selecionada = vendas.find((v) => v.id === selecionadaId)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={aoFechar}>
      <aside
        className="flex h-full w-full max-w-xl flex-col border-l border-grafite-700 bg-grafite-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {selecionada ? (
          <DetalheVenda
            venda={selecionada}
            aoVoltar={() => setSelecionadaId(null)}
            aoAtualizar={carregar}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest text-ambar-500">
                Vendas efetuadas
              </h2>
              <button
                type="button"
                onClick={aoFechar}
                className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-creme-500/60 hover:text-creme-300"
              >
                Fechar ✕
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="date"
                value={dia}
                max={hojeISO()}
                onChange={(e) => e.target.value && setDia(e.target.value)}
                className="rounded-xl border border-grafite-600 bg-grafite-800 px-3 py-2 text-sm text-creme-50 outline-none focus:border-ambar-500"
              />
              <input
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Nº do pedido ou da fatura"
                className="min-w-0 flex-1 rounded-xl border border-grafite-600 bg-grafite-800 px-3 py-2 text-sm text-creme-50 outline-none focus:border-ambar-500"
              />
              <button type="button" onClick={carregar} className={BTN_SECUNDARIO} title="Atualizar">
                ↻
              </button>
            </div>

            <p className="mb-3 text-xs uppercase tracking-widest text-creme-500/60">
              {vendas.length} {vendas.length === 1 ? 'venda' : 'vendas'} · {fmt(totalDia)}
            </p>

            {erro && <p className="mb-3 text-sm text-red-400">Erro: {erro}</p>}

            {aCarregar ? (
              <p className="flex-1 text-sm text-creme-500/50">A carregar…</p>
            ) : filtradas.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-sm uppercase tracking-widest text-creme-500/40">
                Sem vendas
              </p>
            ) : (
              <ul className="flex-1 space-y-2 overflow-y-auto pr-1">
                {filtradas.map((v) => {
                  const especial = estadoEspecial(v)
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelecionadaId(v.id)}
                        className="w-full cursor-pointer rounded-2xl border border-grafite-700 bg-grafite-900 px-4 py-3 text-left transition-colors hover:border-ambar-500/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-creme-400">{hora(v.criado_em)}</span>
                          <span className="font-display text-lg font-bold text-ambar-500">nº {v.numero}</span>
                          <span
                            className={`ml-auto font-display text-lg font-bold ${especial ? 'text-creme-500/40 line-through' : 'text-creme-50'}`}
                          >
                            {fmt(Number(v.total || 0))}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Etiqueta>{origemDaVenda(v)}</Etiqueta>
                          <Etiqueta>{rotuloMetodo(v.metodo_pagamento)}</Etiqueta>
                          {v.fatura_documento_id ? (
                            <Etiqueta cor="ambar">
                              {v.fatura_documento_numero || 'Fatura'}
                              {jaFoiImpresso(v.fatura_documento_id) ? ' · impressa' : ''}
                            </Etiqueta>
                          ) : (
                            <Etiqueta>Sem fatura</Etiqueta>
                          )}
                          {especial && <Etiqueta cor="vermelho">{especial}</Etiqueta>}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
