// Registo público de empresas de entrega — 100pressao.pt/parceiro-entregas
//
// Ata de 2026-10-12: as entregas do restaurante online passam a ser feitas
// por empresas operadoras de frota. O 100PRESSÃO nunca paga directamente a
// estafetas; a empresa regista-se aqui, o admin aprova e fixa o preço.
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
import { CONFIG_FALLBACK, config as normalizarConfig, mensagemErro, parametros, validar } from '../lib/empresasEntrega'
import termos from '../../docs/consentimentos/termos-empresas-entrega-2026-10-12.v1.txt?raw'
import aviso from '../../docs/consentimentos/aviso-empresas-entrega-2026-10-12.v1.txt?raw'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'
const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'
const CARTAO = 'rounded-2xl border border-creme-300 bg-white/60 p-8'

const VAZIO = {
  nome_legal: '',
  nome_comercial: '',
  nipc: '',
  zona: '',
  n_estafetas: '',
  contacto_nome: '',
  contacto_email: '',
  contacto_telefone: '',
  tarifa_base: '',
  tarifa_km: '',
  aceita_termos: false,
  aviso_lido: false,
}

function Campo({ rotulo, dica, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className={ROTULO}>{rotulo}</span>
      <input {...props} className={CAMPO} />
      {dica && <span className="mt-1 block text-xs text-grafite-600/70">{dica}</span>}
    </label>
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

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.parceiroEntregas} />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className={ROTULO}>Parceiros de entrega</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Entregue connosco
          </h1>
          <p className="mt-3 text-lg text-grafite-600">
            Procuramos empresas de estafetas para levar as encomendas do
            restaurante online 100PRESSÃO a Carnaxide e arredores.
            Registe a sua empresa: lemos cada registo e respondemos.
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
          <div className="mt-10 rounded-2xl border border-ambar-500/50 bg-ambar-500/10 p-8">
            <p className="font-display text-2xl font-bold uppercase text-grafite-900">Registo recebido.</p>
            <p className="mt-2 text-grafite-700">
              Obrigado. Vamos analisar o registo e entramos em contacto
              com {dados.contacto_nome.split(' ')[0] || 'a pessoa indicada'} por
              email ou telefone. A prestação só começa depois de
              assinarmos contrato.
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
              <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Como funciona</h2>
              <ul className="mt-4 space-y-2 text-sm text-grafite-700">
                <li>· Os pedidos são oferecidos aos estafetas disponíveis da sua empresa, que aceitam ou recusam livremente.</li>
                <li>· Os seus estafetas não têm exclusividade nem horários impostos por nós.</li>
                <li>· Pagamos à empresa, com fatura mensal, ao preço acordado. Nunca pagamos diretamente a estafetas.</li>
                <li>· Antes de começar, assinamos contrato e acordo de tratamento de dados.</li>
              </ul>
            </div>

            <form onSubmit={submeter} className="mt-6 space-y-6" noValidate>
              <div className={CARTAO}>
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">A empresa</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Nome legal" value={dados.nome_legal} onChange={mudar('nome_legal')}
                    autoComplete="organization" required className="sm:col-span-2" />
                  <Campo rotulo="Nome comercial (opcional)" value={dados.nome_comercial} onChange={mudar('nome_comercial')} />
                  <Campo rotulo="NIPC" value={dados.nipc} onChange={mudar('nipc')} inputMode="numeric" required />
                  <Campo rotulo="Zona onde opera" value={dados.zona} onChange={mudar('zona')}
                    placeholder="ex.: Oeiras, Algés, Lisboa ocidental" className="sm:col-span-2" />
                  <Campo rotulo="N.º aproximado de estafetas (opcional)" value={dados.n_estafetas}
                    onChange={mudar('n_estafetas')} inputMode="numeric" />
                </div>
              </div>

              <div className={CARTAO}>
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Pessoa de contacto</h2>
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
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Preço proposto</h2>
                <p className="mt-1 text-sm text-grafite-600">
                  Por entrega, sem IVA. O preço final fica acordado na aprovação.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Campo rotulo="Valor fixo por entrega (€)" value={dados.tarifa_base} onChange={mudar('tarifa_base')}
                    inputMode="decimal" placeholder="ex.: 2,50" required />
                  <Campo rotulo="Valor por km (€)" value={dados.tarifa_km} onChange={mudar('tarifa_km')}
                    inputMode="decimal" placeholder="ex.: 0,40" required />
                </div>

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
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">Condições e privacidade</h2>
                <div className="mt-4 space-y-4">
                  <TextoLegal texto={termos} />
                  <TextoLegal texto={aviso} alturaMaxima="16rem" />
                </div>
                <label className="mt-6 flex items-start gap-3 text-sm text-grafite-700">
                  <input type="checkbox" checked={dados.aceita_termos} onChange={mudar('aceita_termos')}
                    className="mt-0.5 h-4 w-4 accent-ambar-500" />
                  Li e aceito as condições de registo, em nome da empresa.
                </label>
                <label className="mt-3 flex items-start gap-3 text-sm text-grafite-700">
                  <input type="checkbox" checked={dados.aviso_lido} onChange={mudar('aviso_lido')}
                    className="mt-0.5 h-4 w-4 accent-ambar-500" />
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
