import { motion } from 'framer-motion'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-100 px-6">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-2xl text-center"
      >
        <motion.h1
          variants={item}
          className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900"
        >
          100PRESSAO
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 text-lg sm:text-xl text-slate-600"
        >
          Título placeholder — substitui por uma proposta de valor clara e direta.
        </motion.p>

        <motion.div variants={item} className="mt-10">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-slate-900 px-8 py-3 text-white font-medium shadow-lg hover:bg-slate-700 transition-colors"
          >
            Começar
          </motion.button>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Hero
