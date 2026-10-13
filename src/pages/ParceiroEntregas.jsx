// Registo público de empresas de entrega — 100pressao.pt/parceiro-entregas
//
// Ata de 2026-10-12: as entregas das encomendas feitas na app e no site do
// 100PRESSÃO passam a ser feitas por empresas operadoras de frota. Nunca
// pagamos directamente a estafetas; a empresa regista-se aqui, o admin aprova
// e fixa o preço. v2 (2026-10-13): faturação semanal consolidada, preço em
// quatro partes (recolha, entrega, km incluídos, km adicional) e informação
// operacional (horários, experiência, mochila térmica, seguros).
//
// A escrita vai pela função registar_empresa_entrega (SECURITY DEFINER): o
// anónimo não lê nem escreve na tabela. O IP é lido pelo servidor a partir do
// cabeçalho do gateway — o cliente não manda marca nenhuma.
//
// Com `registo_aberto` a falso, a página fecha. `?ver=1` mostra o formulário
// para se percorrer de ponta a ponta (o que for submetido fica gravado).

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import SEOHead from '../components/SEOHead'
import TextoLegal from '../components/TextoLegal'
import { SEO_PAGES } from '../seo/pages'
import {
  CONFIG_FALLBACK,
  EXPERIENCIAS,
  config as normalizarConfig,
  exemploPreco,
  mensagemErro,
  parametros,
  validar,
} from '../lib/empresasEntrega'
import termos from '../../docs/consentimentos/termos-empresas-entrega-2026-10-13.v2.txt?raw'
import aviso from '../../docs/consentimentos/aviso-empresas-entrega-2026-10-13.v2.txt?raw'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'
const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'
const CARTAO = 'rounded-2xl border border-creme-300 bg-white/60 p-8'
const TITULO = 'font-display text-xl font-bold uppercase text-grafite-900'
const VISTO = 'flex items-start gap-3 text-sm text-grafite-700'
const CAIXA = 'mt-0.5 h-4 w-4 shrink-0 accent-ambar-500'

const VAZIO = {
  nome_legal: '',
  nome_comercial: '',
  nipc: '',
  zona: '',
  n_estafetas: '',
  horarios: '',
  experiencia: '',
  mochila_termica: false,
  seguros: false,
  contacto_nome: '',
  contacto_email: '',
  contacto_telefone: '',
  tarifa_recolha: '',
  tarifa_entrega: '',
  km_incluidos: '',
  tarifa_km_adicional: '',
  suplementos: '',
  aceita_termos: false,
  aviso_lido: false,
}

const FATURACAO =
  'A empresa emite uma fatura semanal consolidada pelas entregas concluídas no período anterior. O pagamento é efetuado à empresa nos termos acordados. Nunca pagamos diretamente aos estafetas.'

const euros = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

function Campo({ rotulo, dica, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className={ROTULO}>{rotulo}</span>
      <input {...props} className={CAMPO} />
      {dica && <span className="mt-1 block text-xs text-grafite-600/70">{dica}</span>}
    </label>
  )
}

function AreaTexto({ rotulo, dica, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className={ROTULO}>{rotulo}</span>
      <textarea {...props} className={`${CAMPO} min-h-24 resize-y`} />
      {dica && <span className="mt-1 block text-xs text-grafite-600/70">{dica}</span>}
    </label>
  )
}

function Expandir({ titulo, children }) {
  return (
    <details className="group rounded-xl border border-creme-300 bg-creme-50">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-grafite-900 marker:hidden">
        <span className="mr-2 inline-block text-ambar-600 transition group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="px-2 pb-2">{children}</div>
    </details>
  )
}

