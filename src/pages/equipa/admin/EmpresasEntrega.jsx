// Empresas de entrega (operadores de frota) — ata de 2026-10-12.
//
// As empresas registam-se em /parceiro-entregas e aparecem aqui como
// "Por decidir". Aprovar fixa o preço acordado: se ninguém o mexer, fica o
// proposto (a base de dados faz isso no trigger, não este ecrã).
//
// Cada mudança de estado ou de preço fica no audit_log pelo próprio trigger
// da tabela. Este ecrã só regista à parte as datas de contrato e de acordo de
// tratamento de dados, que não passam por esse trigger.
//
// Regra que este ecrã torna visível: sem acordo art. 28.º assinado, a empresa
// não recebe dados de clientes (aplicado no despacho, Fase 2).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { registarAuditoria } from '../../../lib/equipa'
import { ESTADOS, custoEntrega, paraNumero } from '../../../lib/empresasEntrega'
import { useAviso, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, BOTAO_PERIGO, CARTAO, CAMPO } from './comuns'

const COR_ESTADO = {
  pendente: 'border-ambar-500/40 bg-ambar-500/15 text-ambar-700',
  aprovada: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700',
  rejeitada: 'border-red-500/30 bg-red-500/10 text-red-600',
  suspensa: 'border-grafite-600/30 bg-grafite-600/10 text-grafite-700',
  terminada: 'border-grafite-600/20 bg-creme-100 text-grafite-600',
}

const FILTROS = [
  ['ativas', 'Por decidir e aprovadas'],
  ['todas', 'Todas'],
]

const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-PT') : '—')

