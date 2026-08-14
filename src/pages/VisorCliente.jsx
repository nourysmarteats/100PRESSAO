// Visor do cliente — tablet pequeno junto à caixa registadora.
//
// Sem autenticação: só recebe do canal 'pdv-visor'. Mostra o que o cliente
// precisa mesmo de ver para conferir o que está a pagar — nº do pedido,
// linhas, total, método de pagamento com instrução, troco e pedido de NIF.
//
// Ao arrancar (ou ao voltar de uma quebra de rede) pede o estado ao PDV: o
// broadcast é efémero e antes disto um simples refresh do tablet deixava o
// visor em branco a meio de uma venda.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabasePublico as supabase } from '../lib/supabase'
import { fmt, METODOS_PAGAMENTO } from '../lib/pedidos'
import {
  CANAL_VISOR,
  EV_ESTADO,
  EV_CONCLUIDA,
  EV_PEDIR_ESTADO,
  INSTRUCAO_METODO,
} from '../lib/visor'
import logoStamp from '../assets/logo-100pressao.png'

const rotuloMetodo = (id) => METODOS_PAGAMENTO.find((m) => m.id === id)?.rotulo || ''

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
  const [estado, setEstado] = useState(null) // null = inactivo
  const [conclusao, setConclusao] = useState(null) // { troco, numero } | null
  const [ligado, setLigado] = useState(false)
  const canalRef = useRef(null)
  const temporizadorRef = useRef(null)

  // Pede ao PDV o estado actual. Chamado ao ligar e sempre que a ligação volta.
  const pedirEstado = useCallback(() => {
    canalRef.current?.send({ type: 'broadcast', event: EV_PEDIR_ESTADO, payload: {} })
  }, [])

  useEffect(() => {
    if (!supabase) return
    const canal = supabase
      .channel(CANAL_VISOR)
      .on('broadcast', { event: EV_ESTADO }, ({ payload }) => {
        const temItens = Array.isArray(payload?.itens) && payload.itens.length > 0
        setEstado(temItens ? payload : null)
        if (temItens) {
          setConclusao(null)
          clearTimeout(temporizadorRef.current)
        }
      })
      .on('broadcast', { event: EV_CONCLUIDA }, ({ payload }) => {
        setEstado(null)
        setConclusao(payload || {})
        clearTimeout(temporizadorRef.current)
        // Com troco a devolver o cliente precisa de mais tempo para conferir.
        const espera = payload?.troco > 0 ? 8000 : 4000
        temporizadorRef.current = setTimeout(() => setConclusao(null), espera)
      })

    canal.subscribe((status) => {
      const ok = status === 'SUBSCRIBED'
      setLigado(ok)
      if (ok) pedirEstado()
    })
    canalRef.current = canal

    // Rede de segurança: se o tablet adormecer e acordar, o Supabase religa
    // sozinho mas o estado que perdemos entretanto não volta. Ao reganhar
    // visibilidade voltamos a pedir.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') pedirEstado()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', pedirEstado)

    return () => {
      clearTimeout(temporizadorRef.current)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', pedirEstado)
      canalRef.current = null
      supabase.removeChannel(canal)
    }
  }, [pedirEstado])

  const idle = !estado && !conclusao
  const instrucao = estado?.metodo ? INSTRUCAO_METODO[estado.metodo] : null

  return (
    <div className="relative flex min-h-dvh flex-col bg-grafite-950 px-10 py-8">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoStamp} alt="" className="h-14 w-14 rounded-full mix-blend-lighten" />
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-creme-50">
            100PRESSÃO
          </span>
          {estado?.numero != null && (
            <span className="rounded-full border border-ambar-500/40 px-4 py-1 font-display text-lg font-bold text-ambar-400">
              Pedido nº {estado.numero}
            </span>
          )}
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

          {conclusao && (
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
              {conclusao.troco > 0 ? (
                <div className="mt-8 rounded-2xl border border-ambar-500/40 bg-ambar-500/5 px-10 py-6">
                  <p className="text-lg uppercase tracking-[0.3em] text-creme-300">
                    O seu troco
                  </p>
                  <p className="mt-2 font-display text-6xl font-bold text-creme-50">
                    {fmt(conclusao.troco)}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xl uppercase tracking-[0.3em] text-creme-500/50">
                  Volte sempre
                </p>
              )}
            </motion.div>
          )}

          {estado && (
            <motion.div
              key="conta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl"
            >
              <AnimatePresence>
                <ul className="max-h-[38vh] space-y-5 overflow-y-auto pr-1">
                  {estado.itens.map((item) => (
                    <motion.li
                      key={item.chave}
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
                        {fmt(item.valor)}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </AnimatePresence>

              {/* Total */}
              <div className="mt-8 flex items-center justify-between rounded-2xl border border-ambar-500/40 bg-ambar-500/5 px-6 py-5">
                <span className="text-xl font-semibold uppercase tracking-widest text-creme-300">
                  Total
                </span>
                <motion.span
                  key={estado.total}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className="font-display text-6xl font-bold text-ambar-400"
                >
                  {fmt(estado.total)}
                </motion.span>
              </div>

              {/* Instrução de pagamento — o que fazer a seguir */}
              {instrucao && (
                <motion.div
                  key={estado.metodo}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 rounded-2xl border border-grafite-700 bg-grafite-900 px-6 py-4 text-center"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-creme-500/50">
                    {rotuloMetodo(estado.metodo)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-creme-50">
                    {estado.aProcessar ? 'A processar o pagamento…' : instrucao}
                  </p>
                </motion.div>
              )}

              {/* Dinheiro entregue e troco, em directo */}
              {estado.troco != null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-stretch gap-4"
                >
                  <div className="flex-1 rounded-2xl border border-grafite-700 px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-creme-500/50">
                      Recebido
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-creme-200">
                      {fmt(estado.recebido)}
                    </p>
                  </div>
                  <div className="flex-1 rounded-2xl border border-ambar-500/40 bg-ambar-500/5 px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ambar-500/70">
                      Troco
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-ambar-400">
                      {fmt(estado.troco)}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Pedido de NIF — só no numerário, onde a fatura é opcional */}
              {estado.pedirNif && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 rounded-2xl border border-creme-500/20 px-6 py-4 text-center text-xl font-semibold text-creme-200"
                >
                  Deseja fatura com contribuinte? Indique o seu NIF ao balcão.
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Estado da ligação — discreto, mas o operador precisa de o ver */}
      {!ligado && (
        <p className="pointer-events-none fixed bottom-4 left-5 text-xs font-semibold uppercase tracking-widest text-red-400/60">
          ● Sem ligação à caixa
        </p>
      )}

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
