// Módulo Financeiro: controlo de gestão de gastos e receitas.
//
// Não faz faturação — isso é da Vendus. Não faz contabilidade — isso é do
// Ricardo. Responde a uma pergunta só: quanto entrou, quanto saiu, e onde.
//
// A receita da app não se lança aqui: deriva de `orders` na vista
// v_receita_diaria. Pagamentos a colaboradores também não: vêm de
// colaborador_pagamentos. Lançar qualquer um deles à mão conta duas vezes.
import { useCallback, useEffect, useState } from 'react'
import { fmt } from '../../../lib/pedidos'
import {
  CANAIS_RECEITA_EXTERNA,
  METODOS_DESPESA,
  anularDespesa,
  execucaoOrcamento,
  guardarFornecedor,
  guardarOrcamento,
  guardarReceitaExterna,
  hojeISO,
  lancarDespesa,
  listarCategorias,
  listarDespesas,
  listarFornecedores,
  listarPendentes,
  listarReceitasExternas,
  mesISO,
  resultadoMensal,
  rotuloMes,
  sincronizar,
} from '../../../lib/financeiro'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, useAviso } from './comuns'

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'nova', rotulo: '+ Despesa' },
  { id: 'despesas', rotulo: 'Despesas' },
  { id: 'receita', rotulo: 'Receita externa' },
  { id: 'orcamento', rotulo: 'Orçamento' },
  { id: 'fornecedores', rotulo: 'Fornecedores' },
]

const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'

function Erro({ erro }) {
  if (!erro) return null
  const e404 = /404|does not exist|schema/i.test(erro)
  return (
    <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-700">
      {e404
        ? 'O schema "financeiro" não está exposto na API. Supabase → Settings → API → Exposed schemas → acrescentar financeiro.'
        : erro}
    </p>
  )
}

