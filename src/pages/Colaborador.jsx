// Portal público de candidatura — 100pressao.pt/colaborador
//
// Três decisões que se notam pouco e importam muito:
//
// 1. O id da candidatura nasce aqui, no cliente. A RLS deixa o anónimo
//    INSERIR e não deixa LER — nem a própria candidatura. Sem `select` não há
//    `returning`, por isso o id tem de ser conhecido antes de gravar. É o que
//    permite arrumar os anexos numa pasta com o mesmo id.
//
// 2. Que documentos são obrigatórios vem da configuração, por função. O
//    comprovativo de início de atividade nas Finanças só aparece na via de
//    prestação de serviços. Pedi-lo a um candidato a cozinha seria decidir o
//    vínculo antes da entrevista.
//
// 3. Enquanto `portal_aberto` for falso, esta página não recebe ninguém. Com
//    `?ver=1` mostra o formulário a funcionar, para poder ser percorrido de
//    ponta a ponta antes de existir uma única pessoa real lá dentro.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import AvisoPrivacidadeRecrutamento from '../components/AvisoPrivacidadeRecrutamento'
import SEOHead from '../components/SEOHead'
import { SEO_PAGES } from '../seo/pages'
import {
  CONFIG_FALLBACK,
  MIME_ACEITES,
  TIPOS_DOCUMENTO,
  caminhoDocumento,
  config as normalizarConfig,
  documentosObrigatorios,
  ficheiroAceite,
  funcoes as listarFuncoes,
  marcaCliente,
  validar,
} from '../lib/candidaturas'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const CAMPO =
  'mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500'
const ROTULO = 'text-xs font-semibold uppercase tracking-widest text-ambar-600'

const VAZIO = {
  nome: '',
  email: '',
  telefone: '',
  funcao_pretendida: '',
  disponibilidade: '',
  experiencia: '',
  mensagem: '',
  consentimento_reserva: false,
  aviso_lido: false,
}

