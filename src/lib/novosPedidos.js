// Deteção de pedidos novos por comparação de listas, e não pelo evento de
// tempo real. Assim o alerta toca mesmo que o evento se tenha perdido (ecrã
// apagado, Wi-Fi a falhar) — basta o pedido aparecer na próxima leitura.
//
// `conhecidos` é o Set de ids da leitura anterior, ou null na primeira
// leitura (não toca: os pedidos já existentes não são novidade).
export function idsNovos(conhecidos, lista) {
  if (!conhecidos || !Array.isArray(lista)) return []
  return lista.map((p) => p.id).filter((id) => !conhecidos.has(id))
}