// ─────────────────────────── Nova despesa ───────────────────────────
// Desenhado para telemóvel, uma mão, em pé no mercado. Se demorar mais de
// 20 segundos não é usado, e sem dados o módulo não vale nada. Por isso só
// três coisas estão à vista: valor, categoria, foto.
function NovaDespesa({ categorias, fornecedores, aoAvisar, aoLancar }) {
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [foto, setFoto] = useState(null)
  const [detalhes, setDetalhes] = useState(false)
  const [data, setData] = useState(hojeISO)
  const [iva, setIva] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [metodo, setMetodo] = useState('cartao')
  const [arranque, setArranque] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)

  const numero = Number(String(valor).replace(',', '.'))
  const valido = numero > 0 && categoriaId

  async function guardar() {
    if (!valido || aGuardar) return
    setAGuardar(true)
    try {
      const { enviado } = await lancarDespesa({
        despesa: {
          data,
          valor: numero,
          iva: Number(String(iva).replace(',', '.')) || 0,
          categoria_id: categoriaId,
          fornecedor_id: fornecedorId || null,
          descricao: descricao || null,
          metodo_pagamento: metodo,
          arranque,
        },
        foto,
      })
      aoAvisar(enviado ? 'Despesa registada.' : 'Guardada. Sincroniza quando houver rede.')
      setValor('')
      setCategoriaId('')
      setFoto(null)
      setIva('')
      setDescricao('')
      aoLancar()
    } catch (e) {
      aoAvisar(e.message || 'Não foi possível guardar.')
    }
    setAGuardar(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <label className="block">
        <span className={ROTULO}>Valor</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className="mt-1.5 w-full rounded-xl border border-creme-300 bg-creme-100 px-4 py-5 text-center text-4xl font-semibold tabular-nums text-grafite-900 outline-none focus:border-ambar-500"
        />
      </label>

      <p className={`${ROTULO} mt-6`}>Categoria</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoriaId(c.id)}
            className={`cursor-pointer rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${
              categoriaId === c.id
                ? 'bg-grafite-900 text-creme-50'
                : 'border border-creme-300 bg-creme-100 text-grafite-600 hover:border-ambar-500'
            }`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label className={`${BOTAO_SECUNDARIO} inline-block`}>
          {foto ? '✓ Talão anexado' : '📷 Fotografar talão'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] || null)}
          />
        </label>
        {foto && (
          <button type="button" onClick={() => setFoto(null)} className="cursor-pointer text-xs text-grafite-600/70 underline">
            remover
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDetalhes((v) => !v)}
        className="mt-6 cursor-pointer text-xs font-semibold uppercase tracking-widest text-grafite-600/70"
      >
        {detalhes ? '− Detalhes' : '+ Detalhes'}
      </button>

      {detalhes && (
        <div className={`${CARTAO} mt-3 space-y-3 p-4`}>
          <label className="block">
            <span className={ROTULO}>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>IVA</span>
            <input type="text" inputMode="decimal" value={iva} onChange={(e) => setIva(e.target.value)} placeholder="0,00" className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Fornecedor</span>
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={CAMPO}>
              <option value="">—</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={ROTULO}>Descrição</span>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CAMPO} />
          </label>
          <label className="block">
            <span className={ROTULO}>Método</span>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={CAMPO}>
              {METODOS_DESPESA.map((m) => (
                <option key={m.id} value={m.id}>{m.rotulo}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={arranque} onChange={(e) => setArranque(e.target.checked)} />
            <span className="text-sm text-grafite-600">
              Investimento de arranque <span className="text-grafite-600/60">(não conta na operação)</span>
            </span>
          </label>
        </div>
      )}

      <button type="button" onClick={guardar} disabled={!valido || aGuardar} className={`${BOTAO_PRIMARIO} mt-6 w-full py-4 disabled:opacity-30`}>
        {aGuardar ? 'A guardar…' : 'Guardar despesa'}
      </button>
    </div>
  )
}

// ─────────────────────────── Resumo ───────────────────────────
function Resumo({ meses }) {
  if (!meses.length) return <p className="text-sm text-grafite-600/70">Ainda sem movimentos.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
            <th className="py-2 pr-4">Mês</th>
            <th className="py-2 pr-4 text-right">Receita líquida</th>
            <th className="py-2 pr-4 text-right">Despesa de operação</th>
            <th className="py-2 pr-4 text-right">Saldo de operação</th>
            <th className="py-2 text-right">Arranque</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes} className="border-b border-creme-300/60">
              <td className="py-2.5 pr-4 font-semibold text-grafite-900">{rotuloMes(m.mes)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(m.receita_liquida)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(m.despesa_operacao)}</td>
              <td className={`py-2.5 pr-4 text-right font-semibold tabular-nums ${Number(m.saldo_operacao) < 0 ? 'text-red-600' : 'text-grafite-900'}`}>
                {fmt(m.saldo_operacao)}
              </td>
              <td className="py-2.5 text-right tabular-nums text-grafite-600/70">{fmt(m.despesa_arranque)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-grafite-600/70">
        O saldo de operação exclui o investimento de arranque de propósito: senão nenhum mês parece
        saudável no primeiro ano. A receita já inclui a da app e a externa; a despesa já inclui os
        pagamentos a colaboradores.
      </p>
    </div>
  )
}

