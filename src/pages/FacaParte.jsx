import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SEOHead from '../components/SEOHead'
import { SEO_PAGES } from '../seo/pages'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

function FacaParte() {
  return (
    <main className="bg-creme-50 text-grafite-800">
      <SEOHead {...SEO_PAGES.facaParte} />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-grafite-900 sm:text-5xl">
            Faça Parte
          </h1>
          <p className="mt-3 max-w-xl text-lg text-grafite-600">
            A casa cresce copo a copo, e há lugar para quem quiser crescer connosco.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="rounded-2xl border border-creme-300 bg-white/60 p-8"
          >
            <h2 className="font-display text-2xl font-bold uppercase text-grafite-900">
              Trabalhar Connosco
            </h2>
            <p className="mt-4 leading-relaxed text-grafite-600">
              Gostas de cerveja bem tirada, de balcão cheio e de gente? Deixa-nos
              a tua candidatura e falamos. Lemos todas — e respondemos, mesmo
              quando a resposta é não.
            </p>
            <Link
              to="/colaborador"
              className="mt-5 inline-block rounded-xl bg-cobre-600 px-6 py-3 font-display text-sm font-bold uppercase tracking-widest text-creme-50 transition hover:bg-cobre-700"
            >
              Candidatar-me
            </Link>
          </motion.section>

          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-creme-300 bg-white/60 p-8"
          >
            <h2 className="font-display text-2xl font-bold uppercase text-grafite-900">
              Parcerias &amp; Franquia
            </h2>
            <p className="mt-4 leading-relaxed text-grafite-600">
              Produtores, marcas e espaços com vontade de levar a pressão certa
              mais longe: estamos abertos a conversas sobre parcerias e, no
              futuro, modelos de franquia. Conta-nos a tua ideia através do{' '}
              <a
                href="https://wa.me/351935995011"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cobre-600 underline-offset-4 hover:underline"
              >
                WhatsApp
              </a>{' '}
              ou por email.
            </p>
          </motion.section>
        </div>
      </div>
    </main>
  )
}

export default FacaParte
