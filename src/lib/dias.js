// Rotação por dia da semana — pratos que não se fazem todos os dias.
//
// Nasceu do Almoço PF: cinco pratos a rodar de segunda a sexta, dois por dia.
// Antes disto o único controlo era o interruptor `disponivel`, mexido à mão
// todas as manhãs — e esquecer-se de o desligar fazia um cliente pagar online
// um prato que hoje não se cozinha.
//
// A mesma regra existe no servidor (função servido_hoje), porque isto não pode
// viver só aqui: um separador aberto desde ontem encomendaria o prato de ontem.
// Aqui é para o cliente não ver o que não pode pedir; lá é para não poder pedir.

// 1 = segunda … 7 = domingo (ISO-8601, igual ao isodow do Postgres).
export const DIAS_SEMANA = [
  { n: 1, curto: 'Seg', nome: 'Segunda' },
  { n: 2, curto: 'Ter', nome: 'Terça' },
  { n: 3, curto: 'Qua', nome: 'Quarta' },
  { n: 4, curto: 'Qui', nome: 'Quinta' },
  { n: 5, curto: 'Sex', nome: 'Sexta' },
  { n: 6, curto: 'Sáb', nome: 'Sábado' },
  { n: 7, curto: 'Dom', nome: 'Domingo' },
]

/**
 * Dia da semana em Lisboa, 1..7.
 *
 * Não usa getDay() do dispositivo: um tablet mal configurado, ou um cliente a
 * encomendar de outro fuso, veria a ementa do dia errado. A casa é em Carnaxide
 * e o almoço é o de Carnaxide.
 */
export function diaDeHoje(agora = new Date()) {
  const emLisboa = new Date(agora.toLocaleString('en-US', { timeZone: 'Europe/Lisbon' }))
  const d = emLisboa.getDay() // 0 = domingo
  return d === 0 ? 7 : d
}

/** Sem dias marcados = servido todos os dias. É o que mantém a ementa inteira a funcionar. */
export const servidoHoje = (dias, hoje = diaDeHoje()) =>
  !Array.isArray(dias) || dias.length === 0 || dias.includes(hoje)

/** "Seg e Qui", "Seg, Qua e Sex", "Todos os dias". */
export function rotuloDias(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return 'Todos os dias'
  if (dias.length === 7) return 'Todos os dias'
  const nomes = DIAS_SEMANA.filter((d) => dias.includes(d.n)).map((d) => d.curto)
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
