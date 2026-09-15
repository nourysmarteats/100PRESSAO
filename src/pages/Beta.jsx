// Registo por campanha/unidade e adesão Cliente Beta.
// Escrita só por RPC: limites, fecho, versões e elegibilidade são autoridade do servidor.
// Aceitação dos termos, leitura do aviso e marketing são atos distintos.
// O convite pessoal chega no fragmento e a adesão não altera publicidade.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import SEOHead from '../components/SEOHead'
import AdesaoClienteBeta from '../components/AdesaoClienteBeta'
import AvisoClienteBetaCompacto from '../components/AvisoClienteBetaCompacto'
import { SEO_PAGES } from '../seo/pages'
import logoStamp from '../assets/logo-100pressao.png'
import { marcaCliente } from '../lib/candidaturas'
import {
  CONFIG_FALLBACK,
  config as normalizarConfig,
  numeroFormatado,
  origemDoUrl,
  origensDeclaradas,
  normalizarTelemovel,
  validar,
  estadoInscricoes,
  selecionarCampanha,
  validarAdesao,
} from '../lib/beta'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

// text-base (16px) não é escolha estética: abaixo disso o Safari do iPhone dá
// zoom sozinho ao focar o campo e a pessoa perde a página de vista. Isto vai
// ser preenchido de pé, no mercado, ao balcão.
const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3.5 text-base text-grafite-900 outline-none focus:border-ambar-500'
const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'

const VAZIO = {
  nome: '',
  telemovel: '',
  origem_declarada: '',
  // Declaração de maioridade (espaço com álcool). Bloqueante, exigida também
  // pelo servidor. É elegibilidade, não consentimento.
  maioridade: false,
  aviso_lido: false,
  // Segundo consentimento, separado e opcional. O primeiro cobre a fase beta e
  // termina na inauguração; este é o que permite continuar a falar com a pessoa
  // depois disso. São finalidades diferentes, logo são caixas diferentes — uma
  // só caixa a cobrir as duas não é consentimento específico e não vale como
  // prova. Recolhe-se agora porque recolhê-lo depois obriga a contactar toda a
  // base outra vez, uma a uma.
  contacto_pos_beta: false,
}