function ParceiroEntregas() {
  const [cfg, setCfg] = useState(CONFIG_FALLBACK)
  const [carregado, setCarregado] = useState(false)
  const [dados, setDados] = useState(VAZIO)
  const [erros, setErros] = useState([])
  const [estado, setEstado] = useState('idle') // idle | a_enviar | enviado
  const [armadilha, setArmadilha] = useState('')

  const prever = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('ver') === '1'

  useEffect(() => {
    let vivo = true
    async function carregar() {
      if (!supabase) return setCarregado(true)
      const { data } = await supabase
        .from('definicoes')
        .select('valor')
        .eq('chave', 'empresas_entrega')
        .maybeSingle()
      if (!vivo) return
      if (data?.valor) setCfg(normalizarConfig(data.valor))
      setCarregado(true)
    }
    carregar()
    return () => {
      vivo = false
    }
  }, [])

  const mudar = (campo) => (e) =>
    setDados((d) => ({ ...d, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submeter(ev) {
    ev.preventDefault()
    if (estado === 'a_enviar') return
    if (armadilha) return setEstado('enviado') // robô: finge que correu bem

    const problemas = validar(dados)
    if (problemas.length) return setErros(problemas)
    setErros([])
    setEstado('a_enviar')

    const { error } = await supabase.rpc('registar_empresa_entrega', parametros(dados))
    if (error) {
      setEstado('idle')
      setErros([mensagemErro(error)])
      return
    }
    setEstado('enviado')
  }

  if (!supabase) return null
  const fechado = carregado && !normalizarConfig(cfg).registo_aberto && !prever
  const exemplos = [3, 6].map((km) => [km, exemploPreco(dados, km)])

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.parceiroEntregas} />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className={ROTULO}>Parceiros de entrega</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Seja parceiro de entregas do 100PRESSÃO
          </h1>
          <p className="mt-3 text-lg text-grafite-600">
            Procuramos empresas de estafetas e parceiros de frota para entregar
            encomendas recebidas diretamente através da app e do site do
            100PRESSÃO. Operamos em Carnaxide, Algés, Oeiras, Queijas e zonas
            próximas.
          </p>
        </motion.div>

        {fechado ? (
          <div className={`mt-10 ${CARTAO}`}>
            <p className="text-grafite-700">
              De momento não estamos a receber registos por aqui. Pode
              escrever-nos para{' '}
              <a className="font-semibold text-cobre-600 hover:underline" href="mailto:geral@100pressao.pt">
                geral@100pressao.pt
              </a>
              .
            </p>
          </div>
        ) : estado === 'enviado' ? (
          <div className="mt-10 rounded-2xl border border-ambar-500/50 bg-ambar-500/10 p-8" role="status">
            <p className="font-display text-2xl font-bold uppercase text-grafite-900">Registo recebido.</p>
            <p className="mt-2 text-grafite-700">
              Obrigado. Vamos analisar o registo e entramos em contacto
              com {dados.contacto_nome.split(' ')[0] || 'a pessoa indicada'} por
              email ou telefone. A prestação só começa depois de
              assinarmos contrato e acordo de tratamento de dados.
            </p>
          </div>
        ) : (
          <>
            {prever && !normalizarConfig(cfg).registo_aberto && (
              <p className="mt-6 rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm text-ambar-800">
                <strong>Pré-visualização.</strong> O registo não está aberto ao
                público. O formulário funciona e o que for submetido fica
                mesmo gravado.
              </p>
            )}

            <div className={`mt-8 ${CARTAO}`}>
              <h2 className={TITULO}>Como funciona</h2>
              <ul className="mt-4 space-y-2 text-sm text-grafite-700">
                <li>· As encomendas vêm exclusivamente dos nossos canais próprios: a app e o site do 100PRESSÃO. Não inclui pedidos de Uber Eats, Glovo ou Bolt Food.</li>
                <li>· A sua empresa recruta e gere os estafetas: escalas, remuneração, seguros e substituições.</li>
                <li>· Cada estafeta aceita ou recusa livremente cada pedido. Não exigimos exclusividade nem impomos horários.</li>
                <li>· {FATURACAO}</li>
                <li>· Antes de começar, assinamos contrato de prestação de serviços e acordo de tratamento de dados.</li>
              </ul>
            </div>

            <form onSubmit={submeter} className="mt-6 space-y-6" noValidate>
              <div className={CARTAO}>
                <h2 className={TITULO}>A empresa</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Nome legal" value={dados.nome_legal} onChange={mudar('nome_legal')}
                    autoComplete="organization" required className="sm:col-span-2" />
                  <Campo rotulo="Nome comercial (opcional)" value={dados.nome_comercial} onChange={mudar('nome_comercial')} />
                  <Campo rotulo="NIPC" value={dados.nipc} onChange={mudar('nipc')} inputMode="numeric" required />
                </div>
              </div>

              <div className={CARTAO}>
                <h2 className={TITULO}>Operação</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Zonas de cobertura" value={dados.zona} onChange={mudar('zona')} required
                    placeholder="ex.: Carnaxide, Algés, Oeiras, Queijas" className="sm:col-span-2" />
                  <Campo rotulo="Estafetas disponíveis nas horas de maior procura (opcional)" value={dados.n_estafetas}
                    onChange={mudar('n_estafetas')} inputMode="numeric" className="sm:col-span-2" />
                  <Campo rotulo="Horários de disponibilidade (opcional)" value={dados.horarios} onChange={mudar('horarios')}
                    maxLength={300} placeholder="ex.: todos os dias, 11h–15h e 18h–23h" className="sm:col-span-2" />
                  <label className="block sm:col-span-2">
                    <span className={ROTULO}>Experiência em entrega de refeições quentes (opcional)</span>
                    <select value={dados.experiencia} onChange={mudar('experiencia')} className={CAMPO}>
                      <option value="">Escolha uma opção</option>
                      {EXPERIENCIAS.map(([id, texto]) => (
                        <option key={id} value={id}>{texto}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-6 space-y-3">
                  <label className={VISTO}>
                    <input type="checkbox" checked={dados.mochila_termica} onChange={mudar('mochila_termica')} className={CAIXA} />
                    Confirmo que os estafetas usam mochila ou caixa térmica própria para alimentos, limpa e em bom estado.
                  </label>
                  <label className={VISTO}>
                    <input type="checkbox" checked={dados.seguros} onChange={mudar('seguros')} className={CAIXA} />
                    Confirmo que a empresa tem seguro de acidentes de trabalho e seguro de responsabilidade civil em vigor para esta atividade.
                  </label>
                </div>
              </div>

              <div className={CARTAO}>
                <h2 className={TITULO}>Pessoa de contacto</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Nome" value={dados.contacto_nome} onChange={mudar('contacto_nome')}
                    autoComplete="name" required className="sm:col-span-2" />
                  <Campo rotulo="Email" type="email" value={dados.contacto_email} onChange={mudar('contacto_email')}
                    autoComplete="email" required />
                  <Campo rotulo="Telefone" value={dados.contacto_telefone} onChange={mudar('contacto_telefone')}
                    autoComplete="tel" inputMode="tel" required />
                </div>
              </div>

              <div className={CARTAO}>
                <h2 className={TITULO}>Preço proposto</h2>
                <p className="mt-1 text-sm text-grafite-600">
                  Valores por entrega, sem IVA. É uma proposta: o preço final fica
                  sujeito à nossa aprovação e a acordo escrito.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Tarifa de recolha (€)" value={dados.tarifa_recolha} onChange={mudar('tarifa_recolha')}
                    inputMode="decimal" placeholder="ex.: 1,00" required />
                  <Campo rotulo="Tarifa de entrega (€)" value={dados.tarifa_entrega} onChange={mudar('tarifa_entrega')}
                    inputMode="decimal" placeholder="ex.: 1,50" required />
                  <Campo rotulo="Quilómetros incluídos na tarifa" value={dados.km_incluidos} onChange={mudar('km_incluidos')}
                    inputMode="decimal" placeholder="ex.: 2" required />
                  <Campo rotulo="Valor por quilómetro adicional (€)" value={dados.tarifa_km_adicional}
                    onChange={mudar('tarifa_km_adicional')} inputMode="decimal" placeholder="ex.: 0,30" required />
                  <AreaTexto rotulo="Suplementos ou condições especiais (opcional)" value={dados.suplementos}
                    onChange={mudar('suplementos')} maxLength={1000} className="sm:col-span-2"
                    dica="Por exemplo: tempo de espera, serviço noturno, feriados, chuva, devoluções ou cancelamentos." />
                </div>

                <p className="mt-5 text-sm text-grafite-700" aria-live="polite">
                  {exemplos[0][1] == null
                    ? 'Preencha os quatro valores para ver um exemplo.'
                    : `Com estes valores, uma entrega de ${exemplos[0][0]} km custaria ${euros(exemplos[0][1])} e uma de ${exemplos[1][0]} km ${euros(exemplos[1][1])}, sem IVA e sem suplementos.`}
                </p>

                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={armadilha}
                  onChange={(e) => setArmadilha(e.target.value)}
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />
              </div>

              <div className={CARTAO}>
                <h2 className={TITULO}>Condições e privacidade</h2>
                <ul className="mt-4 space-y-2 text-sm text-grafite-700">
                  <li>· O registo não cria contrato nem obriga nenhuma das partes. A prestação só começa depois de assinados o contrato e o acordo de tratamento de dados.</li>
                  <li>· A empresa é responsável por contratar, gerir e pagar os seus estafetas, e pelos respetivos seguros e obrigações legais.</li>
                  <li>· {FATURACAO}</li>
                  <li>· Usamos os dados indicados para analisar o registo e contactar a empresa. Os detalhes estão no aviso de privacidade.</li>
                </ul>
                <div className="mt-5 space-y-3">
                  <Expandir titulo="Ler as condições de registo na íntegra">
                    <TextoLegal texto={termos} />
                  </Expandir>
                  <Expandir titulo="Ler o aviso de privacidade na íntegra">
                    <TextoLegal texto={aviso} alturaMaxima="16rem" />
                  </Expandir>
                </div>
                <label className={`mt-6 ${VISTO}`}>
                  <input type="checkbox" checked={dados.aceita_termos} onChange={mudar('aceita_termos')} className={CAIXA} />
                  Li e aceito as condições de registo, em nome da empresa.
                </label>
                <label className={`mt-3 ${VISTO}`}>
                  <input type="checkbox" checked={dados.aviso_lido} onChange={mudar('aviso_lido')} className={CAIXA} />
                  Li o aviso de privacidade.
                </label>
              </div>

              {erros.length > 0 && (
                <ul className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600" role="alert">
                  {erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}

              <button
                type="submit"
                disabled={estado === 'a_enviar'}
                className="w-full cursor-pointer rounded-xl bg-cobre-600 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60 sm:w-auto"
              >
                {estado === 'a_enviar' ? 'A enviar…' : 'Registar empresa'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

export default ParceiroEntregas