function Etiqueta({ estado, simulacao }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${COR_ESTADO[estado]}`}>
        {ESTADOS[estado] || estado}
      </span>
      {simulacao && (
        <span className="rounded-full border border-cobre-600/30 bg-cobre-600/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-cobre-600">
          Simulação
        </span>
      )}
    </span>
  )
}

function Ficha({ empresa, aoGuardar, mostrarAviso }) {
  const [base, setBase] = useState(String(empresa.tarifa_base ?? empresa.tarifa_proposta_base))
  const [km, setKm] = useState(String(empresa.tarifa_km ?? empresa.tarifa_proposta_km))
  const [motivo, setMotivo] = useState(empresa.motivo_decisao || '')
  const [contrato, setContrato] = useState(empresa.contrato_assinado_em || '')
  const [acordo, setAcordo] = useState(empresa.acordo_dados_assinado_em || '')
  const [ocupado, setOcupado] = useState(false)

  const precoValido = paraNumero(base) >= 0 && paraNumero(base) <= 50 && paraNumero(km) >= 0 && paraNumero(km) <= 10

  async function atualizar(campos, mensagem) {
    setOcupado(true)
    const { error } = await supabase.from('empresas_entrega').update(campos).eq('id', empresa.id)
    setOcupado(false)
    if (error) {
      mostrarAviso('Erro ao guardar.')
      return false
    }
    mostrarAviso(mensagem)
    aoGuardar()
    return true
  }

  const preco = () => ({
    tarifa_base: Math.round(paraNumero(base) * 100) / 100,
    tarifa_km: Math.round(paraNumero(km) * 100) / 100,
  })

  async function decidir(estado) {
    if (estado === 'aprovada' && !precoValido) return mostrarAviso('Preço inválido.')
    if (['rejeitada', 'suspensa', 'terminada'].includes(estado) && !motivo.trim()) {
      return mostrarAviso('Escreve o motivo antes de decidir.')
    }
    const campos = { estado, motivo_decisao: motivo.trim() || null }
    if (estado === 'aprovada') Object.assign(campos, preco())
    await atualizar(campos, `${ESTADOS[estado]} ✓`)
  }

  async function guardarDatas() {
    const ok = await atualizar(
      { contrato_assinado_em: contrato || null, acordo_dados_assinado_em: acordo || null },
      'Datas guardadas ✓',
    )
    if (ok) {
      registarAuditoria('empresa_entrega_documentos', {
        id: empresa.id,
        contrato: contrato || null,
        acordo_dados: acordo || null,
      })
    }
  }

  const e = empresa
  return (
    <div className="space-y-5 border-t border-creme-300 px-5 pb-5 pt-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">NIPC</dt><dd className="font-semibold">{e.nipc}</dd></div>
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Registada em</dt><dd>{data(e.criado_em)}</dd></div>
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Contacto</dt>
          <dd>{e.contacto_nome || '—'}
            {e.contacto_email && <> · <a className="text-cobre-600 hover:underline" href={`mailto:${e.contacto_email}`}>{e.contacto_email}</a></>}
            {e.contacto_telefone && <> · <a className="text-cobre-600 hover:underline" href={`tel:${e.contacto_telefone}`}>{e.contacto_telefone}</a></>}
          </dd></div>
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Zona · estafetas</dt><dd>{e.zona || '—'} · {e.n_estafetas ?? '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Preço proposto</dt>
          <dd>{fmt(e.tarifa_proposta_base)} + {fmt(e.tarifa_proposta_km)}/km</dd></div>
        <div><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Condições aceites</dt>
          <dd>v. {e.termos_versao} em {data(e.aceitou_termos_em)}</dd></div>
        {e.decidido_em && (
          <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-widest text-grafite-600/70">Última decisão</dt>
            <dd>{data(e.decidido_em)}{e.motivo_decisao ? ` — ${e.motivo_decisao}` : ''}</dd></div>
        )}
        {e.expira_em && (
          <div className="sm:col-span-2 text-xs text-grafite-600/70">Os dados deste registo são apagados automaticamente a {data(e.expira_em)}.</div>
        )}
      </dl>

      {/* Preço acordado */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Preço acordado</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs text-grafite-600/70">Por entrega (€)</span>
            <input value={base} onChange={(ev) => setBase(ev.target.value)} inputMode="decimal" className={`${CAMPO} w-28`} /></label>
          <label className="block"><span className="text-xs text-grafite-600/70">Por km (€)</span>
            <input value={km} onChange={(ev) => setKm(ev.target.value)} inputMode="decimal" className={`${CAMPO} w-28`} /></label>
          {e.estado === 'aprovada' && (
            <button type="button" disabled={ocupado || !precoValido} className={BOTAO_SECUNDARIO}
              onClick={() => atualizar(preco(), 'Preço atualizado ✓')}>Atualizar preço</button>
          )}
        </div>
        {precoValido && (
          <p className="mt-2 text-xs text-grafite-600/70">
            Exemplo: uma entrega de 3,25 km custa {fmt(custoEntrega(preco(), 3.25))} (sem IVA).
          </p>
        )}
      </div>

      {/* Contrato e acordo de dados */}
      {['aprovada', 'suspensa'].includes(e.estado) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Documentos assinados</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="block"><span className="text-xs text-grafite-600/70">Contrato de prestação de serviços</span>
              <input type="date" value={contrato} onChange={(ev) => setContrato(ev.target.value)} className={`${CAMPO} w-44`} /></label>
            <label className="block"><span className="text-xs text-grafite-600/70">Acordo de dados (art. 28.º RGPD)</span>
              <input type="date" value={acordo} onChange={(ev) => setAcordo(ev.target.value)} className={`${CAMPO} w-44`} /></label>
            <button type="button" disabled={ocupado} className={BOTAO_SECUNDARIO} onClick={guardarDatas}>Guardar datas</button>
          </div>
          {!e.acordo_dados_assinado_em && !e.simulacao && (
            <p className="mt-2 text-xs font-semibold text-red-600">
              Sem acordo de dados assinado: esta empresa não recebe dados de clientes.
            </p>
          )}
        </div>
      )}

      {/* Decisão */}
      <div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Motivo / nota da decisão</span>
          <input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} maxLength={500} className={CAMPO}
            placeholder="Obrigatório para rejeitar, suspender ou terminar" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {e.estado !== 'aprovada' && e.estado !== 'terminada' && (
            <button type="button" disabled={ocupado} className={BOTAO_PRIMARIO} onClick={() => decidir('aprovada')}>
              {e.estado === 'suspensa' ? 'Reativar' : 'Aprovar'}
            </button>
          )}
          {e.estado === 'pendente' && (
            <button type="button" disabled={ocupado} className={BOTAO_PERIGO} onClick={() => decidir('rejeitada')}>Rejeitar</button>
          )}
          {e.estado === 'aprovada' && (
            <button type="button" disabled={ocupado} className={BOTAO_SECUNDARIO} onClick={() => decidir('suspensa')}>Suspender</button>
          )}
          {['aprovada', 'suspensa'].includes(e.estado) && (
            <button type="button" disabled={ocupado} className={BOTAO_PERIGO} onClick={() => decidir('terminada')}>Terminar relação</button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmpresasEntrega() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState(false)
  const [aberta, setAberta] = useState(null)
  const [filtro, setFiltro] = useState('ativas')
  const [registoAberto, setRegistoAberto] = useState(null)
  const { mostrarAviso, Aviso } = useAviso()

  const carregar = useCallback(async () => {
    const [rEmp, rCfg] = await Promise.all([
      supabase.from('empresas_entrega').select('*').order('criado_em', { ascending: false }),
      supabase.from('definicoes').select('valor').eq('chave', 'empresas_entrega').maybeSingle(),
    ])
    if (rEmp.error) {
      setErro(true)
      setLista([])
      return
    }
    setLista(rEmp.data)
    setRegistoAberto(Boolean(rCfg.data?.valor?.registo_aberto))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarRegisto() {
    const { data: atual } = await supabase.from('definicoes').select('valor').eq('chave', 'empresas_entrega').maybeSingle()
    const novo = !registoAberto
    const { error } = await supabase.from('definicoes').upsert({
      chave: 'empresas_entrega',
      valor: { ...(atual?.valor || {}), registo_aberto: novo },
      atualizado_em: new Date().toISOString(),
    })
    if (error) return mostrarAviso('Erro ao guardar.')
    registarAuditoria('empresas_entrega_registo', { aberto: novo })
    setRegistoAberto(novo)
    mostrarAviso(novo ? 'Registo aberto ✓' : 'Registo fechado ✓')
  }

  const visiveis = useMemo(
    () => (lista || []).filter((e) => filtro === 'todas' || ['pendente', 'aprovada'].includes(e.estado)),
    [lista, filtro],
  )
  const porDecidir = (lista || []).filter((e) => e.estado === 'pendente').length

  if (erro) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        Não foi possível ler as empresas de entrega. Confirma que a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">20261012120000_empresas_entrega.sql</code>
        está aplicada no Supabase.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase text-grafite-900">Empresas de entrega</h2>
          <p className="mt-1 max-w-2xl text-sm text-grafite-600/80">
            Operadores de frota que fazem as entregas do restaurante online. Registam-se em{' '}
            <a className="font-semibold text-cobre-600 hover:underline" href="/parceiro-entregas" target="_blank" rel="noreferrer">
              /parceiro-entregas
            </a>. Pagamos sempre à empresa, nunca a estafetas.
          </p>
        </div>
        {registoAberto !== null && (
          <button type="button" onClick={alternarRegisto} className={BOTAO_SECUNDARIO}>
            Registo {registoAberto ? 'aberto · fechar' : 'fechado · abrir'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(([id, rotulo]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${
              filtro === id ? 'bg-grafite-900 text-creme-50' : 'border border-creme-300 text-grafite-600'}`}>
            {rotulo}
          </button>
        ))}
        {porDecidir > 0 && (
          <span className="text-sm font-semibold text-ambar-700">{porDecidir} por decidir</span>
        )}
      </div>

      {lista === null ? (
        <p className="text-sm text-grafite-600/70">A carregar…</p>
      ) : visiveis.length === 0 ? (
        <p className={`${CARTAO} p-6 text-sm text-grafite-600`}>Ainda não há empresas registadas.</p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((e) => (
            <li key={e.id} className={CARTAO}>
              <button type="button" onClick={() => setAberta(aberta === e.id ? null : e.id)}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-5 text-left">
                <span>
                  <span className="block font-semibold text-grafite-900">{e.nome_comercial || e.nome_legal}</span>
                  <span className="block text-xs text-grafite-600/70">
                    {e.nome_legal} · {e.tarifa_base != null
                      ? `${fmt(e.tarifa_base)} + ${fmt(e.tarifa_km)}/km`
                      : `proposta ${fmt(e.tarifa_proposta_base)} + ${fmt(e.tarifa_proposta_km)}/km`}
                  </span>
                </span>
                <Etiqueta estado={e.estado} simulacao={e.simulacao} />
              </button>
              {aberta === e.id && <Ficha key={e.atualizado_em} empresa={e} aoGuardar={carregar} mostrarAviso={mostrarAviso} />}
            </li>
          ))}
        </ul>
      )}
      {Aviso}
    </div>
  )
}

export default EmpresasEntrega
