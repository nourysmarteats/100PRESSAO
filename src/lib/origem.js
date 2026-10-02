// Origem de campanha das encomendas do restaurante online (2 Out 2026).
//
// Cada colocação (anúncio, post, mensagem de WhatsApp) leva um link com
// ?via=<codigo> (ou ?o=, herança da campanha beta). O código fica guardado
// SÓ EM MEMÓRIA durante a visita: nada é escrito no dispositivo (sem cookies,
// sem localStorage), por isso não depende do aviso de cookies. O preço disso:
// se a pessoa recarregar a página sem o código no URL, a origem perde-se e a
// encomenda conta como 'directo'. Aceitável — os links levam direto à loja.
//
// Primeiro toque vence: se a pessoa chegou por um anúncio e depois navegou
// por um link interno sem código, a origem do anúncio mantém-se.
//
// O servidor (criar_pedido_online → p_origem) volta a validar e normaliza:
// vazio → 'directo', fora do formato → 'invalido'.

import { origemDoUrl, ORIGEM_DIRECTO } from './beta.js'

let origemDaVisita = null

// Chamada a cada mudança de rota. Só regista se o URL trouxer um código.
export function registarOrigem(search) {
  if (origemDaVisita) return origemDaVisita
  const o = origemDoUrl(search)
  if (o !== ORIGEM_DIRECTO) origemDaVisita = o
  return origemDaVisita
}

// Origem a enviar com a encomenda.
export function origemDaEncomenda(searchAtual = '') {
  return registarOrigem(searchAtual) ?? ORIGEM_DIRECTO
}

// Só para os testes.
export function _reiniciarOrigem() {
  origemDaVisita = null
}
