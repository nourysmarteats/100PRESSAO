// Página de aterragem da instalação — /app.
//
// Existe para ser o destino de um QR code impresso. Um QR não instala nada:
// abre um endereço. O que se pode fazer é garantir que esse endereço não é a
// loja inteira (onde o cliente teria de procurar o botão no rodapé), mas uma
// página curta que só trata disto.
//
// Endereço propositadamente curto — 100pressao.pt/app — para caber num cartão
// e ser escrito à mão por quem não quiser apontar a câmara.
import { Link } from 'react-router-dom'
import SEOHead from '../components/SEOHead'
import {
  useInstalacao,
  IconeAndroid,
  IconeApple,
  IconePartilhar,
} from '../components/InstalarApp'
import logoStamp from '../assets/logo-100pressao.png'
import { useState } from 'react'

const VANTAGENS = [
  'Preços mais baixos do que nas plataformas de entrega',
  'Entrega em casa ou levantamento no restaurante',
  'Abre como uma app, sem ocupar espaço no telemóvel',
]

const BOTAO =
  'flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-widest transition-colors'

function InstalarPWA() {
  const { instalada, instalar } = useInstalacao()
  const [passos, setPassos] = useState(null) // null | 'ios' | 'android'

  async function android() {
    const abriu = await instalar()
    setPassos(abriu ? null : 'android')
  }

  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead
        title="Instalar a app | 100PRESSÃO"
        description="Guarda o 100PRESSÃO Online no telemóvel e encomenda direto, sem taxas de plataforma."
        path="/app"
        manifest="/restaurante.webmanifest"
      />

      <div className="mx-auto max-w-md px-6 py-14 text-center sm:py-20">
        <img
          src={logoStamp}
          alt="100PRESSÃO"
          width="640"
          height="640"
          className="mx-auto h-28 w-28 rounded-full bg-grafite-900"
        />
        <h1 className="mt-6 font-display text-3xl font-bold uppercase leading-none tracking-tight text-grafite-900 sm:text-4xl">
          100PRESSÃO Online
        </h1>
        <p className="mt-3 text-grafite-600">
          Encomenda direto de nós, sem taxas de plataforma. Guarda no telemóvel e
          fica a um toque.
        </p>

        {instalada ? (
          <div className="mt-8 rounded-2xl border border-creme-300 bg-white/70 p-6">
            <p className="font-display text-xl font-bold uppercase text-ambar-600">Já está instalada ✓</p>
            <p className="mt-2 text-sm text-grafite-600">
              Encontras o ícone no ecrã principal do teu telemóvel.
            </p>
            <Link
              to="/restaurante"
              className={`${BOTAO} mt-5 bg-ambar-500 text-grafite-950 hover:bg-ambar-400`}
            >
              Encomendar agora
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={android}
                className={`${BOTAO} cursor-pointer bg-ambar-500 text-grafite-950 hover:bg-ambar-400`}
              >
                <IconeAndroid />
                Instalar · Android e PC
              </button>
              {/* A Apple não permite instalar por código; este botão ensina. */}
              <button
                type="button"
                onClick={() => setPassos((v) => (v === 'ios' ? null : 'ios'))}
                aria-expanded={passos === 'ios'}
                className={`${BOTAO} cursor-pointer border border-creme-300 text-grafite-600 hover:border-grafite-600 hover:text-grafite-900`}
              >
                <IconeApple />
                Instalar · iPhone e iPad
              </button>
            </div>

            {passos === 'ios' && (
              <ol className="mt-4 list-decimal space-y-1.5 rounded-2xl border border-creme-300 bg-white/70 p-5 pl-9 text-left text-sm text-grafite-600">
                <li>
                  Abre esta página no <strong className="text-grafite-900">Safari</strong>.
                </li>
                <li>
                  Toca em <IconePartilhar /> <strong className="text-grafite-900">Partilhar</strong>,
                  em baixo.
                </li>
                <li>
                  Escolhe <strong className="text-grafite-900">Adicionar ao Ecrã Principal</strong>.
                </li>
              </ol>
            )}

            {passos === 'android' && (
              <p className="mt-4 rounded-2xl border border-creme-300 bg-white/70 p-5 text-left text-sm text-grafite-600">
                Se a instalação não abrir sozinha, usa o menu{' '}
                <strong className="text-grafite-900">⋮</strong> do Chrome e escolhe{' '}
                <strong className="text-grafite-900">Instalar aplicação</strong>. Nalguns browsers a
                opção chama-se <strong className="text-grafite-900">Adicionar ao ecrã principal</strong>.
              </p>
            )}
          </>
        )}

        <ul className="mx-auto mt-10 max-w-sm space-y-2.5 text-left">
          {VANTAGENS.map((v) => (
            <li key={v} className="flex items-start gap-3 text-sm text-grafite-600">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ambar-500" />
              {v}
            </li>
          ))}
        </ul>

        {/* Quem só quer comer hoje não deve ser obrigado a instalar nada. */}
        {!instalada && (
          <Link
            to="/restaurante"
            className="mt-8 inline-block text-sm font-semibold uppercase tracking-widest text-cobre-600 underline-offset-4 hover:underline"
          >
            Prefiro encomendar sem instalar →
          </Link>
        )}
      </div>
    </main>
  )
}

export default InstalarPWA
