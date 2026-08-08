// Instalação do restaurante online como app. Vive no rodapé, secção
// "Downloads", e por isso está disponível em qualquer página.
//
// PORQUÊ DOIS BOTÕES DIFERENTES, E NÃO DOIS IGUAIS
// No Android e no computador existe API: o browser dispara `beforeinstallprompt`
// e a app instala-se com um toque. No iPhone NÃO existe — a Apple não expõe
// nada que permita adicionar ao ecrã principal por código. O único caminho é o
// utilizador fazer Partilhar → Adicionar ao Ecrã Principal.
// Daí um botão que instala e outro que ensina: pôr os dois a prometer o mesmo
// deixaria metade dos clientes a carregar num botão que não faz nada.
//
// PORQUÊ O EVENTO É GUARDADO AO NÍVEL DO MÓDULO
// O `beforeinstallprompt` dispara uma vez por carregamento de página. Numa SPA,
// se for capturado por um componente que depois desmonta, perde-se — e o
// componente seguinte fica com um botão sem nada por trás. Guardá-lo fora do
// ciclo de vida do React faz com que quem montar a seguir o encontre à espera.
import { useEffect, useState } from 'react'
import logoStamp from '../assets/logo-100pressao.png'

let eventoGuardado = null
const ouvintes = new Set()

function avisar() {
  ouvintes.forEach((f) => f(eventoGuardado))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
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

function IconeAndroid() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M6 9v8a1 1 0 0 0 1 1h1v3a1.5 1.5 0 0 0 3 0v-3h2v3a1.5 1.5 0 0 0 3 0v-3h1a1 1 0 0 0 1-1V9H6Zm-2.5 0A1.5 1.5 0 0 0 2 10.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 9Zm17 0a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 20.5 9ZM15.6 3.9l1-1.5a.35.35 0 0 0-.58-.4l-1.05 1.6A6.5 6.5 0 0 0 12 3c-.72 0-1.4.13-2.02.35L8.93 1.75a.35.35 0 1 0-.58.4l1 1.5A5.6 5.6 0 0 0 6 8h12a5.6 5.6 0 0 0-2.4-4.1ZM9.5 6.2a.65.65 0 1 1 0-1.3.65.65 0 0 1 0 1.3Zm5 0a.65.65 0 1 1 0-1.3.65.65 0 0 1 0 1.3Z" />
    </svg>
  )
}

function IconeApple() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.6c0-2.4 1.96-3.55 2.05-3.6-1.12-1.63-2.86-1.86-3.48-1.88-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.61.02-3.1.94-3.93 2.38-1.68 2.9-.43 7.2 1.2 9.55.8 1.15 1.75 2.44 3 2.39 1.2-.05 1.66-.78 3.11-.78 1.45 0 1.86.78 3.13.76 1.29-.02 2.11-1.17 2.9-2.33.91-1.34 1.29-2.63 1.31-2.7-.03-.01-2.51-.96-2.51-3.83ZM14.9 5.3c.66-.8 1.1-1.92.98-3.03-.95.04-2.1.63-2.78 1.43-.61.71-1.14 1.85-1 2.94 1.06.08 2.14-.54 2.8-1.34Z" />
    </svg>
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

const BOTAO =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors'

function InstalarApp() {
  const [evento, setEvento] = useState(eventoGuardado)
  const [instalada, setInstalada] = useState(false)
  const [passos, setPassos] = useState(null) // null | 'ios' | 'android'

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

  if (instalada) return null

  async function instalarAndroid() {
    if (!evento) {
      // Sem diálogo disponível — por exemplo, num browser que não suporta, ou
      // se o Chrome ainda não considerou a app instalável nesta visita.
      setPassos((v) => (v === 'android' ? null : 'android'))
      return
    }
    setPassos(null)
    evento.prompt()
    await evento.userChoice.catch(() => null)
    eventoGuardado = null // o evento só serve uma vez
    setEvento(null)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-ambar-400">Downloads</h3>

      <div className="mt-4 flex max-w-xs items-center gap-3">
        <img
          src={logoStamp}
          alt=""
          aria-hidden="true"
          width="640"
          height="640"
          className="h-11 w-11 shrink-0 rounded-full bg-grafite-950"
        />
        <span className="font-display text-sm font-bold uppercase leading-tight tracking-tight text-creme-50">
          100PRESSÃO Online
        </span>
      </div>

      <div className="mt-3 flex max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={instalarAndroid}
          className={`${BOTAO} border-ambar-500 bg-ambar-500 text-grafite-950 hover:bg-ambar-400`}
        >
          <IconeAndroid />
          Android e PC
        </button>

        {/* A Apple não permite instalar por código: este botão abre os passos. */}
        <button
          type="button"
          onClick={() => setPassos((v) => (v === 'ios' ? null : 'ios'))}
          aria-expanded={passos === 'ios'}
          className={`${BOTAO} border-creme-500/30 text-creme-200 hover:border-creme-300 hover:text-creme-50`}
        >
          <IconeApple />
          iPhone e iPad
        </button>
      </div>

      {passos === 'ios' && (
        <ol className="mt-3 max-w-xs list-decimal space-y-1 pl-4 text-xs leading-relaxed text-creme-500">
          <li>Abre o site no <strong className="text-creme-300">Safari</strong>.</li>
          <li>Toca em <IconePartilhar /> <strong className="text-creme-300">Partilhar</strong>.</li>
          <li>Escolhe <strong className="text-creme-300">Adicionar ao Ecrã Principal</strong>.</li>
        </ol>
      )}

      {passos === 'android' && (
        <p className="mt-3 max-w-xs text-xs leading-relaxed text-creme-500">
          Se a instalação não abrir, usa o menu <strong className="text-creme-300">⋮</strong> do
          Chrome e escolhe <strong className="text-creme-300">Instalar aplicação</strong>. Em alguns
          browsers (Firefox, Opera) a opção chama-se{' '}
          <strong className="text-creme-300">Adicionar ao ecrã principal</strong>.
        </p>
      )}
    </div>
  )
}

export default InstalarApp
