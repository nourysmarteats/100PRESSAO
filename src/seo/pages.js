// Fonte única de verdade para title/description por página — baseado no
// briefing da Marta (Briefing-SEO-Site.md). Fácil de rever sem mexer em
// componentes.
//
// Nota (2026-07-12): a Marta tinha usado "Algés" como localização nas
// keywords/copy. O Leandro confirmou que a morada oficial é Carnaxide
// (ver Contacto.jsx, endereço legal do NIPC) — todo o texto abaixo já
// reflete Carnaxide, não Algés.
//
// Revisão de SEO local (2026-08-15): todos os títulos das páginas comerciais
// passaram a conter a localização. Um título como "Ementa: Petiscos e Cervejas"
// não compete em "ementa cervejaria Carnaxide" — o Google precisa do topónimo no
// título, não só no corpo. Mantidos abaixo de ~60 caracteres para não serem
// cortados nos resultados. "Draft House" entra onde cabe, por ser o termo de
// marca que distingue esta casa do homónimo no Funchal.
export const SEO_PAGES = {
  inicio: {
    path: '/',
    title: '100PRESSÃO Draft House | Cervejaria em Carnaxide',
    description:
      'Cervejaria artesanal e petiscos luso-brasileiros no Mercado Municipal de Carnaxide, Oeiras. Aberto todos os dias, 8h–22h. A pressão certa, no copo certo.',
  },
  home: {
    path: '/home',
    title: 'A Casa: Petiscos e Cervejas em Carnaxide | 100PRESSÃO',
    description:
      'Pequeno-almoço desde as 8h, prato feito ao almoço, petiscos luso-brasileiros e cerveja artesanal à pressão no Mercado Municipal de Carnaxide.',
  },
  ementa: {
    // Página pública e estática, gerada no build por scripts/gerar-ementa.js.
    // Não passa pelo React — ver o comentário nesse ficheiro.
    path: '/ementa',
    standalone: true,
    title: 'Ementa | 100PRESSÃO Draft House em Carnaxide',
    description:
      'Ementa completa do 100PRESSÃO Draft House, no Mercado Municipal de Carnaxide: cervejas artesanais à pressão, petiscos portugueses e brasileiros, pratos feitos e pequeno-almoço.',
  },
  quemSomos: {
    path: '/quem-somos',
    title: 'Quem Somos | 100PRESSÃO Draft House Carnaxide',
    description:
      'A história de uma cervejaria nascida entre Portugal, Brasil e Bélgica, hoje no Mercado Municipal de Carnaxide. Conheça o 100PRESSÃO.',
  },
  cardapio: {
    // Sistema de pedidos à mesa: pede nome e lugar antes de mostrar a ementa.
    // Fora do índice de propósito — não tem conteúdo legível para o Google e
    // competiria com /ementa, que é a página feita para pesquisa.
    path: '/cardapio',
    noindex: true,
    title: 'Pedir à Mesa | 100PRESSÃO Carnaxide',
    description:
      'Faz o teu pedido diretamente da mesa no 100PRESSÃO, em Carnaxide. Avisamos-te quando estiver pronto.',
  },
  contacto: {
    path: '/contacto',
    title: 'Contacto e Morada em Carnaxide | 100PRESSÃO',
    description:
      'Encontra-nos no Mercado Municipal de Carnaxide, Praceta Eugénio de Castro. Morada, horário (8h–22h, todos os dias) e contacto direto.',
  },
  facaParte: {
    // Rascunho do Daniel (a Marta não entregou title/description para esta
    // página no briefing original) — validar com ela antes de publicar.
    path: '/faca-parte',
    title: 'Faça Parte: Trabalhe ou Seja Parceiro | 100PRESSÃO',
    description:
      'Trabalhar connosco ou tornar-se parceiro/franquia da 100PRESSÃO em Carnaxide. Saiba como.',
  },
  restaurante: {
    path: '/restaurante',
    title: 'Encomendar Online em Carnaxide | 100PRESSÃO',
    description:
      'Encomenda petiscos e pratos do 100PRESSÃO em Carnaxide para entrega ao domicílio ou levantamento. Sem taxas de plataforma.',
  },
  app: {
    path: '/app',
    title: 'Instalar a App | 100PRESSÃO Carnaxide',
    description:
      'Guarda o 100PRESSÃO Online no telemóvel e encomenda direto, sem taxas de plataforma.',
  },
  privacidade: {
    path: '/privacidade',
    title: 'Política de Privacidade | 100PRESSÃO',
    description:
      'Como o 100PRESSÃO recolhe, usa e protege os teus dados pessoais, ao abrigo do RGPD.',
  },
  cookies: {
    path: '/cookies',
    title: 'Política de Cookies | 100PRESSÃO',
    description: 'Que cookies e tecnologias semelhantes usamos neste site e como podes controlá-los.',
  },
  termos: {
    path: '/termos',
    title: 'Termos de Uso | 100PRESSÃO',
    description: 'Condições de utilização do site e dos serviços online do 100PRESSÃO.',
  },
  condicoesVenda: {
    path: '/condicoes-venda',
    title: 'Condições de Venda | 100PRESSÃO',
    description:
      'Condições aplicáveis às encomendas à distância no restaurante online do 100PRESSÃO.',
  },
}

