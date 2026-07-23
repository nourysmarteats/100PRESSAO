// Fase 0 do canal de encomendas remoto (take-away + entrega): capta pedidos
// pelo WhatsApp Business, sem backend. Serve de sonda de procura antes de
// automatizar o fluxo no site. O pedido, a hora, a morada e o pagamento
// combinam-se no chat. O fluxo de pedido à mesa (/cardapio) fica inalterado.
const NUMERO = '351935995011' // +351 935 995 011 — WhatsApp Business (geral@)

const linkWhatsApp = (texto) =>
  `https://wa.me/${NUMERO}?text=${encodeURIComponent(texto)}`

const MSG_LEVAR =
  'Olá 100PRESSÃO! 🥡 Quero encomendar *para levar*.\n\nHora a que passo a levantar: \nO meu pedido:\n– '
const MSG_ENTREGA =
  'Olá 100PRESSÃO! 🛵 Quero encomendar *com entrega*.\n\nMorada de entrega: \nO meu pedido:\n– '

function IconeWhatsApp() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.5 2.1 7.9L.4 31.5l7.8-2c2.3 1.3 4.9 1.9 7.6 1.9h.1c8.6 0 15.6-7 15.6-15.6C31.5 7.4 24.6.5 16 .5zm0 28.6c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.6 1.2 1.2-4.5-.3-.5C3.9 21 3.2 18.5 3.2 16 3.2 8.9 9 3.2 16 3.2 23 3.2 28.8 8.9 28.8 16S23 29.1 16 29.1zm7.9-9.6c-.4-.2-2.6-1.3-3-1.4-.4-.1-.7-.2-1 .2-.3.4-1.1 1.4-1.4 1.7-.3.3-.5.3-.9.1-.4-.2-1.8-.7-3.5-2.1-1.3-1.1-2.1-2.5-2.4-2.9-.3-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.3-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-1-2.3-1.3-3.2-.3-.8-.7-.7-1-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 3.9 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9 1 .3 1.9.3 2.6.2.8-.1 2.6-1.1 3-2.1.4-1 .4-1.9.3-2.1-.1-.2-.4-.3-.8-.5z" />
    </svg>
  )
}

const BOTAO =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]'

function EncomendaWhatsApp({ className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-creme-300 bg-white/70 p-6 sm:p-8 ${className}`}
    >
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-grafite-900 sm:text-2xl">
        Levar ou receber em casa
      </h2>
      <p className="mt-2 text-grafite-600">
        Faz a tua encomenda pelo WhatsApp — combinamos o pedido, a hora e o
        pagamento por lá.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={linkWhatsApp(MSG_LEVAR)}
          target="_blank"
          rel="noopener noreferrer"
          className={BOTAO}
        >
          <IconeWhatsApp /> Para levar
        </a>
        <a
          href={linkWhatsApp(MSG_ENTREGA)}
          target="_blank"
          rel="noopener noreferrer"
          className={BOTAO}
        >
          <IconeWhatsApp /> Entrega
        </a>
      </div>
    </section>
  )
}

export default EncomendaWhatsApp
