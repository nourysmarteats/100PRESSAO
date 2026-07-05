import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Hero from './components/Hero'

const ConhecerACasa = lazy(() => import('./pages/ConhecerACasa'))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route
        path="/conhecer-a-casa"
        element={
          <Suspense fallback={<div className="min-h-dvh bg-creme-50" />}>
            <ConhecerACasa />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default App
