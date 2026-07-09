import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Hero from './components/Hero'

const Home = lazy(() => import('./pages/Home'))
const QuemSomos = lazy(() => import('./pages/QuemSomos'))
const Cardapio = lazy(() => import('./pages/Cardapio'))
const Contato = lazy(() => import('./pages/Contato'))
const FacaParte = lazy(() => import('./pages/FacaParte'))
const EquipaLayout = lazy(() => import('./pages/equipa/EquipaLayout'))
const Staff = lazy(() => import('./pages/equipa/Staff'))
const Operacional = lazy(() => import('./pages/equipa/Operacional'))
const Ecra = lazy(() => import('./pages/equipa/Ecra'))
const Admin = lazy(() => import('./pages/equipa/Admin'))

const fallbackClaro = <div className="min-h-dvh bg-creme-50" />
const fallbackEscuro = <div className="min-h-dvh bg-grafite-950" />

const pagina = (Componente) => (
  <Suspense fallback={fallbackClaro}>
    <Componente />
  </Suspense>
)
const interna = (Componente) => (
  <Suspense fallback={fallbackEscuro}>
    <Componente />
  </Suspense>
)

function App() {
  return (
    <Routes>
        {/* Site público */}
        <Route element={<Layout />}>
          <Route path="/" element={<Hero />} />
          <Route path="/home" element={pagina(Home)} />
          <Route path="/quem-somos" element={pagina(QuemSomos)} />
          <Route path="/cardapio" element={pagina(Cardapio)} />
          <Route path="/contato" element={pagina(Contato)} />
          <Route path="/faca-parte" element={pagina(FacaParte)} />
          {/* Rota antiga — o cardápio mudou de endereço */}
          <Route path="/conhecer-a-casa" element={<Navigate to="/cardapio" replace />} />
        </Route>

        {/* Ecrã público (TV) — sem auth nem PIN, só mostra números de pedido */}
        <Route path="/ecran" element={interna(Ecra)} />

        {/* Área da equipa — Supabase Auth + PIN de conveniência */}
        <Route element={interna(EquipaLayout)}>
          <Route path="/staff" element={interna(Staff)} />
          <Route path="/operacional" element={interna(Operacional)} />
          <Route path="/admin" element={interna(Admin)} />
        </Route>

        {/* Rotas antigas da fase 2 */}
        <Route path="/equipa" element={<Navigate to="/staff" replace />} />
        <Route path="/equipa/staff" element={<Navigate to="/staff" replace />} />
        <Route path="/equipa/operacional" element={<Navigate to="/operacional" replace />} />
        <Route path="/equipa/admin" element={<Navigate to="/admin" replace />} />
        <Route path="/equipa/ecra" element={<Navigate to="/ecran" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
