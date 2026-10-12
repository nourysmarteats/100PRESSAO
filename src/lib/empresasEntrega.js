// Regras do registo de empresas de entrega (operadores de frota).
// Ata de 2026-10-12: as empresas registam-se elas próprias e o admin aprova.
//
// O servidor (registar_empresa_entrega) valida tudo outra vez. Isto existe
// para o erro aparecer com a pessoa à frente do formulário, não para proteger
// a base de dados.
import { nifValido } from './nif.js'

export const CONFIG_FALLBACK = {
  registo_aberto: false,
  termos_versao: '2026-10-12.v1',
  aviso_versao: '2026-10-12.v1',
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

export function validar(d) {
  const erros = []
  if (String(d.nome_legal ?? '').trim().length < 2) erros.push('Indica o nome legal da empresa.')
  if (!nifValido(d.nipc)) erros.push('O NIPC não é válido.')
  if (String(d.contacto_nome ?? '').trim().length < 2) erros.push('Indica o nome da pessoa de contacto.')
  if (!emailValido(d.contacto_email)) erros.push('O email não parece válido.')
  if (!telefoneValido(d.contacto_telefone)) erros.push('O telefone não parece válido.')

  const base = paraNumero(d.tarifa_base)
  const km = paraNumero(d.tarifa_km)
  if (!(base >= 0 && base <= 50)) erros.push('O valor por entrega tem de estar entre 0 e 50 €.')
  if (!(km >= 0 && km <= 10)) erros.push('O valor por km tem de estar entre 0 e 10 €.')

  if (d.n_estafetas !== '' && d.n_estafetas != null) {
    const n = Number(d.n_estafetas)
    if (!Number.isInteger(n) || n < 0 || n > 500) erros.push('O número de estafetas tem de ser um número inteiro.')
  }
  if (!d.aceita_termos) erros.push('É preciso aceitar as condições de registo.')
  if (!d.aviso_lido) erros.push('Confirma que leste o aviso de privacidade.')
  return erros
}

// Argumentos da função do servidor, já limpos.
export function parametros(d) {
  return {
    p_nome_legal: String(d.nome_legal).trim(),
    p_nome_comercial: String(d.nome_comercial ?? '').trim() || null,
    p_nipc: soDigitos(d.nipc),
    p_contacto_nome: String(d.contacto_nome).trim(),
    p_contacto_email: String(d.contacto_email).trim().toLowerCase(),
    p_contacto_telefone: normalizarTelefone(d.contacto_telefone),
    p_n_estafetas: d.n_estafetas === '' || d.n_estafetas == null ? null : Number(d.n_estafetas),
    p_zona: String(d.zona ?? '').trim() || null,
    p_tarifa_base: Math.round(paraNumero(d.tarifa_base) * 100) / 100,
    p_tarifa_km: Math.round(paraNumero(d.tarifa_km) * 100) / 100,
    p_aceita_termos: Boolean(d.aceita_termos),
    p_aviso_lido: Boolean(d.aviso_lido),
  }
}

// As mensagens do servidor já estão em português e são para mostrar;
// o resto (rede, erro interno) não.
const MENSAGENS_DO_SERVIDOR = ['22023', '23505', 'P0001']
export function mensagemErro(error) {
  if (error && MENSAGENS_DO_SERVIDOR.includes(error.code) && error.message) return error.message
  return 'Não foi possível enviar o registo. Tenta daqui a pouco ou escreve para geral@100pressao.pt.'
}

// Custo previsto de uma entrega com o preço acordado.
export const custoEntrega = (empresa, km) =>
  Math.round((Number(empresa?.tarifa_base || 0) + Number(empresa?.tarifa_km || 0) * Number(km || 0)) * 100) / 100
