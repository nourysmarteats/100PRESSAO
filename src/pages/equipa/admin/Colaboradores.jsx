// Colaboradores a recibos verdes: pagamento mensal e dependência económica.
//
// O ecrã existe para responder a uma pergunta que só é útil ANTES do
// pagamento: "quanto é que ainda posso pagar a esta pessoa, por esta
// entidade, até ao fim do ano". Um relatório do que já aconteceu chegaria
// sempre tarde — quando ficasse vermelho, o ano já estava fechado.
//
// A fração conhece-se mal por construção: o numerador é nosso e exato, o
// denominador é declarado pelo colaborador. O ecrã diz sempre qual é qual,
// e recusa-se a mostrar semáforo verde quando o que há é falta de dados.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { fmt } from '../../../lib/pedidos'
import { nifValido } from '../../../lib/nif'
import { registarAuditoria } from '../../../lib/equipa'
import Candidaturas from './Candidaturas'
import {
  ESTADOS,
  LIMIARES,
  VINCULOS,
  apurar,
  entraNoApuramento,
  fundamentoValido,
  simular,
  vinculoExigeFundamento,
  declaracaoDesatualizada,
  pct,
} from '../../../lib/colaboradores'
import {
  useAviso,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_PERIGO,
  CARTAO,
  CAMPO,
} from './comuns'

const hojeIso = () => new Date().toISOString().slice(0, 10)
const anoAtual = () => new Date().getFullYear()

const CORES_NIVEL = {
  verde: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  ambar: 'border-ambar-500/40 bg-ambar-500/15 text-ambar-700',
  vermelho: 'border-red-500/40 bg-red-500/10 text-red-600',
  critico: 'border-red-700 bg-red-600 text-white',
  sem_dados: 'border-creme-300 bg-creme-100 text-grafite-600/60',
  fora_ambito: 'border-grafite-400/40 bg-grafite-100 text-grafite-600',
}

const ROTULO_NIVEL = {
  verde: 'folga',
  ambar: 'a aproximar-se',
  vermelho: 'entidade contratante',
  critico: 'escalão agravado',
  sem_dados: 'sem declaração',
  fora_ambito: 'fora de âmbito',
}

const ENTIDADE_VAZIA = {
  nome: '',
  nipc: '',
  atividade: '',
  agrupamento: '',
  principal: false,
  ativo: true,
}
const COLAB_VAZIO = {
  nome: '',
  nif: '',
  email: '',
  telefone: '',
  perfil_id: '',
  estafeta_id: '',
  inicio_atividade: '',
  funcao: '',
  vinculo: '',
  vinculo_fundamento: '',
  estado: 'activo',
  data_inicio: '',
  data_fim: '',
  isento_art_53: false,
  isento_ss_art157: false,
  isencao_ss_fundamento: '',
  taxa_retencao_irs: 0,
  notas: '',
}

// Cores dos estados. `candidato` fica neutro de propósito: ainda não é
// ninguém no sistema, e um verde ali daria a ideia errada.
const CORES_ESTADO = {
  candidato: 'border-cobre-600/30 bg-cobre-600/10 text-cobre-700',
  activo: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  suspenso: 'border-ambar-500/40 bg-ambar-500/15 text-ambar-700',
  inactivo: 'border-creme-300 bg-creme-100 text-grafite-600/60',
}
const PAGAMENTO_VAZIO = {
  colaborador_id: '',
  entidade_id: '',
  data_recibo: hojeIso(),
  valor_base: '',
  iva: 0,
  retencao_irs: 0,
  numero_recibo: '',
  descricao: '',
  estado: 'previsto',
  pago_em: '',
  justificacao: '',
}

function Etiqueta({ nivel: n, children }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${CORES_NIVEL[n]}`}
    >
      {children ?? ROTULO_NIVEL[n]}
    </span>
  )
}

function Contador({ rotulo, valor, alerta }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        alerta ? 'border-ambar-500/40 bg-ambar-500/10' : 'border-creme-300 bg-creme-100/60'
      }`}
    >
      <p className="font-display text-xl font-bold text-grafite-900">{valor}</p>
      <p className="text-[0.65rem] uppercase tracking-widest text-grafite-600/60">{rotulo}</p>
    </div>
  )
}

