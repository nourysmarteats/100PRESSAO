import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Hero from './components/Hero'

const QuemSomos = lazy(() => import('./pages/QuemSomos'))
const Cardapio = lazy(() => import('./pages/Cardapio'))
const Contato = lazy(() => import('./pages/Contato'))
const FacaParte = lazy(() => import('./pages/FacaParte'))

const fallback = <div className="min-h-dvh bg-creme-50" />

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Hero />} />
        <Route
          path="/quem-somos"
          element={
            <Suspense fallback={fallback}>
              <QuemSomos />
            </Suspense>
          }
        />
        <Route
          path="/cardapio"
          element={
            <Suspense fallback={fallback}>
              <Cardapio />
            </Suspense>
          }
        />
        <Route
          path="/contato"
          element={
            <Suspense fallback={fallback}>
              <Contato />
            </Suspense>
          }
        />
        <Route
          path="/faca-parte"
          element={
            <Suspense fallback={fallback}>
              <FacaParte />
            </Suspense>
          }
        />
        {/* Rota antiga — o cardápio mudou de endereço */}
        <Route path="/conhecer-a-casa" element={<Navigate to="/cardapio" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