// ---------------------------------------------------------------------------
// Metadados de indexação por rota — consumidos pelo plugin de pré-renderização
// (scripts/vite-plugin-seo.js), que escreve um HTML estático por rota no dist
// com <title>/<meta description>/<link canonical> já no HTML de origem.
//
// Porquê: isto é uma SPA. Sem pré-renderização, o Google recebe sempre o mesmo
// index.html genérico ("100PRESSÃO · Draft House", sem description) e só vê as
// tags do react-helmet-async na segunda vaga de rastreio (renderização JS), que
// é lenta e não garantida em sites novos com pouco crawl budget.
//
// Marcadores:
//   standalone — a página tem HTML próprio, o pré-renderizador não lhe toca
//                (mas continua a entrar no sitemap). Caso de /ementa.
//   noindex    — recebe <meta robots="noindex"> e fica fora do sitemap.
//                Caso de /cardapio, que é um formulário e não conteúdo.
//
// changefreq/priority foram removidos do sitemap por serem ignorados pelo
// Google desde 2023 — só lastmod é lido.
// ---------------------------------------------------------------------------

// Rotas internas (equipa/PDV). Não são conteúdo e não entram no sitemap, mas
// TÊM de ser pré-renderizadas na mesma.
//
// Porquê (2026-08-16): com "cleanUrls": true, o Vercel resolve cada pedido pela
// árvore de ficheiros do dist. As rotas com HTML próprio (/cardapio, /contacto,
// …) passaram a servir o respetivo .html; as que não tinham ficheiro nenhum
// deixaram de ser apanhadas pelo rewrite para index.html e passaram a devolver
// 404 — foi assim que o /admin desapareceu, poucos minutos depois do deploy de
// SEO. O site público não deu sinal porque essas páginas todas têm ficheiro.
//
// A correção é dar-lhes ficheiro também: um shell igual ao index.html, com
// noindex. Deixa de depender da ordem de avaliação dos rewrites do Vercel.
const ROTAS_INTERNAS = [
  { path: '/admin', noindex: true, title: 'Gestão | 100PRESSÃO', description: 'Área reservada à equipa.' },
  { path: '/staff', noindex: true, title: 'Staff | 100PRESSÃO', description: 'Área reservada à equipa.' },
  { path: '/operacional', noindex: true, title: 'Operacional | 100PRESSÃO', description: 'Área reservada à equipa.' },
  { path: '/ecran', noindex: true, title: 'Ecrã | 100PRESSÃO', description: 'Área reservada à equipa.' },
  { path: '/caixa', noindex: true, title: 'Caixa | 100PRESSÃO', description: 'Área reservada à equipa.' },
  { path: '/visor', noindex: true, title: 'Visor | 100PRESSÃO', description: 'Área reservada à equipa.' },
]

const ORDEM_ROTAS = [
  'inicio',
  'home',
  'ementa',
  'restaurante',
  'quemSomos',
  'contacto',
  'cardapio',
  'app',
  'facaParte',
  'privacidade',
  'cookies',
  'termos',
  'condicoesVenda',
]

const ROTAS = ORDEM_ROTAS.map((chave) => SEO_PAGES[chave])

/**
 * Rotas cujo <head> é injetado no index.html do Vite (exclui as standalone).
 * Inclui as rotas internas: sem ficheiro no dist, o cleanUrls devolve-lhes 404.
 */
export const ROTAS_PRERENDER = [...ROTAS.filter((r) => !r.standalone), ...ROTAS_INTERNAS]

/** Rotas que entram no sitemap.xml (exclui as noindex e as internas). */
export const ROTAS_INDEXAVEIS = ROTAS.filter((r) => !r.noindex)
