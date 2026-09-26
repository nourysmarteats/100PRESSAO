// Ementa secreta — o número (3 dígitos) abre a ementa exclusiva dos Clientes
// Beta ADERIDOS. É só leitura: o desconto de 10% é confirmado ao balcão. A
// validação a sério é do servidor (RPC ementa_secreta, SECURITY DEFINER +
// limitador); aqui só filtramos o formato para o aviso chegar antes do pedido.
//
// Quem ainda não aderiu pode aderir na hora (aderir_cliente_beta_direto):
// número + telemóvel da inscrição + regulamento + aviso. A resposta do servidor
// é sempre sim/não, sem revelar se o número existe. Recusar não grava nada.

export function normalizarNumero(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (!/^\d{3}$/.test(s)) return null
  const n = Number(s)
  return n >= 100 && n <= 999 ? n : null
}

// Aceita "912 345 678", "+351912345678", "00351 912…". Devolve 9 dígitos ou null.
export function normalizarTelemovelAdesao(v) {
  let s = String(v || '').replace(/\D/g, '')
  if (s.startsWith('00351')) s = s.slice(5)
  else if (s.length === 12 && s.startsWith('351')) s = s.slice(3)
  return /^\d{9}$/.test(s) ? s : null
}

export function validarAdesaoDireta({ telemovel, aceita_regulamento, aviso_lido }) {
  const erros = []
  if (!normalizarTelemovelAdesao(telemovel)) erros.push('Escreve o telemóvel com que te inscreveste (9 dígitos).')
  if (aceita_regulamento !== true) erros.push('Falta aceitar o regulamento Cliente Beta.')
  if (aviso_lido !== true) erros.push('Falta confirmar a leitura do aviso de privacidade.')
  return erros
}

export async function buscarEmentaSecreta(supabase, numero) {
  return supabase.rpc('ementa_secreta', { p_numero: numero })
}

export async function aderirDireto(supabase, numero, telemovel) {
  return supabase.rpc('aderir_cliente_beta_direto', {
    p_numero: numero,
    p_telemovel: normalizarTelemovelAdesao(telemovel),
    p_aceita_regulamento: true,
    p_aviso_lido: true,
  })
}