function Beta() {
  const [convite] = useState(() => typeof window === 'undefined' ? '' : window.__clienteBetaConvite || new URLSearchParams(window.location.hash.slice(1)).get('convite') || '')
  useEffect(() => { delete window.__clienteBetaConvite }, [])
  const [campanhas, setCampanhas] = useState([])
  const [codigoUnidade, setCodigoUnidade] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('unidade') || '')
  const [cfg, setCfg] = useState(CONFIG_FALLBACK)
  const [carregado, setCarregado] = useState(false)
  const [dados, setDados] = useState(VAZIO)
  const [erros, setErros] = useState([])
  const [estado, setEstado] = useState('idle') // idle | a_enviar | inscrito | erro
  const [inscricao, setInscricao] = useState(null) // { numero, ja_inscrito }
  const [armadilha, setArmadilha] = useState('')
  const [agora, setAgora] = useState(Date.now)

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [])

  // Lido uma só vez, no primeiro render. Se ficasse dentro do render, uma
  // navegação interna que limpasse a query string levava a origem atrás.
  const [origemParam] = useState(() =>
    typeof window === 'undefined' ? 'directo' : origemDoUrl(window.location.search),
  )

  const prever = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('ver') === '1'

  useEffect(() => {
    let vivo = true
    async function carregar() {
      if (!supabase) return setCarregado(true)
      const { data: lista, error: erroCampanhas } = await supabase.rpc('listar_campanhas_beta')
      const { data } = await supabase
        .from('definicoes')
        .select('valor')
        .eq('chave', 'beta')
        .maybeSingle()
      if (!vivo) return
      if (!erroCampanhas) setCampanhas(lista || [])
      if (data?.valor) setCfg(normalizarConfig(data.valor))
      setCarregado(true)
    }
    carregar()
    return () => {
      vivo = false
    }
  }, [])

  const origens = useMemo(() => origensDeclaradas(cfg), [cfg])
  const campanha = selecionarCampanha(campanhas, codigoUnidade)
  const cfgNorm = { ...normalizarConfig(cfg), aberto: campanha?.aberto === true, inauguracao_em: campanha?.inauguracao_em || null, beta_terminou_em: null }
  const instanteServidor = campanha?.agora_servidor ? Date.parse(campanha.agora_servidor) : NaN
  const [recebidoEm, setRecebidoEm] = useState(Date.now)
  useEffect(() => { setRecebidoEm(Date.now()) }, [campanhas])
  const agoraCampanha = Number.isFinite(instanteServidor) ? instanteServidor + agora - recebidoEm : agora

  async function submeter(ev) {
    ev.preventDefault()
    if (estado === 'a_enviar') return
    if (!carregado || campanha?.regulamento_versao !== '2026-09-14.v1' || campanha?.aviso_versao !== '2026-09-14.v1' || estadoInscricoes(cfgNorm, Number.isFinite(instanteServidor) ? instanteServidor + Date.now() - recebidoEm : Date.now()) !== 'aberta') {
      setErros(['As inscrições estão fechadas de momento.'])
      return
    }
    if (armadilha) return // robô: finge que correu bem e não grava nada

    const problemas = [...validar(dados, cfg), ...validarAdesao(dados).filter((e) => e !== 'Falta confirmar a leitura do aviso.')]
    if (problemas.length) return setErros(problemas)
    setErros([])
    setEstado('a_enviar')

    const marca = marcaCliente(
      [navigator.userAgent, screen?.width, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|'),
    )

    const { data, error } = await supabase.rpc('inscrever_cliente_beta', {
      p_campanha_id: campanha.id,
      p_aceita_regulamento: dados.aceita_regulamento === true,
      p_nome: dados.nome.trim(),
      p_telemovel: normalizarTelemovel(dados.telemovel),
      p_origem_param: origemParam,
      p_origem_declarada: dados.origem_declarada,
      p_aviso_lido: dados.aviso_lido,
      p_maioridade: dados.maioridade,
      p_ip_hash: marca,
      p_contacto_pos_beta: dados.contacto_pos_beta,
    })

    if (error || !data?.length) {
      setEstado('erro')
      // A rede do mercado cai. Se a pessoa não perceber que falhou, vai-se
      // embora convencida de que ficou inscrita — e não fica.
      setErros([
        error?.message?.includes('Demasiadas inscrições')
          ? 'Recebemos várias inscrições deste telemóvel há pouco. Tenta daqui a bocado.'
          : error?.message?.includes('fechadas')
            ? 'As inscrições estão fechadas de momento.'
            : 'Não foi possível inscrever. Verifica a ligação e tenta outra vez — ainda não ficaste inscrito.',
      ])
      return
    }

    setInscricao(data[0])
    setEstado('inscrito')
  }

  if (!supabase) return null

  if (convite) return <AdesaoClienteBeta token={convite} />

  const versoesValidas = campanha?.regulamento_versao === '2026-09-14.v1' && campanha?.aviso_versao === '2026-09-14.v1'
  const situacao = versoesValidas ? estadoInscricoes(cfgNorm, agoraCampanha) : 'configuracao_invalida'
  const fechado = !carregado || (situacao !== 'aberta' && !(prever && situacao === 'fechada'))

  // ── Cartão de membro ──
  // É isto que a pessoa fotografa e mostra ao balcão. Número enorme, contraste
  // alto e nada a rolar: tem de ler-se numa foto tirada de braço esticado,
  // com má luz, no meio do mercado. O visual é do Sérgio; a mecânica é esta.
  if (estado === 'inscrito' && inscricao && !inscricao.adesao_registada) return (
    <main className="min-h-dvh bg-creme-50 px-6 py-20 text-center">
      <h1 className="text-2xl font-bold">Inscrição já existente</h1>
      <p className="mx-auto mt-4 max-w-lg">Para aderir ao programa Cliente Beta com a tua inscrição anterior, pede à equipa um acesso pessoal. Esta tentativa não alterou os teus dados nem registou uma nova adesão.</p>
    </main>
  )
  if (estado === 'inscrito' && inscricao) {
    return (
      // Ecrã inteiro e fundo chapado, por decisão do Sérgio e por razões de
      // fotografia: a câmara mede o creme e não queima o número. Sem animação
      // de entrada — um fade apanhado a meio dá o número a 40% de opacidade na
      // foto. Sem cobre no número, que perde metade do contraste do grafite e é
      // o primeiro a desaparecer quando a câmara escurece a imagem. Nada de
      // traços finos nem vazados, que a compressão come. E nada que obrigue a
      // rolar num ecrã de 375x667, que é o telemóvel mais pequeno que aparece
      // ao balcão.
      <main className="flex min-h-dvh flex-col items-center justify-center bg-creme-50 px-6 py-10 text-center">
        <SEOHead {...SEO_PAGES.beta} />
        <section aria-label="Cartão de beta tester" className="w-full max-w-md">
          <img
            src={logoStamp}
            alt="100PRESSÃO"
            width="640"
            height="640"
            className="mx-auto w-[22%] rounded-full bg-grafite-900"
          />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-grafite-900">
            Beta tester
          </p>
          {/* Zeros à esquerda no mesmo peso e cor dos outros dígitos: um zero
              esbatido lê-se como sujidade na foto, não como número. */}
          <p className="font-display font-bold leading-[0.85] tracking-tight text-grafite-900"
             style={{ fontSize: 'clamp(120px, 45vw, 260px)' }}>
            {numeroFormatado(inscricao.numero)}
          </p>
          <p className="mt-6 text-base text-grafite-800">
            Guarda este número. Ao balcão basta o teu nome.
          </p>
          <p className="mt-5 text-xs text-grafite-600/70">
            {dados.nome.trim().split(' ')[0]} · 100pressao.pt · {campanha?.unidade_nome}
          </p>
          {inscricao.ja_inscrito && (
            <p className="mt-4 text-xs text-grafite-600/70">
              Já estavas inscrito, por isso ficaste com o teu número original.
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.beta} />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ambar-600">
            Antes de abrirmos a sério
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Abrimos primeiro para ti
          </h1>
          <div className="mt-4 space-y-3 text-lg text-grafite-600">
            <p>
              Antes de inaugurarmos, a casa abre em beta. Portas abertas, mas só
              para um grupo pequeno de cada vez.
            </p>
            <p>
              São as semanas em que acertamos a cozinha, o balcão e os tempos.
              Quem entra nesta fase come e bebe connosco enquanto ainda estamos
              a afinar, e diz-nos o que falta.
            </p>
            {/* Esta linha é a que dá valor à inscrição, porque estabelece que
                isto tem fim. Não a cortar por brevidade. */}
            <p className="font-semibold text-grafite-900">
              A inauguração é o que fecha a beta.
            </p>
          </div>
        </motion.div>

        <section className="mt-8 space-y-3 rounded-xl border border-creme-300 p-5">
          <label className="block text-sm font-semibold" htmlFor="unidade-beta">Unidade da inscrição</label>
          <select id="unidade-beta" className={CAMPO} value={campanha?.unidade_codigo || codigoUnidade} onChange={(e) => { setCodigoUnidade(e.target.value); setDados((d) => ({ ...d, aceita_regulamento: false, aviso_lido: false })) }}>
            <option value="">Seleciona a unidade</option>
            {campanhas.map((c) => <option key={c.id} value={c.unidade_codigo}>{c.unidade_nome}</option>)}
          </select>
          <p className="text-sm">A inscrição encerra na inauguração desta unidade. Durante a beta não há desconto nem ementa exclusiva. Depois da inauguração, o Cliente Beta tem 10% de desconto no consumo próprio e acesso à ementa exclusiva, nos termos do regulamento.</p>
          {campanha?.inauguracao_em && <p className="text-sm">Inauguração: {new Date(campanha.inauguracao_em).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })} (hora de Portugal continental).</p>}
        </section>
        {fechado ? (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/60 p-8">
            <p className="text-grafite-700">
              {!carregado ? 'A carregar…' : 'As inscrições estão fechadas de momento.'}{' '}
              <a className="font-semibold text-cobre-600 hover:underline" href="mailto:geral@100pressao.pt">
                geral@100pressao.pt
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            {prever && (
              <p className="mt-6 rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm text-ambar-800">
                <strong>Pré-visualização.</strong> As inscrições não estão
                abertas ao público. O formulário funciona e o que for submetido
                fica mesmo gravado.
              </p>
            )}

            <section className="mt-8 rounded-2xl border border-creme-300 bg-white/60 p-8">
              <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                O que recebes
              </h2>
              {/* Nenhum destes inventa um benefício que ainda não esteja
                  decidido. Quando a Rita fechar o brinde da beta, ele entra no
                  lugar do terceiro ponto e o terceiro passa a fecho da secção. */}
              <ul className="mt-5 space-y-4 text-grafite-700">
                <li>
                  <p className="font-semibold text-grafite-900">Entras antes de abrirmos.</p>
                  <p className="mt-0.5 text-sm text-grafite-600">
                    As vagas saem por lotes. Avisamos-te quando for a tua vez.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-grafite-900">O teu nome basta.</p>
                  <p className="mt-0.5 text-sm text-grafite-600">
                    Ao balcão dizes o nome, está na lista, está tratado. Não há
                    cupões, nem códigos, nem app.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-grafite-900">
                    Ouvimos-te enquanto ainda dá para mudar.
                  </p>
                  <p className="mt-0.5 text-sm text-grafite-600">
                    O que disseres na beta ainda apanha a carta a tempo.
                  </p>
                </li>
              </ul>
            </section>

            <form onSubmit={submeter} className="mt-6 space-y-6">
              <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
                <div className="grid gap-5">
                  <label className="block">
                    <span className={ROTULO}>Nome</span>
                    <input
                      value={dados.nome}
                      onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))}
                      className={CAMPO}
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className={ROTULO}>Telemóvel</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={dados.telemovel}
                      onChange={(e) => setDados((d) => ({ ...d, telemovel: e.target.value }))}
                      className={CAMPO}
                      placeholder="912 345 678"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className={ROTULO}>Como soube de nós?</span>
                    <select
                      value={dados.origem_declarada}
                      onChange={(e) =>
                        setDados((d) => ({ ...d, origem_declarada: e.target.value }))
                      }
                      className={CAMPO}
                      required
                    >
                      <option value="">Escolhe uma</option>
                      {origens.map((o) => (
                        <option key={o.id} value={o.id}>{o.rotulo}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Armadilha para robôs. Escondida de quem vê e de quem ouve. */}
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

              <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                  Inscrição na fase beta — o que fazemos com os teus dados
                </h2>
                <div className="mt-4">
                  {/* O aviso inteiro, à vista. Não em hiperligação no rodapé: o
                      artigo 13.º manda informar no momento da recolha, e
                      informar não é ter um link algures. */}
                  <AvisoClienteBetaCompacto />
                  <label className="mt-4 flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={dados.aceita_regulamento === true} onChange={(e) => setDados((d) => ({ ...d, aceita_regulamento: e.target.checked }))} className="mt-1 h-5 w-5 shrink-0 accent-ambar-500" />
                    <span>Aceito o <a className="underline" href="/legal/cliente-beta/regulamento-2026-09-14.v1.txt" target="_blank" rel="noreferrer">regulamento Cliente Beta</a>.</span>
                  </label>
                </div>
                {/* Área de toque grande: isto é carregado com o polegar, de pé.
                    A caixa tem 20px e a etiqueta inteira é clicável.

                    Esta primeira caixa NÃO é um consentimento. Regista que o
                    aviso foi lido. A base legal da inscrição é a alínea b) do
                    artigo 6.º, n.º 1 — diligências a pedido do titular. Se
                    fosse consentimento, qualquer pessoa podia retirá-lo a meio
                    da beta e obrigava a apagar o contacto de alguém a quem já
                    tinha sido prometida uma vaga. */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-creme-300 bg-creme-50 p-4 text-sm text-grafite-700">
                  <input
                    type="checkbox"
                    checked={dados.aviso_lido}
                    onChange={(e) =>
                      setDados((d) => ({ ...d, aviso_lido: e.target.checked }))
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ambar-500"
                  />
                  <span>
                    Li o aviso acima e quero inscrever-me como beta tester do
                    100PRESSÃO.
                  </span>
                </label>

                {/* Declaração de maioridade. Espaço com álcool: quem se
                    inscreve declara ter 18 anos ou mais. Não é consentimento
                    nem leitura de aviso — é elegibilidade, e por isso bloqueia.
                    O servidor exige-a também (p_maioridade). */}
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-creme-300 bg-creme-50 p-4 text-sm text-grafite-700">
                  <input
                    type="checkbox"
                    checked={dados.maioridade}
                    onChange={(e) =>
                      setDados((d) => ({ ...d, maioridade: e.target.checked }))
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ambar-500"
                  />
                  <span>Confirmo que tenho 18 anos ou mais.</span>
                </label>

                {/* Esta segunda é que é consentimento, e tem de continuar
                    opcional. Se algum dia alguém pedir para a tornar
                    obrigatória: um consentimento que é condição de acesso não é
                    livre (art. 7.º, n.º 4) e deixa de valer — perde-se a caixa e
                    a base legal com ela.

                    O parêntesis não é cortesia. É o que torna o consentimento
                    livre: sem ele, alguém pode argumentar que marcou a caixa por
                    julgar que era preciso. Não o cortar por brevidade. */}
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-creme-300 bg-creme-50 p-4 text-sm text-grafite-700">
                  <input
                    type="checkbox"
                    checked={dados.contacto_pos_beta}
                    onChange={(e) => setDados((d) => ({ ...d, contacto_pos_beta: e.target.checked }))}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ambar-500"
                  />
                  <span>
                    Depois de a beta acabar, podem continuar a contactar-me com
                    novidades e convites do 100PRESSÃO.{' '}
                    <span className="text-grafite-600/70">
                      (Opcional. A tua inscrição na beta não depende disto e não
                      perdes nada se deixares em branco.) Cancelas quando
                      quiseres: respondes SAIR a qualquer mensagem, ou escreves
                      para geral@100pressao.pt. Guardamos o teu contacto para
                      isto até 24 meses depois da última vez que falares
                      connosco.
                    </span>
                  </span>
                </label>
              </div>

              {erros.length > 0 && (
                <ul
                  role="alert"
                  className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600"
                >
                  {erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}

              <button
                type="submit"
                disabled={!carregado || situacao !== 'aberta' || estado === 'a_enviar'}
                className="w-full cursor-pointer rounded-xl bg-cobre-600 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700 disabled:opacity-60"
              >
                {estado === 'a_enviar' ? 'A inscrever…' : 'Quero ser beta tester'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

export default Beta