// ─────────────────────────── Lista de despesas ───────────────────────────
function ListaDespesas({ despesas, aoAvisar, aoMudar }) {
  async function anular(d) {
    const motivo = window.prompt(`Anular a despesa de ${fmt(d.valor)}? Indica o motivo:`)
    if (!motivo) return
    try {
      await anularDespesa(d.id, motivo)
      aoAvisar('Despesa anulada.')
      aoMudar()
    } catch (e) {
      aoAvisar(e.message || 'Não foi possível anular.')
    }
  }

  if (!despesas.length) return <p className="text-sm text-grafite-600/70">Sem despesas registadas.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Categoria</th>
            <th className="py-2 pr-4">Fornecedor</th>
            <th className="py-2 pr-4 text-right">Valor</th>
            <th className="py-2 pr-4 text-right">IVA</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {despesas.map((d) => (
            <tr key={d.id} className="border-b border-creme-300/60">
              <td className="py-2.5 pr-4 tabular-nums">{d.data}</td>
              <td className="py-2.5 pr-4">
                {d.categoria}
                {d.arranque && <span className="ml-2 rounded-full bg-creme-300 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-grafite-600">arranque</span>}
              </td>
              <td className="py-2.5 pr-4 text-grafite-600/70">{d.fornecedor || '—'}</td>
              <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{fmt(d.valor)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-grafite-600/70">{fmt(d.iva)}</td>
              <td className="py-2.5 text-right">
                <button type="button" onClick={() => anular(d)} className="cursor-pointer text-xs text-grafite-600/60 underline hover:text-red-600">
                  anular
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-grafite-600/70">
        Registos financeiros não se apagam: anulam-se, com motivo e autor. O histórico fica.
      </p>
    </div>
  )
}

// ─────────────────────────── Receita externa ───────────────────────────
function ReceitaExterna({ receitas, aoAvisar, aoMudar }) {
  const [data, setData] = useState(hojeISO)
  const [canal, setCanal] = useState('pos_externo')
  const [valor, setValor] = useState('')
  const [comissao, setComissao] = useState('')
  const [notas, setNotas] = useState('')
  const [aGuardar, setAGuardar] = useState(false)

  // "Outro" é uma entrada avulsa (ex.: aporte de sócio) — sem motivo escrito
  // ninguém sabe o que é daqui a três meses. Nos canais fixos o motivo é o
  // próprio canal, por isso o campo só aparece no "Outro".
  const eOutro = canal === 'outro'
  const numero = Number(String(valor).replace(',', '.'))
  const valido = numero > 0 && (!eOutro || notas.trim())

  async function guardar() {
    if (!valido || aGuardar) return
    setAGuardar(true)
    try {
      await guardarReceitaExterna({
        data,
        canal,
        valor: numero,
        comissao: Number(String(comissao).replace(',', '.')) || 0,
        notas: notas.trim() || null,
      })
      aoAvisar('Receita registada.')
      setValor('')
      setComissao('')
      setNotas('')
      aoMudar()
    } catch (e) {
      aoAvisar(e.message || 'Não foi possível guardar.')
    }
    setAGuardar(false)
  }

  return (
    <div>
      <p className="mb-4 text-sm text-grafite-600/70">
        Só receita que <strong>não</strong> passa pela app. A dos pedidos já vem de <code>orders</code> —
        lançar aqui contaria duas vezes.
      </p>
      <div className={`${CARTAO} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <label className="block">
          <span className={ROTULO}>Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Canal</span>
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={CAMPO}>
            {CANAIS_RECEITA_EXTERNA.map((c) => (
              <option key={c.id} value={c.id}>{c.rotulo}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO}>Valor</span>
          <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Comissão</span>
          <input type="text" inputMode="decimal" value={comissao} onChange={(e) => setComissao(e.target.value)} placeholder="0,00" className={CAMPO} />
        </label>
        {eOutro && (
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className={ROTULO}>Motivo</span>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ex.: Aporte financeiro do sócio Leandro"
              className={CAMPO}
            />
            <span className="mt-1.5 block text-xs text-grafite-600/60">
              Obrigatório no "Outro" — descreve o que é esta entrada.
            </span>
          </label>
        )}
      </div>
      <button type="button" onClick={guardar} disabled={!valido || aGuardar} className={`${BOTAO_PRIMARIO} mt-4 disabled:opacity-30`}>
        {aGuardar ? 'A guardar…' : 'Guardar'}
      </button>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Canal</th>
            <th className="py-2 pr-4 text-right">Valor</th>
            <th className="py-2 text-right">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {receitas.map((r) => (
            <tr key={r.id} className="border-b border-creme-300/60">
              <td className="py-2.5 pr-4 tabular-nums">{r.data}</td>
              <td className="py-2.5 pr-4">
                {CANAIS_RECEITA_EXTERNA.find((c) => c.id === r.canal)?.rotulo || r.canal}
                {r.notas && <span className="mt-0.5 block text-xs text-grafite-600/60">{r.notas}</span>}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmt(r.valor)}</td>
              <td className="py-2.5 text-right tabular-nums text-grafite-600/70">{fmt(r.comissao)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────── Orçamento ───────────────────────────
function Orcamento({ categorias, aoAvisar }) {
  const [mes, setMes] = useState(mesISO)
  const [linhas, setLinhas] = useState([])
  const [rascunho, setRascunho] = useState({})

  const carregar = useCallback(async () => {
    try {
      setLinhas(await execucaoOrcamento(mes))
    } catch (e) {
      aoAvisar(e.message || 'Erro ao carregar.')
    }
  }, [mes, aoAvisar])

  useEffect(() => { carregar() }, [carregar])

  async function definir(categoriaId) {
    const bruto = rascunho[categoriaId]
    if (!bruto) return
    try {
      await guardarOrcamento({
        categoria_id: categoriaId,
        mes,
        valor_previsto: Number(String(bruto).replace(',', '.')) || 0,
      })
      setRascunho((r) => ({ ...r, [categoriaId]: '' }))
      aoAvisar('Orçamento definido.')
      carregar()
    } catch (e) {
      aoAvisar(e.message || 'Não foi possível guardar.')
    }
  }

  return (
    <div>
      <label className="block max-w-xs">
        <span className={ROTULO}>Mês</span>
        <input type="month" value={mes.slice(0, 7)} onChange={(e) => setMes(`${e.target.value}-01`)} className={CAMPO} />
      </label>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-grafite-600/70">
            <th className="py-2 pr-4">Categoria</th>
            <th className="py-2 pr-4 text-right">Previsto</th>
            <th className="py-2 pr-4 text-right">Realizado</th>
            <th className="py-2 pr-4 text-right">Folga</th>
            <th className="py-2">Definir</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => {
            const linha = linhas.find((l) => l.categoria_codigo === c.codigo)
            const excedido = linha && Number(linha.folga) < 0
            return (
              <tr key={c.id} className="border-b border-creme-300/60">
                <td className="py-2.5 pr-4">{c.nome}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{linha ? fmt(linha.valor_previsto) : '—'}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{linha ? fmt(linha.realizado) : '—'}</td>
                <td className={`py-2.5 pr-4 text-right font-semibold tabular-nums ${excedido ? 'text-red-600' : 'text-grafite-900'}`}>
                  {linha ? fmt(linha.folga) : '—'}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rascunho[c.id] || ''}
                      onChange={(e) => setRascunho((r) => ({ ...r, [c.id]: e.target.value }))}
                      placeholder="0,00"
                      className="w-24 rounded-lg border border-creme-300 bg-creme-100 px-2 py-1.5 text-right text-sm outline-none focus:border-ambar-500"
                    />
                    <button type="button" onClick={() => definir(c.id)} className={BOTAO_SECUNDARIO}>ok</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────── Fornecedores ───────────────────────────
function Fornecedores({ fornecedores, aoAvisar, aoMudar }) {
  const [nome, setNome] = useState('')
  const [nif, setNif] = useState('')
  const [telefone, setTelefone] = useState('')

  async function guardar() {
    if (!nome.trim()) return
    try {
      await guardarFornecedor({ nome: nome.trim(), nif: nif || null, telefone: telefone || null })
      aoAvisar('Fornecedor criado.')
      setNome('')
      setNif('')
      setTelefone('')
      aoMudar()
    } catch (e) {
      aoAvisar(/duplicate|unique/i.test(e.message) ? 'Já existe um fornecedor com esse nome.' : e.message)
    }
  }

  return (
    <div>
      <div className={`${CARTAO} grid gap-3 p-4 sm:grid-cols-3`}>
        <label className="block">
          <span className={ROTULO}>Nome</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>NIF</span>
          <input type="text" inputMode="numeric" value={nif} onChange={(e) => setNif(e.target.value)} className={CAMPO} />
        </label>
        <label className="block">
          <span className={ROTULO}>Telefone</span>
          <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={CAMPO} />
        </label>
      </div>
      <button type="button" onClick={guardar} className={`${BOTAO_PRIMARIO} mt-4`}>Criar fornecedor</button>

      <ul className="mt-8 divide-y divide-creme-300/60">
        {fornecedores.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="font-semibold text-grafite-900">{f.nome}</span>
            <span className="text-grafite-600/70">{f.nif || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────── Shell ───────────────────────────
function Financeiro() {
  const { mostrarAviso, Aviso } = useAviso()
  const [aba, setAba] = useState('resumo')
  const [categorias, setCategorias] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [despesas, setDespesas] = useState([])
  const [receitas, setReceitas] = useState([])
  const [meses, setMeses] = useState([])
  const [pendentes, setPendentes] = useState(0)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const [c, f, d, r, m] = await Promise.all([
        listarCategorias(),
        listarFornecedores(),
        listarDespesas(),
        listarReceitasExternas(),
        resultadoMensal(),
      ])
      setCategorias(c)
      setFornecedores(f)
      setDespesas(d)
      setReceitas(r)
      setMeses(m)
      setErro('')
    } catch (e) {
      setErro(e.message || String(e))
    }
  }, [])

  const verFila = useCallback(async () => {
    try {
      setPendentes((await listarPendentes()).length)
    } catch {
      setPendentes(0)
    }
  }, [])

  useEffect(() => {
    carregar()
    verFila()
  }, [carregar, verFila])

  // O Wi-Fi do mercado vai falhar. Quando voltar, a fila esvazia-se sozinha.
  useEffect(() => {
    async function aoVoltarRede() {
      const { enviados } = await sincronizar()
      if (enviados) {
        mostrarAviso(`${enviados} despesa(s) sincronizada(s).`)
        carregar()
      }
      verFila()
    }
    window.addEventListener('online', aoVoltarRede)
    return () => window.removeEventListener('online', aoVoltarRede)
  }, [carregar, verFila, mostrarAviso])

  const aposMudanca = () => {
    carregar()
    verFila()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Secções do financeiro" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                aba === a.id ? 'bg-grafite-900 text-creme-50' : 'text-grafite-600 hover:text-grafite-900'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </nav>

        {pendentes > 0 && (
          <button
            type="button"
            onClick={async () => {
              const { enviados } = await sincronizar()
              mostrarAviso(enviados ? `${enviados} sincronizada(s).` : 'Ainda sem rede.')
              aposMudanca()
            }}
            className="cursor-pointer rounded-full border border-ambar-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ambar-600"
          >
            {pendentes} por sincronizar
          </button>
        )}
      </div>

      <Erro erro={erro} />

      <div className="mt-6">
        {aba === 'resumo' && <Resumo meses={meses} />}
        {aba === 'nova' && (
          <NovaDespesa
            categorias={categorias}
            fornecedores={fornecedores}
            aoAvisar={mostrarAviso}
            aoLancar={aposMudanca}
          />
        )}
        {aba === 'despesas' && <ListaDespesas despesas={despesas} aoAvisar={mostrarAviso} aoMudar={aposMudanca} />}
        {aba === 'receita' && <ReceitaExterna receitas={receitas} aoAvisar={mostrarAviso} aoMudar={aposMudanca} />}
        {aba === 'orcamento' && <Orcamento categorias={categorias} aoAvisar={mostrarAviso} />}
        {aba === 'fornecedores' && <Fornecedores fornecedores={fornecedores} aoAvisar={mostrarAviso} aoMudar={aposMudanca} />}
      </div>

      {Aviso}
    </div>
  )
}

export default Financeiro
