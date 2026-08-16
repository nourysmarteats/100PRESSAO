// Conteúdo editorial da secção de cervejas da ementa pública (/ementa).
//
// Porquê escrito à mão e não lido da base de dados: a tabela `products` tem hoje
// uma única cerveja artesanal registada ("Copo Cheio", IPA). Gerar a página só a
// partir da base de dados publicaria uma ementa com 1 cerveja e 30 itens de
// comida — o Google leria a casa como snack-bar, exactamente o contrário do
// posicionamento. Decisão do Leandro (15/08/2026): secção editorial por estilos,
// sem preços fixos, a liderar a página.
//
// Os estilos abaixo não são inventados: são os que a própria cozinha já usa nas
// notas de harmonização dos petiscos (ver descrições em `products`). Quando o
// barril estiver carregado no /admin com a lista real, esta secção passa a ser
// gerada a partir da base de dados e este ficheiro desaparece.
//
// >>> LEANDRO: valida este texto antes de publicar. É a primeira coisa que o
// >>> Google e o cliente vão ler sobre a casa.

export const CERVEJAS_INTRO =
  'Somos uma casa de cerveja antes de tudo o resto. As torneiras giram — o que ' +
  'está hoje pode não estar na semana que vem — mas a lógica é sempre a mesma: ' +
  'cerveja europeia servida à pressão como deve ser, no copo certo, à ' +
  'temperatura certa, com a pressão certa. Pergunta ao balcão o que está a sair.'

export const ESTILOS = [
  {
    nome: 'IPA',
    notas: 'Lúpulo em força, aroma cítrico e final seco. Aguenta um petisco gorduroso sem se encolher.',
    harmoniza: 'Pica-Pau, Tábua da Casa',
  },
  {
    nome: 'Pilsner',
    notas: 'Dourada, limpa e amarga q.b. A cerveja que não cansa ao terceiro copo.',
    harmoniza: 'Pastéis de Bacalhau, Pastéis de Vento',
  },
  {
    nome: 'Witbier',
    notas: 'De trigo, turva, com coentro e casca de laranja. Fresca e fácil.',
    harmoniza: 'Rissóis de Gambas',
  },
  {
    nome: 'Amber Ale',
    notas: 'Maltada, tom de caramelo, corpo médio. O meio-termo que agrada a quase toda a gente.',
    harmoniza: 'Moelas Estufadas, Bolinhas de Feijoada',
  },
  {
    nome: 'Red Ale',
    notas: 'Ruiva, tostada, com um amargo discreto no fim.',
    harmoniza: 'Calabresa Acebolada, Batatas com Cheddar e Bacon',
  },
  {
    nome: 'Tripel',
    notas: 'Belga, forte, frutada e traiçoeiramente bebível. Para quem quer levar a sério.',
    harmoniza: 'Tábua da Casa',
  },
  {
    nome: 'Blonde',
    notas: 'Leve, dourada e de bom carácter. Bom ponto de partida para quem não bebe artesanal.',
    harmoniza: 'Azeitonas, Tremoços',
  },
  {
    nome: 'Lager',
    notas: 'A clássica, bem gelada, sem complicações. Também a temos.',
    harmoniza: 'Coxinha de Frango',
  },
]

export const CERVEJAS_RODAPE =
  'Servimos também cerveja de pressão comercial para quem prefere o clássico. ' +
  'Consumo de bebidas alcoólicas proibido a menores de 18 anos.'
