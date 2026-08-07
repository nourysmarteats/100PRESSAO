// Convite a instalar o restaurante online no telemóvel.
//
// Não há uma forma única de instalar uma PWA:
//   · Chrome/Edge/Android disparam `beforeinstallprompt` e deixam abrir o
//     diálogo nativo — aí basta um botão.
//   · O Safari do iPhone não tem API nenhuma. A única via é Partilhar →
//     Adicionar ao Ecrã Principal, e por isso o que se mostra é a indicação,
//     não um botão que não faria nada.
//   · Quem já instalou não pode ver isto: abre em display-mode standalone.
//
// Aparece depois de a página carregar e é dispensável. Fica fechado só
// durante a sessão do browser (sessionStorage), como o convite ao restaurante:
// quem volta noutro dia torna a ver, quem já disse que não fica em paz.
import { useEffect, useState } from 'react'
import logoStamp from '../assets/logo-100pressao.png'

const KEY = 'instalar-app-fechado-v1'

const jaInstalada = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const eIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent) // no iPhone só o Safari instala

// O botão leva o carimbo e o nome: é o que vai ficar no ecrã do telemóvel, e
// ver o ícone antes de instalar torna claro o que se está a guardar.
function BotaoInstalar({ onClick, compacto = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex cursor-pointer items-center gap-3 rounded-full bg-ambar-500 text-grafite-950 transition-colors hover:bg-ambar-400 ${
        compacto ? 'py-1.5 pl-1.5 pr-5' : 'py-2 pl-2 pr-6'
      }`}
    >
      <img
        src={logoStamp}
        alt=""
        aria-hidden="true"
        width="640"
        height="640"
        className={`shrink-0 rounded-full bg-grafite-900 ${compacto ? 'h-8 w-8' : 'h-10 w-10'}`}
      />
      <span className="text-left leading-tight">
        <span className={`block font-display font-bold uppercase tracking-tight ${compacto ? 'text-sm' : 'text-base'}`}>
          100PRESSÃO Online
        </span>
        <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] opacity-70">
          Instalar
        </span>
      </span>
    </button>
  )
}

function IconePartilhar() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" />
    </svg>
  )
}

// variante 'cartao': bloco com explicação, para dentro da loja.
// variante 'linha': link discreto, para onde o espaço é do desenho e não do texto.
function InstalarApp({ className = '', escuro = false, variante = 'cartao' }) {
  const [evento, setEvento] = useState(null) // beforeinstallprompt guardado
  const [ios, setIos] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const [instalado, setInstalado] = useState(false)

  useEffect(() => {
    if (jaInstalada()) return
    if (sessionStorage.getItem(KEY) === '1') return

    const noIOS = eIOS()
    setIos(noIOS)
    // No iPhone não há evento: mostra-se a indicação de imediato.
    if (noIOS) setVisivel(true)

    const aoPoderInstalar = (e) => {
      e.preventDefault() // guardar para abrir o diálogo quando o cliente quiser
      setEvento(e)
      setVisivel(true)
    }
    const aoInstalar = () => {
      setInstalado(true)
      setVisivel(false)
    }
    window.addEventListener('beforeinstallprompt', aoPoderInstalar)
    window.addEventListener('appinstalled', aoInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar)
      window.removeEventListener('appinstalled', aoInstalar)
    }
  }, [])

  function fechar() {
    setVisivel(false)
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* sessionStorage indisponível: fecha só nesta vista */
    }
  }

  async function instalar() {
    if (!evento) return
    evento.prompt()
    await evento.userChoice.catch(() => null)
    setEvento(null)
    setVisivel(false)
  }

  if (!visivel || instalado) return null

  // Variante compacta: um link só, sem caixa nem botão de dispensar. No iPhone
  // dá a indicação em texto, porque não há diálogo para abrir.
  if (variante === 'linha') {
    if (ios) {
      return (
        <p className={`text-xs ${escuro ? 'text-creme-500' : 'text-grafite-600/70'} ${className}`}>
          Junta ao ecrã principal: <IconePartilhar /> Partilhar → «Adicionar ao Ecrã Principal»
        </p>
      )
    }
    return (
      <div className={className}>
        <BotaoInstalar onClick={instalar} compacto />
      </div>
    )
  }

  const corTexto = escuro ? 'text-creme-200' : 'text-grafite-600'
  const corTitulo = escuro ? 'text-creme-50' : 'text-grafite-900'
  const corCaixa = escuro
    ? 'border-creme-500/30 bg-grafite-900/70 backdrop-blur'
    : 'border-creme-300 bg-white/70'

  return (
    <section className={`relative rounded-2xl border p-5 sm:p-6 ${corCaixa} ${className}`}>
      <button
        type="button"
        onClick={fechar}
        aria-label="Dispensar"
        className={`absolute right-3 top-3 cursor-pointer rounded-full px-2 py-1 text-lg leading-none ${corTexto} hover:opacity-70`}
      >
        ×
      </button>

      <p className={`font-display text-lg font-bold uppercase tracking-tight sm:text-xl ${corTitulo}`}>
        Encomenda em dois toques
      </p>
      <p className={`mt-2 max-w-md text-sm ${corTexto}`}>
        Guarda o 100PRESSÃO no telemóvel: abre como uma aplicação, sem passar por
        loja nenhuma e sem ocupar espaço.
      </p>

      {ios ? (
        <div className="mt-4 flex items-center gap-3">
          <img
            src={logoStamp}
            alt=""
            aria-hidden="true"
            width="640"
            height="640"
            className="h-12 w-12 shrink-0 rounded-full bg-grafite-900"
          />
          <p className={`text-sm ${corTexto}`}>
            No iPhone, toca em <IconePartilhar /> <strong className={corTitulo}>Partilhar</strong> e
            depois em <strong className={corTitulo}>«Adicionar ao Ecrã Principal»</strong>.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <BotaoInstalar onClick={instalar} />
        </div>
      )}
    </section>
  )
}

export default InstalarApp
