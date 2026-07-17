// Fonte única de verdade para title/description por página — baseado no
// briefing da Marta (Briefing-SEO-Site.md). Fácil de rever sem mexer em
// componentes.
//
// Nota (2026-07-12): a Marta tinha usado "Algés" como localização nas
// keywords/copy. O Leandro confirmou que a morada oficial é Carnaxide
// (ver Contato.jsx, endereço legal do NIPC) — todo o texto abaixo já
// reflete Carnaxide, não Algés.
export const SEO_PAGES = {
  inicio: {
    path: '/',
    title: '100PRESSÃO | Cervejaria Artesanal em Carnaxide',
    description:
      'Cerveja europeia a sério e petiscos luso-brasileiros no Mercado Municipal de Carnaxide. A pressão certa, no copo certo.',
  },
  home: {
    path: '/home',
    title: 'A Casa: Petiscos, Cervejas e Muito Mais | 100PRESSÃO',
    description:
      'Conheça o que servimos no 100PRESSÃO: petiscos portugueses e brasileiros, cervejas artesanais e mais, no Mercado Municipal de Carnaxide.',
  },
  quemSomos: {
    path: '/quem-somos',
    title: 'Quem Somos | 100PRESSÃO Draft House',
    description:
      'A história de uma cervejaria nascida entre Portugal, Brasil e Bélgica. Conheça o 100PRESSÃO.',
  },
  cardapio: {
    path: '/cardapio',
    title: 'Ementa: Petiscos e Cervejas | 100PRESSÃO',
    description:
      'Petiscos portugueses e brasileiros para acompanhar cerveja artesanal. Veja a ementa completa.',
  },
  contato: {
    path: '/contato',
    title: 'Contato e Localização | 100PRESSÃO Carnaxide',
    description:
      'Encontre-nos no Mercado Municipal de Carnaxide. Morada, horário e contacto direto.',
  },
  facaParte: {
    // Rascunho do Daniel (a Marta não entregou title/description para esta
    // página no briefing original) — validar com ela antes de publicar.
    path: '/faca-parte',
    title: 'Faça Parte: Trabalhe ou Seja Parceiro | 100PRESSÃO',
    description:
      'Trabalhar connosco ou tornar-se parceiro/franquia da 100PRESSÃO em Carnaxide. Saiba como.',
  },
}
