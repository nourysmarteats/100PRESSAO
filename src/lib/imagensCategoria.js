// Imagens ilustrativas de stock por categoria (interinas). Mostradas quando
// um item não tem foto real (imagem_url); a foto real sobrepõe-se sempre.
// Substituíveis item a item no admin quando houver fotos verdadeiras.
const MAPA = [
  ['pequeno', 'pequeno-almoco'],
  ['cerveja', 'cervejas'],
  ['petisco', 'petiscos'],
  ['refri', 'refrigerantes'],
  ['espirituosa', 'espirituosas'],
  ['caipi', 'espirituosas'],
  ['vinho', 'vinhos'],
  ['almoço', 'almoco'],
  ['almoco', 'almoco'],
]

export function imagemCategoria(nome) {
  const c = (nome || '').toLowerCase()
  for (const [chave, slug] of MAPA) if (c.includes(chave)) return `/ementa/${slug}.jpg`
  return null
}
