// Entry-point de SSG (build): renderiza para HTML estático as páginas públicas
// de conteúdo estável — /, /quem-somos e /contacto — para o conteúdo principal
// ir no HTML inicial, e não só depois de o JavaScript correr. As páginas com
// dados ao vivo (menu à mesa, restaurante online, área de equipa, beta) NÃO
// entram aqui: seriam pré-renderizadas com dados velhos.
//
// Corre apenas no `vite build --ssr` (ver package.json). O HTML resultante é
// injetado no <div id="root"> por scripts/prerender-conteudo.mjs. O cliente
// (main.jsx) faz hydrateRoot por cima deste HTML.
//
// As rotas abaixo têm de espelhar as de App.jsx. Os componentes são importados
// de forma eager (não lazy) para o render no servidor não cair no fallback do
// Suspense — e para o cliente hidratar o mesmo conteúdo sem "piscar".
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Layout from './components/Layout'
import Hero from './components/Hero'
import QuemSomos from './pages/QuemSomos'
import Contacto from './pages/Contacto'

// Rotas cobertas pelo SSG. Exportada para o script de prerender iterar.
export const ROTAS_SSG = ['/', '/quem-somos', '/contacto']

export function render(url) {
  return renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Hero />} />
            <Route path="/quem-somos" element={<QuemSomos />} />
            <Route path="/contacto" element={<Contacto />} />
          </Route>
        </Routes>
      </StaticRouter>
    </HelmetProvider>,
  )
}
