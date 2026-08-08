// Instalação do restaurante online como app no telemóvel. Vive no rodapé,
// secção "Downloads", e por isso está disponível em qualquer página.
//
// PORQUÊ O EVENTO É GUARDADO AO NÍVEL DO MÓDULO
// O `beforeinstallprompt` dispara UMA vez por carregamento de página. Numa SPA,
// se for capturado por um componente que depois desmonta — ao navegar para
// outra rota —, perde-se; o componente seguinte monta e nunca recebe nada,
// ficando com um botão que não abre coisa nenhuma. Guardar o evento aqui, fora
// do ciclo de vida do React, faz com que quem montar a seguir o encontre à
// espera. Era esta a causa de o botão parecer avariado.
import { useEffect, useState } from 'react'
import logoStamp from '../assets/logo-100pressao.png'

let eventoGuardado = null
const ouvintes = new Set()

function avisar() {
  ouvintes.forEach((f) => f(eventoGuardado))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // guardar para abrir o diálogo quando o cliente quiser
    eventoGuardado = e
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    eventoGuardado = null
    avisar()
  })
}

const jaInstalada = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true)

// No iPhone só o Safari instala, e não há API nenhuma: a única via é
// Partilhar → Adicionar ao Ecrã Principal.
const eIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent)

function IconePartilhar() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" />
    </svg>
  )
}

function InstalarApp() {
  const [evento, setEvento] = useState(eventoGuardado)
  const [instalada, setInstalada] = useState(false)
  const [ajuda, setAjuda] = useState(false)

  useEffect(() => {
    setInstalada(jaInstalada())
    const ouvir = (e) => {
      setEvento(e)
      if (e === null) setInstalada(jaInstalada())
    }
    ouvintes.add(ouvir)
    return () => {
      ouvintes.delete(ouvir)
    }
  }, [])

  // Já está no ecrã principal: não há nada para descarregar.
  if (instalada) return null

  async function aoCarregar() {
    if (evento) {
      evento.prompt()
      await evento.userChoice.catch(() => null)
      eventoGuardado = null // o evento só pode ser usado uma vez
      setEvento(null)
      return
    }
    // Sem diálogo possível (iPhone, ou browser sem suporte): explica-se o
    // caminho, em vez de deixar um botão que não faz nada.
    setAjuda((v) => !v)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-400">Downloads</h3>
      <button
        type="button"
        onClick={aoCarregar}
        aria-expanded={ajuda}
        className="mt-4 flex w-full max-w-xs cursor-pointer items-center gap-3 rounded-xl border border-creme-500/25 bg-grafite-900/60 p-2.5 text-left transition-colors hover:border-ambar-400/60"
      >
        <img
          src={logoStamp}
          alt=""
          aria-hidden="true"
          width="640"
          height="640"
          className="h-10 w-10 shrink-0 rounded-full bg-grafite-950"
        />
        <span className="leading-tight">
          <span className="block font-display text-sm font-bold uppercase tracking-tight text-creme-50">
            100PRESSÃO Online
          </span>
          <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-creme-500">
            {evento ? 'Instalar app' : 'Como instalar'}
          </span>
        </span>
      </button>

      {ajuda && !evento && (
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-creme-500">
          {eIOS() ? (
            <>
              No iPhone, toca em <IconePartilhar />{' '}
              <strong className="text-creme-300">Partilhar</strong> e depois em{' '}
              <strong className="text-creme-300">«Adicionar ao Ecrã Principal»</strong>.
            </>
          ) : (
            <>
              Abre <strong className="text-creme-300">100pressao.pt/restaurante</strong> no
              telemóvel. No Android, o menu do Chrome tem{' '}
              <strong className="text-creme-300">Instalar aplicação</strong>; no iPhone é
              Partilhar → Adicionar ao Ecrã Principal.
            </>
          )}
        </p>
      )}
    </div>
  )
}

export default InstalarApp