function Chip({ activo, aoClicar, children }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest transition ${
        activo
          ? 'border-cobre-600 bg-cobre-600 text-creme-100'
          : 'border-creme-300 bg-creme-100 text-grafite-600 hover:border-cobre-600/50'
      }`}
    >
      {children}
    </button>
  )
}

function Colaboradores() {
  const [ano, setAno] = useState(anoAtual)
  const [entidades, setEntidades] = useState([])
  const [colabs, setColabs] = useState(null)
  const [perfis, setPerfis] = useState([])
  const [estafetas, setEstafetas] = useState([])
  const [rendimentos, setRendimentos] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [estafetaApurado, setEstafetaApurado] = useState({})
  const [limiares, setLimiares] = useState(LIMIARES)
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('activo')
  const [filtroVinculo, setFiltroVinculo] = useState('')

  const [formEntidade, setFormEntidade] = useState(null) // null | 'nova' | id
  const [entidade, setEntidade] = useState(ENTIDADE_VAZIA)
  const [formColab, setFormColab] = useState(null)
  const [colab, setColab] = useState(COLAB_VAZIO)
  const [formPagamento, setFormPagamento] = useState(false)
  const [pagamento, setPagamento] = useState(PAGAMENTO_VAZIO)
  const [ocupado, setOcupado] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  // ── Carregamento ────────────────────────────────────────────────────────
  const carregarBase = useCallback(async () => {
    const [rEnt, rCol, rPerfis, rEst, rCfg] = await Promise.all([
      supabase.from('entidades_grupo').select('*').order('nome'),
      supabase.from('colaboradores').select('*').order('nome'),
      supabase.from('perfis').select('id, nome, email').order('nome'),
      supabase.from('estafetas').select('id, nome').order('nome'),
      supabase.from('definicoes').select('valor').eq('chave', 'colaboradores').maybeSingle(),
    ])
    if (rEnt.error || rCol.error) {
      setTabelaEmFalta(true)
      setColabs([])
      return
    }
    setTabelaEmFalta(false)
    setEntidades(rEnt.data || [])
    setColabs(rCol.data || [])
    setPerfis(rPerfis.data || [])
    setEstafetas(rEst.data || [])
    if (rCfg.data?.valor) setLimiares({ ...LIMIARES, ...rCfg.data.valor })
  }, [])

  const carregarAno = useCallback(async () => {
    const [rPag, rRend, rOrders] = await Promise.all([
      supabase.from('colaborador_pagamentos').select('*').eq('ano', ano).order('data_recibo'),
      supabase.from('colaborador_rendimento_anual').select('*').eq('ano', ano),
      // Reconciliação: o que já foi apurado a estafetas neste ano vive em
      // orders.estafeta_taxa e ainda não passou por aqui. Sem isto, a fração
      // de quem também faz entregas sairia por baixo do que é.
      supabase
        .from('orders')
        .select('estafeta_id, estafeta_taxa')
        .not('estafeta_id', 'is', null)
        .gte('criado_em', `${ano}-01-01T00:00:00`)
        .lte('criado_em', `${ano}-12-31T23:59:59`),
    ])
    if (!rPag.error) setPagamentos(rPag.data || [])
    if (!rRend.error) setRendimentos(rRend.data || [])
    if (!rOrders.error) {
      const soma = {}
      for (const o of rOrders.data || []) {
        soma[o.estafeta_id] = (soma[o.estafeta_id] || 0) + Number(o.estafeta_taxa || 0)
      }
      setEstafetaApurado(soma)
    }
  }, [ano])

  useEffect(() => {
    carregarBase()
  }, [carregarBase])
  useEffect(() => {
    if (!tabelaEmFalta) carregarAno()
  }, [carregarAno, tabelaEmFalta])

  // ── Apuramento ──────────────────────────────────────────────────────────
  const entidadesAtivas = useMemo(() => entidades.filter((e) => e.ativo), [entidades])

  const porColaborador = useMemo(() => {
    if (!colabs) return []
    return colabs.map((c) => {
      const rend = rendimentos.find((r) => r.colaborador_id === c.id) || null
      const pags = pagamentos.filter((p) => p.colaborador_id === c.id)
      return {
        colaborador: c,
        rendimento: rend,
        pagamentos: pags,
        desatualizada: !rend || declaracaoDesatualizada(rend.declarado_em, limiares),
        porEstafeta: c.estafeta_id ? estafetaApurado[c.estafeta_id] || 0 : 0,
        ...apurar({
          pagamentos: pags,
          totalDeclarado: rend?.total_declarado,
          entidades: entidadesAtivas,
          colaborador: c,
          limiares,
        }),
      }
    })
  }, [colabs, rendimentos, pagamentos, entidadesAtivas, limiares, estafetaApurado])

  // Um trabalhador por conta de outrem não tem entidade contratante a apurar:
  // já se lhe desconta TSU. Mostrá-lo no painel de dependência com 0% seria
  // dizer que está seguro, quando na verdade está noutra conversa.
  const paraApuramento = useMemo(
    () => porColaborador.filter((x) => entraNoApuramento(x.colaborador.vinculo)),
    [porColaborador],
  )

  const contadores = useMemo(() => {
    const lista = colabs || []
    const conta = (f) => lista.filter(f).length
    return {
      total: lista.length,
      activos: conta((c) => (c.estado || 'activo') === 'activo'),
      suspensos: conta((c) => c.estado === 'suspenso'),
      inactivos: conta((c) => c.estado === 'inactivo'),
      candidatos: conta((c) => c.estado === 'candidato'),
      semVinculo: conta((c) => !c.vinculo && c.estado !== 'inactivo'),
      prestadores: conta((c) => c.vinculo === 'prestacao_servicos'),
      custoAno: paraApuramento.reduce((acc, x) => acc + (x.custoTotal || 0), 0),
      semDeclaracao: paraApuramento.filter((x) => !x.rendimento).length,
    }
  }, [colabs, paraApuramento])

  const colabsFiltrados = useMemo(() => {
    return (colabs || []).filter((c) => {
      const estado = c.estado || 'activo'
      if (filtroEstado && estado !== filtroEstado) return false
      if (filtroVinculo === '__sem__' && c.vinculo) return false
      if (filtroVinculo && filtroVinculo !== '__sem__' && c.vinculo !== filtroVinculo) return false
      return true
    })
  }, [colabs, filtroEstado, filtroVinculo])

  // Simulação do pagamento que está a ser escrito no formulário
  const simulacao = useMemo(() => {
    if (!pagamento.colaborador_id || !pagamento.entidade_id || !pagamento.valor_base) return null
    const alvo = porColaborador.find((x) => x.colaborador.id === pagamento.colaborador_id)
    if (!alvo) return null
    const linha = alvo.linhas.find((l) => l.entidade.id === pagamento.entidade_id)
    // A unidade de apuramento a que esta entidade pertence. É sobre ela que a
    // simulação corre: entidades do mesmo agrupamento empresarial são UMA
    // entidade contratante, e somar só o que esta pagou dava uma simulação
    // otimista — exatamente o erro que esta versão corrige.
    const unidade = alvo.contratantes.find((u) =>
      u.entidades.some((e) => e.id === pagamento.entidade_id),
    )
    return {
      ...simular({
        pagamentoValor: Number(pagamento.valor_base),
        pagoAtualNaUnidade: unidade?.pago || 0,
        totalDeclarado: alvo.rendimento?.total_declarado,
        foraDeAmbito: alvo.foraDeAmbito,
        limiares,
      }),
      semDeclaracao: !alvo.rendimento,
      entidadeNome: linha?.entidade.nome,
      unidadeNome: unidade?.nome,
      consolidada: (unidade?.entidades.length || 1) > 1,
      explicacaoForaDeAmbito: alvo.explicacaoForaDeAmbito,
    }
  }, [pagamento, porColaborador, limiares])

  // ── Escritas ────────────────────────────────────────────────────────────
  async function guardarEntidade(ev) {
    ev.preventDefault()
    const nipc = entidade.nipc.replace(/\D/g, '')
    if (!entidade.nome.trim()) return mostrarAviso('A entidade precisa de nome.')
    if (!nifValido(nipc)) return mostrarAviso('NIPC inválido (dígito de controlo errado).')
    setOcupado(true)
    const registo = {
      nome: entidade.nome.trim(),
      nipc,
      atividade: entidade.atividade.trim() || null,
      agrupamento: entidade.agrupamento.trim() || null,
      principal: !!entidade.principal,
      ativo: !!entidade.ativo,
    }
    const { error } =
      formEntidade === 'nova'
        ? await supabase.from('entidades_grupo').insert(registo)
        : await supabase.from('entidades_grupo').update(registo).eq('id', formEntidade)
    setOcupado(false)
    if (error) return mostrarAviso(`Erro ao guardar: ${error.message}`)
    setFormEntidade(null)
    setEntidade(ENTIDADE_VAZIA)
    carregarBase()
    mostrarAviso('Entidade guardada ✓')
  }

  async function guardarColaborador(ev) {
    ev.preventDefault()
    const nif = colab.nif.replace(/\D/g, '')
    if (!colab.nome.trim()) return mostrarAviso('O colaborador precisa de nome.')
    if (nif && !nifValido(nif)) return mostrarAviso('NIF inválido (dígito de controlo errado).')
    // O mesmo travão existe como CHECK na base de dados. Aqui é só para o
    // aviso chegar antes do erro de SQL.
    if (!fundamentoValido(colab.vinculo, colab.vinculo_fundamento)) {
      return mostrarAviso(
        `${VINCULOS[colab.vinculo].rotulo} exige fundamento escrito — pelo menos uma frase que diga porquê.`,
      )
    }
    if (colab.data_fim && colab.data_inicio && colab.data_fim < colab.data_inicio) {
      return mostrarAviso('A data de fim é anterior à de início.')
    }
    setOcupado(true)
    const registo = {
      nome: colab.nome.trim(),
      nif: nif || null,
      email: colab.email.trim() || null,
      telefone: colab.telefone.trim() || null,
      perfil_id: colab.perfil_id || null,
      estafeta_id: colab.estafeta_id || null,
      inicio_atividade: colab.inicio_atividade || null,
      funcao: colab.funcao.trim() || null,
      vinculo: colab.vinculo || null,
      vinculo_fundamento: colab.vinculo_fundamento.trim() || null,
      estado: colab.estado,
      data_inicio: colab.data_inicio || null,
      data_fim: colab.data_fim || null,
      isento_art_53: !!colab.isento_art_53,
      isento_ss_art157: !!colab.isento_ss_art157,
      isencao_ss_fundamento: colab.isencao_ss_fundamento.trim() || null,
      taxa_retencao_irs: Number(colab.taxa_retencao_irs) || 0,
      notas: colab.notas.trim() || null,
    }
    const { error } =
      formColab === 'novo'
        ? await supabase.from('colaboradores').insert(registo)
        : await supabase.from('colaboradores').update(registo).eq('id', formColab)
    setOcupado(false)
    if (error) return mostrarAviso(`Erro ao guardar: ${error.message}`)
    setFormColab(null)
    setColab(COLAB_VAZIO)
    carregarBase()
    mostrarAviso('Colaborador guardado ✓')
  }

  async function guardarRendimento(colaboradorId, valor, origem) {
    const total = Number(valor)
    if (!Number.isFinite(total) || total < 0) return mostrarAviso('Valor inválido.')
    const { error } = await supabase.from('colaborador_rendimento_anual').upsert(
      {
        colaborador_id: colaboradorId,
        ano,
        total_declarado: total,
        origem,
        declarado_em: hojeIso(),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'colaborador_id,ano' },
    )
    if (error) return mostrarAviso(`Erro ao guardar: ${error.message}`)
    registarAuditoria('rendimento_declarado', { colaborador_id: colaboradorId, ano, total, origem })
    carregarAno()
    mostrarAviso('Declaração registada ✓')
  }

  async function guardarPagamento(ev) {
    ev.preventDefault()
    if (!pagamento.colaborador_id || !pagamento.entidade_id) {
      return mostrarAviso('Escolhe o colaborador e a entidade.')
    }
    if (pagamento.descricao.trim().length < 10) {
      return mostrarAviso('Descreve o serviço prestado a esta entidade (10 caracteres, no mínimo).')
    }
    const acimaDoTeto = !!simulacao?.passaTeto
    if (acimaDoTeto && pagamento.justificacao.trim().length < 10) {
      return mostrarAviso('Acima do teto: escreve a justificação antes de gravar.')
    }
    if (pagamento.estado === 'pago' && !pagamento.pago_em) {
      return mostrarAviso('Um pagamento em estado "pago" tem de ter data.')
    }
    setOcupado(true)
    const { data: sessao } = await supabase.auth.getSession()
    const { error } = await supabase.from('colaborador_pagamentos').insert({
      colaborador_id: pagamento.colaborador_id,
      entidade_id: pagamento.entidade_id,
      data_recibo: pagamento.data_recibo,
      valor_base: Number(pagamento.valor_base),
      iva: Number(pagamento.iva) || 0,
      retencao_irs: Number(pagamento.retencao_irs) || 0,
      numero_recibo: pagamento.numero_recibo.trim() || null,
      descricao: pagamento.descricao.trim(),
      estado: pagamento.estado,
      pago_em: pagamento.pago_em || null,
      acima_do_teto: acimaDoTeto,
      justificacao: acimaDoTeto ? pagamento.justificacao.trim() : null,
      criado_por: sessao?.session?.user?.id || null,
    })
    setOcupado(false)
    if (error) return mostrarAviso(`Erro ao gravar: ${error.message}`)
    if (acimaDoTeto) {
      registarAuditoria('pagamento_acima_do_teto', {
        colaborador_id: pagamento.colaborador_id,
        entidade_id: pagamento.entidade_id,
        valor: Number(pagamento.valor_base),
        fracao_depois: simulacao.fracaoDepois,
        justificacao: pagamento.justificacao.trim(),
      })
    }
    setFormPagamento(false)
    setPagamento({ ...PAGAMENTO_VAZIO, data_recibo: hojeIso() })
    carregarAno()
    mostrarAviso(acimaDoTeto ? 'Gravado, acima do teto e justificado ⚠' : 'Pagamento gravado ✓')
  }

  async function apagarPagamento(p) {
    if (!window.confirm('Apagar este pagamento? O histórico de auditoria fica.')) return
    const { error } = await supabase.from('colaborador_pagamentos').delete().eq('id', p.id)
    if (error) return mostrarAviso('Erro ao apagar.')
    registarAuditoria('pagamento_apagado', { id: p.id, valor: p.valor_base })
    carregarAno()
    mostrarAviso('Pagamento apagado ✓')
  }

  // ── Ecrã ────────────────────────────────────────────────────────────────
  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        As tabelas de colaboradores ainda não existem. Aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">
          docs/sql/2026-08-21-colaboradores-recibos-verdes.sql
        </code>
        no SQL Editor do Supabase.
      </p>
    )
  }

  const semEntidades = entidadesAtivas.length === 0

  return (
    <div className="space-y-10">
      {/* ── Ano ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAno((a) => a - 1)} className={BOTAO_SECUNDARIO}>
            ←
          </button>
          <span className="font-display text-2xl font-bold text-grafite-900">{ano}</span>
          <button
            type="button"
            onClick={() => setAno((a) => a + 1)}
            disabled={ano >= anoAtual()}
            className={`${BOTAO_SECUNDARIO} disabled:opacity-30`}
          >
            →
          </button>
          <span className="ml-2 text-xs text-grafite-600/70">
            ano civil do recibo — é este que a Segurança Social apura
          </span>
        </div>
        <button
          type="button"
          disabled={semEntidades || !colabs?.length}
          onClick={() => {
            setPagamento({ ...PAGAMENTO_VAZIO, data_recibo: hojeIso() })
            setFormPagamento(true)
          }}
          className={`${BOTAO_PRIMARIO} disabled:opacity-40`}
        >
          + Registar pagamento
        </button>
      </div>

      {/* ── Formulário de pagamento, com travão ── */}
      {formPagamento && (
        <form onSubmit={guardarPagamento} className={`${CARTAO} grid gap-4 p-6 sm:grid-cols-2`}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Colaborador
            </span>
            <select
              value={pagamento.colaborador_id}
              onChange={(e) => setPagamento((p) => ({ ...p, colaborador_id: e.target.value }))}
              className={CAMPO}
              required
            >
              <option value="">—</option>
              {(colabs || [])
                .filter((c) => (c.estado || 'activo') !== 'inactivo')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Entidade que recebeu o serviço
            </span>
            <select
              value={pagamento.entidade_id}
              onChange={(e) => setPagamento((p) => ({ ...p, entidade_id: e.target.value }))}
              className={CAMPO}
              required
            >
              <option value="">—</option>
              {entidadesAtivas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} · {e.nipc}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Data do recibo
            </span>
            <input
              type="date"
              value={pagamento.data_recibo}
              onChange={(e) => setPagamento((p) => ({ ...p, data_recibo: e.target.value }))}
              className={CAMPO}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Valor base (€)
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={pagamento.valor_base}
              onChange={(e) => setPagamento((p) => ({ ...p, valor_base: e.target.value }))}
              className={CAMPO}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              IVA (€)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pagamento.iva}
              onChange={(e) => setPagamento((p) => ({ ...p, iva: e.target.value }))}
              className={CAMPO}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Retenção de IRS (€)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pagamento.retencao_irs}
              onChange={(e) => setPagamento((p) => ({ ...p, retencao_irs: e.target.value }))}
              className={CAMPO}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Serviço prestado a esta entidade
            </span>
            <input
              value={pagamento.descricao}
              onChange={(e) => setPagamento((p) => ({ ...p, descricao: e.target.value }))}
              className={CAMPO}
              placeholder="ex.: 14 turnos de cozinha no serviço de almoços, agosto"
              required
            />
            <span className="mt-1 block text-xs text-grafite-600/70">
              É esta linha que liga o pagamento a trabalho real. Se não a
              conseguires escrever, a fatura está na entidade errada.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Nº do recibo
            </span>
            <input
              value={pagamento.numero_recibo}
              onChange={(e) => setPagamento((p) => ({ ...p, numero_recibo: e.target.value }))}
              className={CAMPO}
              placeholder="opcional, para conferir"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
              Estado
            </span>
            <select
              value={pagamento.estado}
              onChange={(e) => setPagamento((p) => ({ ...p, estado: e.target.value }))}
              className={CAMPO}
            >
              <option value="previsto">Previsto</option>
              <option value="recibo_recebido">Recibo recebido</option>
              <option value="pago">Pago</option>
            </select>
          </label>

          {pagamento.estado === 'pago' && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Pago em
              </span>
              <input
                type="date"
                value={pagamento.pago_em}
                onChange={(e) => setPagamento((p) => ({ ...p, pago_em: e.target.value }))}
                className={CAMPO}
                required
              />
            </label>
          )}

          {/* Travão: a simulação corre a cada tecla, não no submit */}
          {simulacao && (
            <div className="sm:col-span-2">
              {simulacao.semDeclaracao ? (
                <p className="rounded-lg border border-creme-300 bg-creme-100 p-4 text-sm text-grafite-600">
                  Sem declaração de rendimento para {ano}: não é possível saber
                  a fração. O pagamento pode ser gravado, mas ficas sem
                  semáforo — pede a declaração ao colaborador.
                </p>
              ) : simulacao.foraDeAmbito ? (
                <p className="rounded-lg border border-grafite-400/30 bg-grafite-100 p-4 text-sm text-grafite-700">
                  {simulacao.explicacaoForaDeAmbito} A fração continua a ser
                  calculada ({pct(simulacao.fracaoDepois)}), mas não há
                  contribuição de entidade contratante a pagar.
                </p>
              ) : simulacao.passaTeto ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
                  <p className="font-semibold text-red-600">
                    Este pagamento passa o teto em {simulacao.unidadeNome}:{' '}
                    {pct(simulacao.fracaoDepois)} do rendimento anual declarado.
                  </p>
                  <p className="mt-1 text-sm text-red-600/90">
                    Acima dos {pct(limiares.limiar_dependencia)} passa a haver
                    entidade contratante, com contribuição própria à Segurança
                    Social — cerca de {fmt(simulacao.custoDepois)} no ano.
                    Ultrapassa o teto em {fmt(Math.abs(simulacao.margemDepois))}.
                  </p>
                  {simulacao.consolidada && (
                    <p className="mt-1 text-xs text-red-600/80">
                      A conta é do agrupamento inteiro, não de{' '}
                      {simulacao.entidadeNome}: lançar noutra entidade do grupo
                      não altera este número.
                    </p>
                  )}
                  <label className="mt-3 block">
                    <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
                      Justificação (fica gravada com o pagamento)
                    </span>
                    <textarea
                      rows={2}
                      value={pagamento.justificacao}
                      onChange={(e) =>
                        setPagamento((p) => ({ ...p, justificacao: e.target.value }))
                      }
                      className={CAMPO}
                      placeholder="ex.: o colaborador declarou 18.400 € a 12/08, declaração nova por registar"
                    />
                  </label>
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                  Depois deste pagamento: {pct(simulacao.fracaoDepois)} em{' '}
                  {simulacao.unidadeNome}. Continuam disponíveis{' '}
                  <strong>{fmt(simulacao.margemDepois)}</strong> até ao teto.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => setFormPagamento(false)}
              className={BOTAO_SECUNDARIO}
            >
              Cancelar
            </button>
            <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
              {ocupado ? 'A gravar…' : simulacao?.passaTeto ? 'Gravar mesmo assim' : 'Gravar'}
            </button>
          </div>
        </form>
      )}

      {/* ── Panorama por colaborador ── */}
      <section>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Dependência económica em {ano}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-grafite-600/70">
          O que cada entidade pagou é exato. O rendimento total é declarado
          pelo colaborador — a fração vale o que valer essa declaração.
        </p>

        {porColaborador.length > paraApuramento.length && (
          <p className="mt-2 text-xs text-grafite-600/70">
            {porColaborador.length - paraApuramento.length} de{' '}
            {porColaborador.length} não aparecem aqui por terem contrato de
            trabalho — nesses não há entidade contratante a apurar.
          </p>
        )}

        {colabs === null ? (
          <p className="mt-3 text-sm text-grafite-600/70">A carregar…</p>
        ) : paraApuramento.length === 0 ? (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            {porColaborador.length === 0
              ? 'Ainda não há colaboradores registados.'
              : 'Nenhum colaborador em prestação de serviços. Não há dependência económica a vigiar.'}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {paraApuramento.map((x) => (
              <FichaColaborador
                key={x.colaborador.id}
                dados={x}
                ano={ano}
                aoDeclarar={guardarRendimento}
                aoApagarPagamento={apagarPagamento}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Candidaturas ── */}
      <Candidaturas />

      {/* ── Colaboradores ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Colaboradores
          </h3>
          <button
            type="button"
            onClick={() => {
              setFormColab('novo')
              setColab(COLAB_VAZIO)
            }}
            className={BOTAO_PRIMARIO}
          >
            Novo colaborador
          </button>
        </div>

        {/* Contadores. Poucos e accionáveis — um painel cheio de números que
            ninguém usa é ruído a fingir de informação. */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador rotulo="Activos" valor={contadores.activos} />
          <Contador rotulo="Prestadores de serviços" valor={contadores.prestadores} />
          <Contador
            rotulo="Sem vínculo definido"
            valor={contadores.semVinculo}
            alerta={contadores.semVinculo > 0}
          />
          <Contador
            rotulo={`Contribuição estimada ${ano}`}
            valor={fmt(contadores.custoAno)}
            alerta={contadores.custoAno > 0}
          />
        </div>

        {/* Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
            Estado
          </span>
          <Chip activo={filtroEstado === ''} aoClicar={() => setFiltroEstado('')}>
            todos ({contadores.total})
          </Chip>
          {Object.entries(ESTADOS).map(([k, r]) => (
            <Chip key={k} activo={filtroEstado === k} aoClicar={() => setFiltroEstado(k)}>
              {r.toLowerCase()}
            </Chip>
          ))}
          <span className="ml-3 text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
            Vínculo
          </span>
          <Chip activo={filtroVinculo === ''} aoClicar={() => setFiltroVinculo('')}>
            todos
          </Chip>
          <Chip activo={filtroVinculo === '__sem__'} aoClicar={() => setFiltroVinculo('__sem__')}>
            por definir
          </Chip>
          {Object.entries(VINCULOS).map(([k, v]) => (
            <Chip key={k} activo={filtroVinculo === k} aoClicar={() => setFiltroVinculo(k)}>
              {v.curto.toLowerCase()}
            </Chip>
          ))}
        </div>

        {formColab && (
          <form onSubmit={guardarColaborador} className={`${CARTAO} mt-3 grid gap-4 p-5 sm:grid-cols-2`}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Nome</span>
              <input
                value={colab.nome}
                onChange={(e) => setColab((c) => ({ ...c, nome: e.target.value }))}
                className={CAMPO}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">NIF</span>
              <input
                value={colab.nif}
                onChange={(e) =>
                  setColab((c) => ({ ...c, nif: e.target.value.replace(/\D/g, '').slice(0, 9) }))
                }
                inputMode="numeric"
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Email</span>
              <input
                value={colab.email}
                onChange={(e) => setColab((c) => ({ ...c, email: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Telemóvel
              </span>
              <input
                value={colab.telefone}
                onChange={(e) =>
                  setColab((c) => ({ ...c, telefone: e.target.value.replace(/\D/g, '').slice(0, 9) }))
                }
                inputMode="numeric"
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Conta de login (opcional)
              </span>
              <select
                value={colab.perfil_id}
                onChange={(e) => setColab((c) => ({ ...c, perfil_id: e.target.value }))}
                className={CAMPO}
              >
                <option value="">—</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                É também estafeta?
              </span>
              <select
                value={colab.estafeta_id}
                onChange={(e) => setColab((c) => ({ ...c, estafeta_id: e.target.value }))}
                className={CAMPO}
              >
                <option value="">Não</option>
                {estafetas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-grafite-600/70">
                Sem esta ligação, o que ganha a entregar fica fora da fração.
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Início de atividade
              </span>
              <input
                type="date"
                value={colab.inicio_atividade}
                onChange={(e) => setColab((c) => ({ ...c, inicio_atividade: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Retenção de IRS (%)
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={colab.taxa_retencao_irs}
                onChange={(e) => setColab((c) => ({ ...c, taxa_retencao_irs: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Função
              </span>
              <input
                value={colab.funcao}
                onChange={(e) => setColab((c) => ({ ...c, funcao: e.target.value }))}
                className={CAMPO}
                placeholder="ex.: cozinha, balcão, contabilidade"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Estado
              </span>
              <select
                value={colab.estado}
                onChange={(e) => setColab((c) => ({ ...c, estado: e.target.value }))}
                className={CAMPO}
              >
                {Object.entries(ESTADOS).map(([k, r]) => (
                  <option key={k} value={k}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Vínculo
              </span>
              <select
                value={colab.vinculo}
                onChange={(e) => setColab((c) => ({ ...c, vinculo: e.target.value }))}
                className={CAMPO}
              >
                <option value="">Por definir</option>
                {Object.entries(VINCULOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.rotulo}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-grafite-600/70">
                Só a prestação de serviços entra no apuramento de dependência
                económica. Quem tem contrato de trabalho já desconta TSU e não
                aparece nesse painel.
              </span>
            </label>
            {vinculoExigeFundamento(colab.vinculo) && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                  Fundamento do vínculo (obrigatório)
                </span>
                <textarea
                  rows={2}
                  value={colab.vinculo_fundamento}
                  onChange={(e) => setColab((c) => ({ ...c, vinculo_fundamento: e.target.value }))}
                  className={CAMPO}
                  placeholder="ex.: início de laboração do estabelecimento, art. 140.º/2/b do Código do Trabalho"
                />
                <span className="mt-1 block text-xs text-grafite-600/70">
                  Um contrato a termo sem fundamento escrito converte-se em
                  contrato sem termo. Uma prestação de serviços sem justificação
                  é o primeiro ponto que a ACT levanta. Escreve-se aqui, hoje,
                  enquanto a razão ainda está fresca.
                </span>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Início
              </span>
              <input
                type="date"
                value={colab.data_inicio}
                onChange={(e) => setColab((c) => ({ ...c, data_inicio: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Fim
              </span>
              <input
                type="date"
                value={colab.data_fim}
                onChange={(e) => setColab((c) => ({ ...c, data_fim: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Notas</span>
              <input
                value={colab.notas}
                onChange={(e) => setColab((c) => ({ ...c, notas: e.target.value }))}
                className={CAMPO}
              />
            </label>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-grafite-700">
                <input
                  type="checkbox"
                  checked={colab.isento_art_53}
                  onChange={(e) => setColab((c) => ({ ...c, isento_art_53: e.target.checked }))}
                  className="h-4 w-4 accent-ambar-500"
                />
                Isento de IVA (art. 53.º do CIVA)
              </label>
              <label className="flex items-center gap-2 text-sm text-grafite-700">
                <input
                  type="checkbox"
                  checked={colab.isento_ss_art157}
                  onChange={(e) =>
                    setColab((c) => ({ ...c, isento_ss_art157: e.target.checked }))
                  }
                  className="h-4 w-4 accent-ambar-500"
                />
                Isento de contribuir (art. 157.º CRC)
              </label>
            </div>
            {colab.isento_ss_art157 && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                  Fundamento da isenção (obrigatório)
                </span>
                <input
                  value={colab.isencao_ss_fundamento}
                  onChange={(e) =>
                    setColab((c) => ({ ...c, isencao_ss_fundamento: e.target.value }))
                  }
                  className={CAMPO}
                  placeholder="ex.: pensionista, declaração da Segurança Social de 12/03/2026"
                />
                <span className="mt-1 block text-xs text-grafite-600/70">
                  Isto desliga a contribuição de entidade contratante. Nada que
                  desligue um cálculo fica sem justificação escrita — e o art.
                  157.º do Código Contributivo não tem nada a ver com o art.
                  53.º do CIVA.
                </span>
              </label>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setFormColab(null)} className={BOTAO_SECUNDARIO}>
                Cancelar
              </button>
              <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
                Guardar
              </button>
            </div>
          </form>
        )}

        {colabsFiltrados.length === 0 && (colabs || []).length > 0 && (
          <p className="mt-3 text-sm text-grafite-600/70">
            Nenhum colaborador com este filtro.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {colabsFiltrados.map((c) => (
            <li key={c.id} className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 p-4`}>
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-grafite-900">
                  {c.nome}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${
                      CORES_ESTADO[c.estado || 'activo']
                    }`}
                  >
                    {ESTADOS[c.estado || 'activo']}
                  </span>
                  {c.vinculo ? (
                    <span className="rounded-full border border-creme-300 bg-creme-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-grafite-600">
                      {VINCULOS[c.vinculo].curto}
                    </span>
                  ) : (
                    c.estado !== 'inactivo' && (
                      <span className="rounded-full border border-ambar-500/40 bg-ambar-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-ambar-700">
                        vínculo por definir
                      </span>
                    )
                  )}
                </p>
                <p className="text-xs text-grafite-600/70">
                  {[
                    c.funcao,
                    c.nif && `NIF ${c.nif}`,
                    c.isento_art_53 && 'art. 53.º',
                    c.isento_ss_art157 && 'isento art. 157.º',
                    c.estafeta_id && 'também estafeta',
                    c.email,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormColab(c.id)
                  setColab({
                    nome: c.nome || '',
                    nif: c.nif || '',
                    email: c.email || '',
                    telefone: c.telefone || '',
                    perfil_id: c.perfil_id || '',
                    estafeta_id: c.estafeta_id || '',
                    inicio_atividade: c.inicio_atividade || '',
                    funcao: c.funcao || '',
                    vinculo: c.vinculo || '',
                    vinculo_fundamento: c.vinculo_fundamento || '',
                    estado: c.estado || 'activo',
                    data_inicio: c.data_inicio || '',
                    data_fim: c.data_fim || '',
                    isento_art_53: !!c.isento_art_53,
                    isento_ss_art157: !!c.isento_ss_art157,
                    isencao_ss_fundamento: c.isencao_ss_fundamento || '',
                    taxa_retencao_irs: c.taxa_retencao_irs ?? 0,
                    notas: c.notas || '',
                  })
                }}
                className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-cobre-600 hover:underline"
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Entidades do grupo ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Entidades do grupo
          </h3>
          <button
            type="button"
            onClick={() => {
              setFormEntidade('nova')
              setEntidade(ENTIDADE_VAZIA)
            }}
            className={BOTAO_PRIMARIO}
          >
            Nova entidade
          </button>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-grafite-600/70">
          Cada entidade tem NIPC próprio e uma atividade. A atividade não é
          decorativa: é contra ela que se confere se o serviço descrito num
          pagamento faz sentido nessa entidade.
        </p>

        {formEntidade && (
          <form onSubmit={guardarEntidade} className={`${CARTAO} mt-3 grid gap-4 p-5 sm:grid-cols-2`}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Nome</span>
              <input
                value={entidade.nome}
                onChange={(e) => setEntidade((x) => ({ ...x, nome: e.target.value }))}
                className={CAMPO}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">NIPC</span>
              <input
                value={entidade.nipc}
                onChange={(e) =>
                  setEntidade((x) => ({ ...x, nipc: e.target.value.replace(/\D/g, '').slice(0, 9) }))
                }
                inputMode="numeric"
                className={CAMPO}
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Atividade
              </span>
              <input
                value={entidade.atividade}
                onChange={(e) => setEntidade((x) => ({ ...x, atividade: e.target.value }))}
                className={CAMPO}
                placeholder="ex.: catering e eventos"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Agrupamento empresarial
              </span>
              <input
                value={entidade.agrupamento}
                onChange={(e) => setEntidade((x) => ({ ...x, agrupamento: e.target.value }))}
                className={CAMPO}
                placeholder="ex.: shemot"
              />
              <span className="mt-1 block text-xs text-grafite-600/70">
                Entidades com o mesmo agrupamento contam como UMA entidade
                contratante perante a Segurança Social. Deixar vazio só se esta
                entidade não estiver em relação de domínio com as outras.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-grafite-700">
                <input
                  type="checkbox"
                  checked={entidade.principal}
                  onChange={(e) => setEntidade((x) => ({ ...x, principal: e.target.checked }))}
                  className="h-4 w-4 accent-ambar-500"
                />
                Opera o restaurante
              </label>
              <label className="flex items-center gap-2 text-sm text-grafite-700">
                <input
                  type="checkbox"
                  checked={entidade.ativo}
                  onChange={(e) => setEntidade((x) => ({ ...x, ativo: e.target.checked }))}
                  className="h-4 w-4 accent-ambar-500"
                />
                Ativa
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setFormEntidade(null)} className={BOTAO_SECUNDARIO}>
                Cancelar
              </button>
              <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
                Guardar
              </button>
            </div>
          </form>
        )}

        {semEntidades && !formEntidade && (
          <p className={`${CARTAO} mt-3 p-6 text-grafite-600`}>
            Ainda não há entidades. Sem pelo menos uma não é possível registar
            pagamentos.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {entidades.map((e) => (
            <li key={e.id} className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 p-4`}>
              <div>
                <p className="font-semibold text-grafite-900">
                  {e.nome}
                  {e.principal && (
                    <span className="ml-2 rounded-full bg-ambar-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-ambar-600">
                      restaurante
                    </span>
                  )}
                  {!e.ativo && (
                    <span className="ml-2 text-xs uppercase tracking-widest text-grafite-600/60">
                      inativa
                    </span>
                  )}
                </p>
                <p className="text-xs text-grafite-600/70">
                  NIPC {e.nipc}
                  {e.atividade ? ` · ${e.atividade}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormEntidade(e.id)
                  setEntidade({
                    nome: e.nome || '',
                    nipc: e.nipc || '',
                    atividade: e.atividade || '',
                    agrupamento: e.agrupamento || '',
                    principal: !!e.principal,
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
      </section>

      {Aviso}
    </div>
  )
}

// ── Ficha de um colaborador no ano ────────────────────────────────────────
function FichaColaborador({ dados, ano, aoDeclarar, aoApagarPagamento }) {
  const { colaborador, rendimento, linhas, totalGrupo, fracaoGrupo, nivelGrupo, mecanica } =
    dados
  const [aDeclarar, setADeclarar] = useState(false)
  const [valor, setValor] = useState(rendimento?.total_declarado ?? '')
  const [origem, setOrigem] = useState(rendimento?.origem ?? 'declaracao')
  const [aberto, setAberto] = useState(false)

  return (
    <div className={`${CARTAO} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold uppercase text-grafite-900">
            {colaborador.nome}
            {colaborador.nif && (
              <span className="ml-2 text-sm font-normal text-grafite-600/70">
                NIF {colaborador.nif}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-grafite-600/70">
            {dados.pagamentos.length}{' '}
            {dados.pagamentos.length === 1 ? 'pagamento' : 'pagamentos'} em {ano} ·{' '}
            {fmt(totalGrupo)} no total do grupo
          </p>
        </div>
        <div className="text-right">
          <Etiqueta nivel={nivelGrupo} />
          <p className="mt-1 font-display text-xl font-bold text-grafite-900">
            {pct(fracaoGrupo)}
          </p>
          <p className="text-[0.65rem] uppercase tracking-widest text-grafite-600/60">
            grupo consolidado
          </p>
        </div>
      </div>

      {/* Denominador */}
      <div className="mt-4 rounded-lg border border-creme-300 bg-creme-100/60 p-4">
        {rendimento ? (
          <p className="text-sm text-grafite-700">
            Rendimento total declarado em {ano}:{' '}
            <strong>{fmt(rendimento.total_declarado)}</strong>{' '}
            <span className="text-grafite-600/70">
              ({rendimento.origem === 'estimativa' ? 'estimativa nossa' : 'declarado por ele'}, a{' '}
              {new Date(rendimento.declarado_em).toLocaleDateString('pt-PT')})
            </span>
            {dados.desatualizada && (
              <span className="ml-2 rounded-full bg-ambar-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-ambar-700">
                a pedir de novo
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-grafite-700">
            Sem declaração de rendimento para {ano}. Sem ela não há fração — só
            se sabe o que o grupo pagou, que é metade da conta.
          </p>
        )}

        {aDeclarar ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Total do ano (€)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`${CAMPO} w-40`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
                Origem
              </span>
              <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={CAMPO}>
                <option value="declaracao">Declarado pelo colaborador</option>
                <option value="estimativa">Estimativa nossa</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                aoDeclarar(colaborador.id, valor, origem)
                setADeclarar(false)
              }}
              className={BOTAO_PRIMARIO}
            >
              Registar
            </button>
            <button type="button" onClick={() => setADeclarar(false)} className={BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setADeclarar(true)} className={`${BOTAO_SECUNDARIO} mt-3`}>
            {rendimento ? 'Atualizar declaração' : 'Registar declaração'}
          </button>
        )}
      </div>

      {/* Fora de âmbito */}
      {dados.foraDeAmbito && (
        <p className="mt-4 rounded-lg border border-grafite-400/30 bg-grafite-100 p-4 text-sm text-grafite-700">
          {dados.explicacaoForaDeAmbito}
        </p>
      )}

      {/* Apuramento: é aqui que a Segurança Social olha */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
          Entidades contratantes apuradas
        </p>
        {dados.contratantes.map((u) => (
          <div
            key={u.chave}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cobre-600/30 bg-cobre-600/5 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-grafite-900">
                {u.nome}
                {u.entidades.length > 1 && (
                  <span className="ml-2 text-xs font-normal text-grafite-600/70">
                    {u.entidades.map((e) => e.nome).join(' + ')}
                  </span>
                )}
              </p>
              <p className="text-xs text-grafite-600/70">
                {fmt(u.pago)} pagos
                {u.margem != null && (
                  <>
                    {' · '}
                    {u.margem >= 0 ? (
                      <>ainda cabem <strong className="text-emerald-700">{fmt(u.margem)}</strong></>
                    ) : (
                      <>excede o teto em <strong className="text-red-600">{fmt(-u.margem)}</strong></>
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {u.custoContratante > 0 && (
                <span className="text-xs font-semibold text-red-600">
                  +{fmt(u.custoContratante)} de contribuição ({pct(u.taxa)})
                </span>
              )}
              <span className="font-display text-base font-bold text-grafite-900">
                {pct(u.fracao)}
              </span>
              <Etiqueta nivel={u.nivel} />
            </div>
          </div>
        ))}
        {dados.custoTotal > 0 && (
          <p className="text-right text-sm font-semibold text-red-600">
            Contribuição estimada no ano: {fmt(dados.custoTotal)}
          </p>
        )}
      </div>

      {/* Teto do art. 53.º do CIVA — problema dele, conversa nossa */}
      {dados.art53 && (
        <p
          className={`mt-3 rounded-lg border p-3 text-xs ${
            dados.art53.estado === 'dentro'
              ? 'border-creme-300 bg-creme-100/60 text-grafite-700'
              : 'border-ambar-500/40 bg-ambar-500/10 text-ambar-800'
          }`}
        >
          {dados.art53.estado === 'dentro' ? (
            <>
              Está no regime de isenção de IVA. Faturou {fmt(dados.art53.faturado)} dos{' '}
              {fmt(dados.art53.limite)} do teto do art. 53.º — margem de{' '}
              <strong>{fmt(dados.art53.margem)}</strong>, e o grupo já ocupa{' '}
              {pct(dados.art53.pesoDoGrupo)} desse teto. Se o empurrarmos para
              lá, passa a faturar-nos com IVA.
            </>
          ) : dados.art53.estado === 'sai_em_janeiro' ? (
            <>
              Passou o teto do art. 53.º ({fmt(dados.art53.faturado)} contra{' '}
              {fmt(dados.art53.limite)}). Sai do regime de isenção a 1 de
              janeiro, com comunicação à AT nos primeiros 15 dias úteis.
            </>
          ) : (
            <>
              Passou a tolerância do art. 53.º ({fmt(dados.art53.faturado)}{' '}
              contra {fmt(dados.art53.tolerancia)}). A saída do regime é
              imediata — as próximas faturas já levam IVA.
            </>
          )}
        </p>
      )}

      {dados.ivaIncoerente && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600">
          Há recibos com IVA lançado para um colaborador marcado como isento
          pelo art. 53.º. Um dos dois está errado.
        </p>
      )}

      {/* Por entidade — informativo: quanto cada uma pagou, não o que deve */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-grafite-600/60">
        Repartição por entidade
      </p>
      <ul className="mt-2 space-y-2">
        {linhas.map((l) => (
          <li
            key={l.entidade.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-creme-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-grafite-900">{l.entidade.nome}</p>
              <p className="text-xs text-grafite-600/70">{fmt(l.pago)} pagos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-bold text-grafite-900">
                {pct(l.fracao)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Reconciliação com o apuramento de estafetas */}
      {dados.porEstafeta > 0 && (
        <p className="mt-3 rounded-lg border border-cobre-600/30 bg-cobre-600/5 p-3 text-xs text-grafite-700">
          Além disto, {fmt(dados.porEstafeta)} apurados como estafeta em {ano}{' '}
          (<code className="rounded bg-creme-100 px-1">orders.estafeta_taxa</code>). Se já
          foram faturados, devem estar lançados acima; se não estão, a fração
          real é maior do que a que este ecrã mostra.
        </p>
      )}

      {mecanica && (
        <p className="mt-3 rounded-lg border border-ambar-500/40 bg-ambar-500/10 p-3 text-xs text-ambar-800">
          As entidades receberam valores praticamente iguais ao longo do ano.
          Numa distribuição por trabalho real isso é invulgar, e é o primeiro
          sítio onde alguém a conferir o apuramento iria olhar. Vale a pena
          teres a explicação pronta — ou confirmares que os serviços estão
          atribuídos à entidade certa.
        </p>
      )}

      {/* Detalhe */}
      {dados.pagamentos.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="mt-3 cursor-pointer text-xs font-semibold uppercase tracking-widest text-cobre-600 hover:underline"
          >
            {aberto ? 'Esconder pagamentos' : `Ver os ${dados.pagamentos.length} pagamentos`}
          </button>
          {aberto && (
            <ul className="mt-2 divide-y divide-creme-200 text-sm">
              {dados.pagamentos.map((p) => {
                const ent = linhas.find((l) => l.entidade.id === p.entidade_id)?.entidade
                return (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span className="text-grafite-900">
                      {new Date(p.data_recibo).toLocaleDateString('pt-PT')} ·{' '}
                      {ent?.nome || 'entidade removida'}
                      <span className="ml-2 text-xs text-grafite-600/70">{p.descricao}</span>
                      {p.acima_do_teto && (
                        <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-red-600">
                          acima do teto
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-grafite-900">{fmt(p.valor_base)}</span>
                      <button
                        type="button"
                        onClick={() => aoApagarPagamento(p)}
                        className={BOTAO_PERIGO}
                      >
                        Apagar
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default Colaboradores
