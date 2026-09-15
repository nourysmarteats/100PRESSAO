import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'

const raiz = document.getElementById('root')
const arvore = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
)

// Páginas com conteúdo pré-renderizado no build (data-prerendered) são
// hidratadas por cima do HTML existente; as restantes (SPA pura, root vazio)
// arrancam com createRoot.
if (raiz.dataset.prerendered) {
  hydrateRoot(raiz, arvore)
} else {
  createRoot(raiz).render(arvore)
}

// Service worker só em produção — em dev o Vite já serve tudo local e a
// cache só atrapalharia o HMR. Falha silenciosa: sem SW o site continua a
// funcionar normalmente, só sem a resiliência offline do /cardapio.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
