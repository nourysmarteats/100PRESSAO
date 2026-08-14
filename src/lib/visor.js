// Canal de comunicação PDV → Visor do cliente.
//
// O visor é um tablet sem autenticação junto à caixa. Recebe tudo por Supabase
// Broadcast, que é efémero: uma mensagem enviada enquanto o visor está a
// arrancar (ou depois de uma quebra de rede) perde-se para sempre. Por isso
// este módulo faz três coisas que o código anterior não fazia:
//
//   1. Guarda sempre o último estado emitido (ultimoRef). Se o visor pedir
//      re-sincronização, respondemos com esse snapshot.
//   2. Só envia depois do canal estar em SUBSCRIBED, e ao ligar despeja logo
//      o último estado — elimina a corrida em que os primeiros itens do
//      carrinho eram enviados antes da ligação abrir.
//   3. Centraliza o canal num único sítio, para que tanto a venda manual como
//      os pedidos activos possam escrever no visor sem se pisarem.

import { useCallback, useEffect, useRef } from 'react'
import { supabase, supabasePublico } from './supabase'

export const CANAL_VISOR = 'pdv-visor'

// PDV → visor: estado completo do que o cliente deve ver neste momento.
export const EV_ESTADO = 'estado'
// PDV → visor: venda fechada, mostra o agradecimento.
export const EV_CONCLUIDA = 'venda_concluida'
// Visor → PDV: "acabei de arrancar, diz-me o que estás a mostrar".
export const EV_PEDIR_ESTADO = 'pedir_estado'

// Estado neutro — o visor volta ao ecrã de boas-vindas.
export const ESTADO_INATIVO = {
  itens: [], // [{ chave, nome, quantidade, valor }] — valor = total da linha
  total: 0,
  numero: null, // nº do pedido, quando existe
  origem: null, // 'pedido' | 'manual'
  metodo: null, // método de pagamento escolhido
  recebido: null, // dinheiro entregue pelo cliente
  troco: null, // troco a devolver
  pedirNif: false, // mostrar o pedido de NIF no visor
  aProcessar: false, // pagamento em curso
}

// Instrução que o cliente lê quando o operador escolhe o método. É a peça que
// faltava: o visor mostrava o total mas nunca dizia ao cliente o que fazer.
export const INSTRUCAO_METODO = {
  dinheiro: 'Pagamento em numerário',
  multibanco: 'Insira ou aproxime o cartão do terminal',
  cartao: 'Insira ou aproxime o cartão do terminal',
  mbway: 'Confirme o pagamento na app MB Way do seu telemóvel',
}

// Normaliza uma linha de order_items (painel de pedidos) ou do carrinho manual
// para a forma única que o visor sabe desenhar. Evita o bug antigo do visor,
// que multiplicava `preco × quantidade` e não servia para os order_items, onde
// o campo se chama `preco_unitario`.
export function linhaVisor(chave, nome, quantidade, valorLinha) {
  return {
    chave: String(chave),
    nome,
    quantidade: Number(quantidade) || 0,
    valor: Number(valorLinha) || 0,
  }
}

export function totalLinhas(itens) {
  return (itens || []).reduce((soma, i) => soma + (Number(i.valor) || 0), 0)
}

/**
 * Liga o PDV ao visor. Devolve `emitir` (estado parcial, fundido com o
 * ESTADO_INATIVO), `emitirConcluida` e `limpar`.
 *
 * Deve ser usado UMA vez por PDV — o canal é partilhado pelos painéis.
 */
export function useCanalVisor() {
  const canalRef = useRef(null)
  const prontoRef = useRef(false)
  const ultimoRef = useRef(ESTADO_INATIVO)

  useEffect(() => {
    const sb = supabasePublico || supabase
    if (!sb) return

    const canal = sb.channel(CANAL_VISOR)
    canalRef.current = canal

    // O visor pede o estado quando arranca ou volta de uma quebra de rede.
    canal.on('broadcast', { event: EV_PEDIR_ESTADO }, () => {
      if (!prontoRef.current) return
      canal.send({ type: 'broadcast', event: EV_ESTADO, payload: ultimoRef.current })
    })

    canal.subscribe((status) => {
      const ligado = status === 'SUBSCRIBED'
      prontoRef.current = ligado
      // Ao ligar, despeja o estado acumulado — nada se perde no arranque.
      if (ligado) {
        canal.send({ type: 'broadcast', event: EV_ESTADO, payload: ultimoRef.current })
      }
    })

    return () => {
      prontoRef.current = false
      canalRef.current = null
      sb.removeChannel(canal)
    }
  }, [])

  const emitir = useCallback((parcial) => {
    const estado = { ...ESTADO_INATIVO, ...parcial }
    ultimoRef.current = estado
    if (prontoRef.current) {
      canalRef.current?.send({ type: 'broadcast', event: EV_ESTADO, payload: estado })
    }
  }, [])

  const limpar = useCallback(() => {
    ultimoRef.current = ESTADO_INATIVO
    if (prontoRef.current) {
      canalRef.current?.send({ type: 'broadcast', event: EV_ESTADO, payload: ESTADO_INATIVO })
    }
  }, [])

  const emitirConcluida = useCallback((payload = {}) => {
    ultimoRef.current = ESTADO_INATIVO
    if (prontoRef.current) {
      canalRef.current?.send({ type: 'broadcast', event: EV_CONCLUIDA, payload })
    }
  }, [])

  return { emitir, limpar, emitirConcluida }
}
