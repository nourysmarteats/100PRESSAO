// Regras do registo de empresas de entrega (operadores de frota).
// Ata de 2026-10-12: as empresas registam-se elas próprias e o admin aprova.
//
// O servidor (registar_empresa_entrega) valida tudo outra vez. Isto existe
// para o erro aparecer com a pessoa à frente do formulário, não para proteger
// a base de dados.
import { nifValido } from './nif.js'

export const CONFIG_FALLBACK = {
  registo_aberto: false,
  termos_versao: '2026-10-13.v2',
  aviso_versao: '2026-10-13.v2',
}

export function config(valor) {
  return { ...CONFIG_FALLBACK, ...(valor && typeof valor === 'object' ? valor : {}) }
}

export const ESTADOS = {
  pendente: 'Por decidir',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  suspensa: 'Suspensa',
  terminada: 'Terminada',
}

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')

// Aceita "912 345 678", "+351 912345678", "00351912345678".
export function normalizarTelefone(v) {
  let t = String(v ?? '').trim().replace(/[^\d+]/g, '')
  if (t.startsWith('00')) t = `+${t.slice(2)}`
  return t
}

export const telefoneValido = (v) => /^\+?\d{9,15}$/.test(normalizarTelefone(v))
export const emailValido = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? '').trim())

// "2,50" e "2.50" valem o mesmo. Devolve NaN se não for número.
export function paraNumero(v) {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim().replace(',', '.')
  return s === '' ? NaN : Number(s)
}

export const EXPERIENCIAS = [
  ['regular', 'Sim, fazemos regularmente'],
  ['alguma', 'Alguma experiência'],
  ['nenhuma', 'Ainda não'],
]

const entre = (v, min, max) => {
  const n = paraNumero(v)
  return Number.isFinite(n) && n >= min && n <= max
}

export function validar(d) {
  const erros = []
  if (String(d.nome_legal ?? '').trim().length < 2) erros.push('Indique o nome legal da empresa.')
  if (!nifValido(d.nipc)) erros.push('O NIPC não é válido.')
  if (String(d.zona ?? '').trim().length < 2) erros.push('Indique as zonas de cobertura.')
  if (d.n_estafetas !== '' && d.n_estafetas != null) {
    const n = Number(d.n_estafetas)
    if (!Number.isInteger(n) || n < 0 || n > 500) erros.push('O número de estafetas tem de ser um número inteiro.')
  }
  if (d.experiencia && !EXPERIENCIAS.some(([id]) => id === d.experiencia)) erros.push('Escolha uma opção de experiência.')
  if (String(d.contacto_nome ?? '').trim().length < 2) erros.push('Indique o nome da pessoa de contacto.')
  if (!emailValido(d.contacto_email)) erros.push('O email não parece válido.')
  if (!telefoneValido(d.contacto_telefone)) erros.push('O telefone não parece válido.')

  if (!entre(d.tarifa_recolha, 0, 50)) erros.push('A tarifa de recolha tem de estar entre 0 e 50 €.')
  if (!entre(d.tarifa_entrega, 0, 50)) erros.push('A tarifa de entrega tem de estar entre 0 e 50 €.')
  if (!entre(d.km_incluidos, 0, 30)) erros.push('Os quilómetros incluídos têm de estar entre 0 e 30.')
  if (!entre(d.tarifa_km_adicional, 0, 10)) erros.push('O valor por quilómetro adicional tem de estar entre 0 e 10 €.')
  if (String(d.suplementos ?? '').length > 1000) erros.push('Os suplementos têm no máximo 1000 caracteres.')

  if (!d.mochila_termica) erros.push('Confirme o uso de mochila ou caixa térmica própria para alimentos.')
  if (!d.seguros) erros.push('Confirme os seguros de acidentes de trabalho e de responsabilidade civil.')
  if (!d.aceita_termos) erros.push('É preciso aceitar as condições de registo.')
  if (!d.aviso_lido) erros.push('Confirme que leu o aviso de privacidade.')
  return erros
}

const dinheiro = (v) => Math.round(paraNumero(v) * 100) / 100
const textoOuNulo = (v) => String(v ?? '').trim() || null

// Argumentos da função do servidor (registar_empresa_entrega v2), já limpos.
export function parametros(d) {
  return {
    p_nome_legal: String(d.nome_legal).trim(),
    p_nome_comercial: textoOuNulo(d.nome_comercial),
    p_nipc: soDigitos(d.nipc),
    p_contacto_nome: String(d.contacto_nome).trim(),
    p_contacto_email: String(d.contacto_email).trim().toLowerCase(),
    p_contacto_telefone: normalizarTelefone(d.contacto_telefone),
    p_zona: String(d.zona).trim(),
    p_n_estafetas: d.n_estafetas === '' || d.n_estafetas == null ? null : Number(d.n_estafetas),
    p_horarios: textoOuNulo(d.horarios),
    p_experiencia: d.experiencia || null,
    p_tarifa_recolha: dinheiro(d.tarifa_recolha),
    p_tarifa_entrega: dinheiro(d.tarifa_entrega),
    p_km_incluidos: dinheiro(d.km_incluidos),
    p_tarifa_km_adicional: dinheiro(d.tarifa_km_adicional),
    p_suplementos: textoOuNulo(d.suplementos),
    p_mochila_termica: Boolean(d.mochila_termica),
    p_seguros: Boolean(d.seguros),
    p_aceita_termos: Boolean(d.aceita_termos),
    p_aviso_lido: Boolean(d.aviso_lido),
  }
}

// Exemplo para a página: quanto custaria uma entrega de X km com a proposta escrita.
export function exemploPreco(d, km) {
  const r = paraNumero(d.tarifa_recolha)
  const e = paraNumero(d.tarifa_entrega)
  const inc = paraNumero(d.km_incluidos)
  const extra = paraNumero(d.tarifa_km_adicional)
  if (![r, e, inc, extra].every(Number.isFinite)) return null
  return Math.round((r + e + Math.max(0, km - inc) * extra) * 100) / 100
}

// As mensagens do servidor já estão em português e são para mostrar;
// o resto (rede, erro interno) não.
const MENSAGENS_DO_SERVIDOR = ['22023', '23505', 'P0001']
export function mensagemErro(error) {
  if (error && MENSAGENS_DO_SERVIDOR.includes(error.code) && error.message) return error.message
  return 'Não foi possível enviar o registo. Tente daqui a pouco ou escreva para geral@100pressao.pt.'
}

// Custo previsto de uma entrega com o preço acordado.
export const custoEntrega = (empresa, km) =>
  Math.round((Number(empresa?.tarifa_base || 0) + Number(empresa?.tarifa_km || 0) * Number(km || 0)) * 100) / 100
