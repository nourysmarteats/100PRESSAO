// Service worker do 100PRESSÃO.
//
// Objetivo único: o /cardapio continuar a mostrar o menu (com dados um
// pouco antigos, na pior das hipóteses) se o Wi-Fi do mercado cair a meio
// de um serviço. Não existe para acelerar o site todo nem para tornar o
// resto da app "offline-first" — só cobre:
//   1) app shell (HTML/JS/CSS/ícones) para a SPA arrancar sem rede — inclui
//      o /restaurante, que é instalável como app própria;
//   2) leituras públicas do cardápio no Supabase (categorias, produtos,
//      combos, variantes) em stale-while-revalidate.
//
// Nunca intercepta pedidos que não sejam GET — criar pedido, autenticar,
// faturar, etc. andam sempre pela rede, nunca por cache.
//
// Registado em src/main.jsx, só em produção.

// Subir a versão faz o activate apagar as caches antigas — necessário aqui
// para descartar as entradas de menu guardadas pela estratégia anterior.
const CACHE_VERSION = 'v3'
const SHELL_CACHE = `100p-shell-${CACHE_VERSION}`
const MENU_CACHE = `100p-menu-${CACHE_VERSION}`

const SHELL_URLS = [
  '/',
  '/cardapio',
  '/restaurante',
  '/restaurante.webmanifest',
  '/site.webmanifest',
  '/cardapio.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
]

// Únicas tabelas cujo GET fica em cache — todas de leitura pública do
// cardápio. Fora desta lista (orders, sessions, equipa, analytics, etc.)
// nada é guardado, propositadamente.
const MENU_TABLES = ['categories', 'products', 'combos', 'product_variants']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}), // primeira visita sem rede não deve impedir a instalação
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== MENU_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isMenuRead(url) {
  if (!url.pathname.includes('/rest/v1/')) return false
  return MENU_TABLES.some((tabela) => url.pathname.endsWith(`/rest/v1/${tabela}`))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // mutações passam sempre direto pela rede

  const url = new URL(request.url)

  // Navegação (ex.: abrir o app instalado do /cardapio sem rede) — tenta a
  // rede primeiro, cai para o shell em cache. É uma SPA sem SSR, por isso
  // o HTML é idêntico em qualquer rota; o React Router trata do resto.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () =>
          // A app instalada arranca no /restaurante; sem rede, serve-se o shell
          // mais próximo — é uma SPA, o HTML é o mesmo em qualquer rota.
          (await caches.match(url.pathname.startsWith('/restaurante') ? '/restaurante' : '/cardapio')) ||
          (await caches.match('/')),
      ),
    )
    return
  }

  // Leituras do cardápio (Supabase) — rede primeiro, cache só como rede de
  // segurança.
  //
  // Era stale-while-revalidate, que devolvia sempre a cópia guardada e só
  // atualizava a cache depois. Isso fazia com que, no admin, gravar um produto
  // e voltar a ler mostrasse a versão antiga — era preciso recarregar a página
  // para ver a alteração. O objetivo do cache é aguentar uma quebra do Wi-Fi do
  // mercado, não poupar milissegundos, e network-first cumpre-o na mesma:
  // online lê-se sempre o que está na base de dados; offline cai na cache.
  if (isMenuRead(url)) {
    event.respondWith(
      caches.open(MENU_CACHE).then(async (cache) => {
        try {
          const resp = await fetch(request)
          if (resp.ok) cache.put(request, resp.clone())
          return resp
        } catch {
          return (await cache.match(request)) || Response.error()
        }
      }),
    )
    return
  }

  // Assets estáticos do build (JS/CSS/imagens), mesma origem — cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            if (
              resp.ok &&
              ['script', 'style', 'image'].includes(request.destination)
            ) {
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, resp.clone()))
            }
            return resp
          }),
      ),
    )
  }
})
