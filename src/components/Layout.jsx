import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ConsentBanner from './ConsentBanner'
import { applyStoredConsent, trackPageview } from '../lib/analytics'

function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  // Consentimento já dado em visita anterior — o gtag() de index.html
  // arranca sempre em "denied", isto reaplica o "granted" se aplicável
  useEffect(() => {
    applyStoredConsent()
  }, [])

  // gtag('config', ...) só mede a primeira página (SPA, sem reload) —
  // as rotas seguintes têm de ser enviadas manualmente. Pequeno atraso
  // para o <title> (react-helmet-async) já estar atualizado quando a
  // Google Analytics ler document.title.
  useEffect(() => {
    const t = setTimeout(() => trackPageview(pathname), 50)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      {/* bg creme para páginas curtas não deixarem ver o fundo grafite do body */}
      <div className="flex-1 bg-creme-50">
        <Outlet />
      </div>
      <Footer />
      <ConsentBanner />
    </div>
  )
}

export default Layout
