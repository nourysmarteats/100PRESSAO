import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../../lib/supabase'
import { beep } from '../../lib/pedidos'
import logoStamp from '../../assets/logo-100pressao.png'

/*
 * Ecrã público (TV da loja). Sem autenticação de propósito: só lê e
 * mostra números de pedido — nenhum dado pessoal.
 */

function Relogio() {
  const [hora, setHora] = useState('')
  useEffect(() => {
    const tick = () =>
      setHora(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-display text-3xl font-bold text-creme-300">{hora}</span>
}

function Ecra() {
  const [pedidos, setPedidos] = useState([])
  const [flash, setFlash] = useState(false)
  const prontosAnteriores = useRef(new Set())

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('orders')
      .select('id, numero, estado')
      .neq('estado', 'entregue')
      .order('criado_em')
    if (error) return

    // Flash + beep quando um pedido novo entra em "pronto"
    const prontosAgora = new Set(data.filter((p) => p.estado === 'pronto').map((p) => p.id))
    const houveNovoPronto = [...prontosAgora].some((id) => !prontosAnteriores.current.has(id))
    if (houveNovoPronto && prontosAnteriores.current.size >= 0 && pedidos.length > 0) {
      beep()
      setFlash(true)
      setTimeout(() => setFlash(false), 700)
    }
    prontosAnteriores.current = prontosAgora
    setPedidos(data)
  }, [pedidos.length])

  useEffect(() => {
    carregar()
    if (!supabase) return
    const canal = supabase
      .channel('ecra-publico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  const grupos = [
    { id: 'recebido', titulo: 'Recebidos', cor: 'text-creme-500' },
    { id: 'em_preparacao', titulo: 'Em preparação', cor: 'text-creme-50' },
    { id: 'pronto', titulo: 'Prontos: vem buscar!', cor: 'text-ambar-400' },
  ]

  return (
    <div className="relative flex min-h-dvh flex-col bg-grafite-950 px-8 py-6">
      {/* Flash quando fica pronto */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 bg-ambar-400"
          />
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoStamp} alt="" className="h-16 w-16 rounded-full mix-blend-lighten" />
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-creme-50">
            100PRESSÃO
          </span>
        </div>
        <Relogio />
      </header>

      <main className="mt-8 grid flex-1 gap-6 lg:grid-cols-3">
        {grupos.map((g) => {
          const lista = pedidos.filter((p) => p.estado === g.id)
          return (
            <section
              key={g.id}
              className={`rounded-3xl border p-6 ${
                g.id === 'pronto'
                  ? 'border-ambar-500/60 bg-ambar-500/5'
                  : 'border-grafite-700 bg-grafite-900/50'
              }`}
            >
              <h2
                className={`font-display text-xl font-bold uppercase tracking-tight ${g.cor}`}
              >
                {g.titulo}
              </h2>
              <div className="mt-6 flex flex-wrap gap-4">
                <AnimatePresence>
                  {lista.map((p) => (
                    <motion.span
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      className={`flex h-20 min-w-20 items-center justify-center rounded-2xl px-4 font-display text-4xl font-bold ${
                        g.id === 'pronto'
                          ? 'animate-pulse bg-ambar-500 text-grafite-950'
                          : g.id === 'em_preparacao'
                            ? 'border border-creme-500/40 text-creme-50'
                            : 'border border-grafite-700 text-creme-500'
                      }`}
                    >
                      {p.numero}
                    </motion.span>
                  ))}
                </AnimatePresence>
                {lista.length === 0 && <p className="text-creme-500/60">—</p>}
              </div>
            </section>
          )
        })}
      </main>

      <footer className="mt-6 text-center text-sm uppercase tracking-[0.3em] text-creme-500/60">
        A pressão certa, no seu copo!
      </footer>
    </div>
  )
}

export default Ecra
