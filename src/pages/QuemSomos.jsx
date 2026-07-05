import { motion, useReducedMotion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

// Vídeo stock placeholder (Mixkit, licença livre) — barman a tirar cerveja à pressão
const VIDEO_URL = 'https://assets.mixkit.co/videos/8709/8709-1080.mp4'

const HISTORIA = [
  'Chamo-me Leandro Miranda e o 100PRESSÃO nasceu de uma vida dividida ao meio, e de uma sócia que acreditou nisso antes de mim.',
  'Vivo na Bélgica há anos, terra onde a cerveja não é só bebida. É cultura, é rigor, é paciência. Ali aprendi o que separa uma cerveja feita a martelo de uma cerveja feita a sério. Mas o coração continua do outro lado, entre Portugal e o Brasil, onde a mesa nunca é só para comer. É para ficar, para contar histórias, para rir alto.',
  'Foi a Neide quem viu a oportunidade primeiro. Quando surgiu a possibilidade de uma loja no Mercado Municipal de Algés, foi ela quem me propôs a sociedade. Foi essa proposta que transformou uma ideia que vivia na minha cabeça há anos num projeto real, com endereço e data para abrir portas.',
  'O 100PRESSÃO é o que acontece quando essas peças se juntam. É um trocadilho, sim, cerveja de pressão, mas é também uma promessa: aqui a pressão é boa. É a pressão do copo bem tirado, do petisco feito na hora, da conversa que não tem pressa de acabar.',
  'Instalados no Mercado Municipal de Algés, trazemos uma cervejaria artesanal com alma luso-brasileira: cerveja europeia a sério, petiscos que atravessam o Atlântico e um atendimento que não conhece formalidades, só hospitalidade.',
  'Não somos uma marca que nasceu numa sala de reuniões. Nascemos de uma saudade, de uma boa cerveja gelada e de uma sócia que disse "vamos fazer isto" no momento certo. O resto construímos todos os dias, copo a copo, mesa a mesa.',
  '100PRESSÃO. A pressão certa, no copo certo.',
]

function Barril({ className }) {
  return (
    <svg viewBox="0 0 90 110" className={className} aria-hidden="true">
      {/* Corpo do barril */}
      <path
        d="M12 14 C8 40 8 70 12 96 C30 102 60 102 78 96 C82 70 82 40 78 14 C60 8 30 8 12 14 Z"
        fill="var(--color-cobre-600)"
      />
      <path
        d="M12 14 C8 40 8 70 12 96 C20 99 30 100.5 40 101 L40 9 C30 9.5 20 11 12 14 Z"
        fill="var(--color-cobre-500)"
      />
      {/* Aduelas */}
      <path d="M32 9.2 L32 100.8" stroke="var(--color-grafite-800)" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M58 9.2 L58 100.8" stroke="var(--color-grafite-800)" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* Arcos */}
      <path d="M10.5 26 C33 32 57 32 79.5 26" stroke="var(--color-creme-300)" strokeWidth="5" fill="none" />
      <path d="M9 55 C33 61 57 61 81 55" stroke="var(--color-creme-300)" strokeWidth="5" fill="none" />
      <path d="M10.5 84 C33 90 57 90 79.5 84" stroke="var(--color-creme-300)" strokeWidth="5" fill="none" />
      {/* Batoque */}
      <circle cx="45" cy="57" r="5" fill="var(--color-grafite-900)" />
      <circle cx="45" cy="57" r="2.5" fill="var(--color-ambar-500)" />
    </svg>
  )
}

function BarrisAnimados() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-100px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.18 } } }}
      className="flex items-end justify-center gap-8 sm:gap-14"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, x: -140, rotate: -200 },
            show: {
              opacity: 1,
              x: 0,
              rotate: 0,
              transition: prefersReducedMotion
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 60, damping: 14 },
            },
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { y: [0, -5, 0], transition: { duration: 3.5 + i, repeat: Infinity, ease: 'easeInOut' } }
          }
          className={i === 1 ? 'w-28 sm:w-36' : 'w-20 sm:w-28'}
        >
          <Barril className="h-auto w-full drop-shadow-lg" />
        </motion.div>
      ))}
    </motion.div>
  )
}

function QuemSomos() {
  return (
    <main className="bg-creme-50 text-grafite-800">
      {/* a. Banner com vídeo em loop */}
      <section className="relative h-[55vh] min-h-80 overflow-hidden bg-grafite-900 sm:h-[65vh]">
        <video
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-grafite-950/85 via-grafite-950/20 to-grafite-950/40" />
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-6 pb-12"
        >
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-creme-50 sm:text-6xl">
            Quem Somos
          </h1>
          <p className="mt-2 max-w-xl text-lg text-creme-300">
            Uma história com dois lados do Atlântico e um balcão no meio.
          </p>
        </motion.div>
      </section>

      {/* b. Barris estilizados animados */}
      <section className="border-b border-creme-300 bg-creme-100/60 py-16 sm:py-20">
        <BarrisAnimados />
      </section>

      {/* c. História real */}
      <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="space-y-6">
          {HISTORIA.map((paragrafo, i) => (
            <motion.p
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className={
                i === HISTORIA.length - 1
                  ? 'font-display text-2xl font-bold uppercase tracking-tight text-grafite-900'
                  : 'text-lg leading-relaxed text-grafite-600'
              }
            >
              {paragrafo}
            </motion.p>
          ))}
        </div>
      </section>
    </main>
  )
}

export default QuemSomos
