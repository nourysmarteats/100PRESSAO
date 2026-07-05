import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      {/* bg creme para páginas curtas não deixarem ver o fundo grafite do body */}
      <div className="flex-1 bg-creme-50">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

export default Layout