function Colaborador() {
  const [cfg, setCfg] = useState(CONFIG_FALLBACK)
  const [carregado, setCarregado] = useState(false)
  const [dados, setDados] = useState(VAZIO)
  const [anexos, setAnexos] = useState([])
  const [erros, setErros] = useState([])
  const [estado, setEstado] = useState('idle') // idle | a_enviar | enviado | erro
  // Campo que só um robô preenche. Fica escondido e é a defesa mais barata
  // que existe; a séria continua a faltar (Turnstile).
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
        .eq('chave', 'candidaturas')
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

  const funcoes = useMemo(() => listarFuncoes(cfg), [cfg])
  const obrigatorios = documentosObrigatorios(cfg, dados.funcao_pretendida)
  const maxAnexos = normalizarConfig(cfg).max_anexos

  function acrescentarAnexo(tipo, ficheiro) {
    const problema = ficheiroAceite(ficheiro)
    if (problema) return setErros([problema])
    if (anexos.length >= maxAnexos) return setErros([`No máximo ${maxAnexos} anexos.`])
    setErros([])
    setAnexos((a) => [...a.filter((x) => x.tipo !== tipo), { tipo, ficheiro }])
  }

  async function submeter(ev) {
    ev.preventDefault()
    if (estado === 'a_enviar') return
    if (armadilha) return // robô: finge que correu bem e não grava nada

    const problemas = validar(dados, cfg, anexos)
    if (problemas.length) return setErros(problemas)
    setErros([])
    setEstado('a_enviar')

    const id = crypto.randomUUID()
    const marca = marcaCliente(
      [navigator.userAgent, screen?.width, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|'),
    )

    const { error } = await supabase.from('colaborador_candidaturas').insert({
      id,
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      telefone: dados.telefone.trim() || null,
      funcao_pretendida: dados.funcao_pretendida,
      disponibilidade: dados.disponibilidade.trim() || null,
      experiencia: dados.experiencia.trim() || null,
      mensagem: dados.mensagem.trim() || null,
      consentimento_reserva: dados.consentimento_reserva,
      estado: 'nova',
      origem: 'portal',
      ip_hash: marca,
    })

    if (error) {
      setEstado('erro')
      setErros([
        error.message?.includes('candidatura_dentro_do_limite')
          ? 'Já recebemos várias candidaturas deste dispositivo há pouco. Tenta mais tarde.'
          : 'Não foi possível enviar. Tenta daqui a pouco ou escreve para equipa@100pressao.pt.',
      ])
      return
    }

    // Anexos. Se algum falhar, a candidatura fica na mesma — vale mais uma
    // candidatura sem currículo do que perdê-la inteira por um upload.
    const falhados = []
    for (const [i, a] of anexos.entries()) {
      const caminho = caminhoDocumento(id, a.tipo, a.ficheiro.name, String(i))
      const { error: eUp } = await supabase.storage
        .from('candidaturas')
        .upload(caminho, a.ficheiro, { contentType: a.ficheiro.type, upsert: false })
      if (eUp) {
        falhados.push(a.tipo)
        continue
      }
      await supabase.from('colaborador_documentos').insert({
        candidatura_id: id,
        tipo: a.tipo,
        caminho,
        nome_original: a.ficheiro.name.slice(0, 120),
        bytes: a.ficheiro.size,
        mime: a.ficheiro.type,
      })
    }

    setEstado('enviado')
    if (falhados.length) {
      setErros([
        `A candidatura ficou registada, mas ${falhados.length} anexo(s) não subiram. Envia-os por email para equipa@100pressao.pt.`,
      ])
    }
  }

  if (!supabase) return null

  const fechado = carregado && !normalizarConfig(cfg).portal_aberto && !prever

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.colaborador} />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Trabalhar connosco
          </h1>
          <p className="mt-3 text-lg text-grafite-600">
            Somos uma casa pequena a abrir em Carnaxide. Diz-nos quem és e o
            que sabes fazer.
          </p>
        </motion.div>

        {fechado ? (
          <div className="mt-10 rounded-2xl border border-creme-300 bg-white/60 p-8">
            <p className="text-grafite-700">
              Ainda não estamos a receber candidaturas por aqui. Abrimos este
              formulário quando começarmos a contratar — entretanto, podes
              escrever para{' '}
              <a className="font-semibold text-cobre-600 hover:underline" href="mailto:equipa@100pressao.pt">
                equipa@100pressao.pt
              </a>
              .
            </p>
          </div>
        ) : estado === 'enviado' ? (
          <div className="mt-10 rounded-2xl border border-ambar-500/50 bg-ambar-500/10 p-8">
            <p className="font-display text-2xl font-bold uppercase text-grafite-900">
              Recebido.
            </p>
            <p className="mt-2 text-grafite-700">
              Obrigado, {dados.nome.split(' ')[0]}. Lemos todas as
              candidaturas e respondemos — mesmo quando a resposta é não.
            </p>
            {erros.length > 0 && (
              <p className="mt-3 text-sm text-ambar-800">{erros[0]}</p>
            )}
          </div>
        ) : (
          <>
            {prever && (
              <p className="mt-6 rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm text-ambar-800">
                <strong>Pré-visualização.</strong> O portal não está aberto ao
                público. O formulário funciona e o que for submetido fica
                mesmo gravado.
              </p>
            )}

            <form onSubmit={submeter} className="mt-8 space-y-6">
              <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
                <div className="grid gap-5 sm:grid-cols-2">
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
                    <span className={ROTULO}>Email</span>
                    <input
                      type="email"
                      value={dados.email}
                      onChange={(e) => setDados((d) => ({ ...d, email: e.target.value }))}
                      className={CAMPO}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className={ROTULO}>Telefone</span>
                    <input
                      value={dados.telefone}
                      onChange={(e) => setDados((d) => ({ ...d, telefone: e.target.value }))}
                      className={CAMPO}
                      autoComplete="tel"
                    />
                  </label>
                  <label className="block">
                    <span className={ROTULO}>Função</span>
                    <select
                      value={dados.funcao_pretendida}
                      onChange={(e) =>
                        setDados((d) => ({ ...d, funcao_pretendida: e.target.value }))
                      }
                      className={CAMPO}
                      required
                    >
                      <option value="">Escolhe uma</option>
                      {funcoes.map((f) => (
                        <option key={f.id} value={f.id}>{f.rotulo}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={ROTULO}>Disponibilidade</span>
                    <input
                      value={dados.disponibilidade}
                      onChange={(e) =>
                        setDados((d) => ({ ...d, disponibilidade: e.target.value }))
                      }
                      className={CAMPO}
                      placeholder="ex.: fins-de-semana, a partir de Outubro"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={ROTULO}>Experiência</span>
                    <textarea
                      rows={3}
                      value={dados.experiencia}
                      onChange={(e) => setDados((d) => ({ ...d, experiencia: e.target.value }))}
                      className={CAMPO}
                      placeholder="Onde trabalhaste, o que fazias"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={ROTULO}>Mais alguma coisa</span>
                    <textarea
                      rows={2}
                      value={dados.mensagem}
                      onChange={(e) => setDados((d) => ({ ...d, mensagem: e.target.value }))}
                      className={CAMPO}
                    />
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

              {/* Anexos */}
              <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                  Anexos
                </h2>
                <p className="mt-1 text-sm text-grafite-600">
                  PDF, JPEG ou PNG, até 5 MB cada, no máximo {maxAnexos}.
                  Não peças para juntar cópia do Cartão de Cidadão — não a
                  aceitamos, e confirmamos a identidade pessoalmente.
                </p>

                <div className="mt-5 space-y-4">
                  {Object.entries(TIPOS_DOCUMENTO).map(([tipo, meta]) => {
                    const exigido = obrigatorios.includes(tipo)
                    const junto = anexos.find((a) => a.tipo === tipo)
                    return (
                      <div key={tipo} className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-grafite-900">
                            {meta.rotulo}
                            {exigido && (
                              <span className="ml-2 rounded-full border border-ambar-500/40 bg-ambar-500/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-ambar-700">
                                obrigatório
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-grafite-600/70">
                            {junto ? junto.ficheiro.name : meta.dica}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept={MIME_ACEITES.join(',')}
                          onChange={(e) => acrescentarAnexo(tipo, e.target.files?.[0])}
                          className="max-w-[14rem] text-xs text-grafite-600 file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-creme-300 file:bg-creme-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-grafite-700"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Aviso de privacidade, à vista e antes de submeter */}
              <div className="rounded-2xl border border-creme-300 bg-white/60 p-8">
                <h2 className="font-display text-xl font-bold uppercase text-grafite-900">
                  O que fazemos com os teus dados
                </h2>
                <div className="mt-4">
                  <AvisoPrivacidadeRecrutamento compacto />
                </div>

                <label className="mt-6 flex items-start gap-3 text-sm text-grafite-700">
                  <input
                    type="checkbox"
                    checked={dados.aviso_lido}
                    onChange={(e) => setDados((d) => ({ ...d, aviso_lido: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-ambar-500"
                  />
                  Li e percebi o que acima está escrito.
                </label>

                <label className="mt-3 flex items-start gap-3 text-sm text-grafite-700">
                  <input
                    type="checkbox"
                    checked={dados.consentimento_reserva}
                    onChange={(e) =>
                      setDados((d) => ({ ...d, consentimento_reserva: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 accent-ambar-500"
                  />
                  Se não for desta, podem guardar a minha candidatura doze
                  meses para futuras oportunidades. (Opcional.)
                </label>
              </div>

              {erros.length > 0 && (
                <ul className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">
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
                {estado === 'a_enviar' ? 'A enviar…' : 'Enviar candidatura'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

export default Colaborador
