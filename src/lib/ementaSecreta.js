// Ementa secreta — o número (3 dígitos) abre a ementa exclusiva dos Clientes
// Beta. É só leitura: o desconto de 10% é confirmado ao balcão. A validação a
// sério é do servidor (RPC ementa_secreta, SECURITY DEFINER + limitador); aqui
// só filtramos o formato para o aviso chegar antes do pedido.

export function normalizarNumero(v) {
  const s = String(v || '').replace(/\D/g, '')
  if (!/^\d{3}$/.test(s)) return null
  const n = Number(s)
  return n >= 100 && n <= 999 ? n : null
}

export async function buscarEmentaSecreta(supabase, numero) {
  return supabase.rpc('ementa_secreta', { p_numero: numero })
}
