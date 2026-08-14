// Visor do cliente — tablet pequeno junto à caixa registadora.
// Sem autenticação: só recebe broadcasts do canal 'pdv-visor' e mostra
// o conteúdo do carrinho atual. Segue o mesmo padrão visual do Ecra.jsx.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import { fmt } from '../lib/pedidos'
import logoStamp from '../assets/logo-100pressao.png'

function Relogio() {
  const [hora, setHora] = useState('')
  useEffect(() => {
    const tick = () =>
      setHora(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-display text-2xl font-bold text-creme-300">{hora}</span>
}

function VisorCliente() {
  const [carrinho, setCarrinho] = useState(null) // null = idle
  const [obrigado, setObrigado] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const canal = supabase
      .channel('pdv-visor')
      .on('broadcast', { event: 'carrinho' }, ({ payload }) => {
        const temItens = Array.isArray(payload?.itens) && payload.itens.length > 0
        setCarrinho(temItens ? payload : null)
        setObrigado(false)
      })
      .on('broadcast', { event: 'venda_concluida' }, () => {
        setCarrinho(null)
        setObrigado(true)
        setTimeout(() => setObrigado(false), 4000)
      })
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  const idle = !carrinho && !obrigado

  return (
    <div className="relative flex min-h-dvh flex-col bg-grafite-950 px-10 py-8">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoStamp} alt="" className="h-14 w-14 rounded-full mix-blend-lighten" />
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-creme-50">
            100PRESSÃO
          </span>
        </div>
        <Relogio />
      </header>

      {/* Conteúdo principal */}
      <main className="flex flex-1 flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {idle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="text-center"
            >
              <img
                src={logoStamp}
                alt=""
                className="mx-auto h-28 w-28 rounded-full mix-blend-lighten opacity-60"
              />
              <p className="mt-8 font-display text-5xl font-bold uppercase tracking-tight text-creme-50">
                Bem-vindo!
              </p>
              <p className="mt-4 text-lg uppercase tracking-[0.3em] text-creme-500/50">
                A pressão certa, no seu copo
              </p>
            </motion.div>
          )}

          {obrigado && (
            <motion.div
              key="obrigado"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <p className="font-display text-7xl font-bold uppercase tracking-tight text-ambar-400">
                Obrigado!
              </p>
              <p className="mt-4 text-xl uppercase tracking-[0.3em] text-creme-500/50">
                Volte sempre
              </p>
            </motion.div>
          )}

          {carrinho && (
            <motion.div
              key="carrinho"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl"
            >
              <AnimatePresence>
                <ul className="space-y-5">
                  {carrinho.itens.map((item, i) => (
                    <motion.li
                      key={`${item.product_id}-${i}`}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      className="flex items-center justify-between border-b border-grafite-700/60 pb-5"
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="font-display text-4xl font-bold text-ambar-500">
                          {item.quantidade}×
                        </span>
                        <span className="text-2xl font-semibold text-creme-50">{item.nome}</span>
                      </div>
                      <span className="font-display text-3xl font-bold text-creme-200">
                        {fmt(item.preco * item.quantidade)}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between rounded-2xl border border-ambar-500/40 bg-ambar-500/5 px-6 py-5">
                <span className="text-xl font-semibold uppercase tracking-widest text-creme-300">
                  Total
                </span>
                <motion.span
                  key={carrinho.total}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className="font-display text-6xl font-bold text-ambar-400"
                >
                  {fmt(carrinho.total)}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Link discreto para o PDV — para o operador navegar de volta */}
      <Link
        to="/caixa"
        className="fixed bottom-4 right-5 z-40 rounded-full border border-creme-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-creme-500/30 transition-colors hover:border-creme-500/50 hover:text-creme-300"
      >
        PDV ←
      </Link>
    </div>
  )
}

export default VisorCliente
