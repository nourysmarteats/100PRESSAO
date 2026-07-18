// Centro de comando: sidebar com as ferramentas de gestão e atalhos para
// os painéis operacionais. Acesso reservado ao papel admin (staff é
// reencaminhado para /staff).
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { usePerfil } from '../../lib/equipa'
import Analytics from './admin/Analytics'
import Caixa from './admin/Caixa'
import Produtos from './admin/Produtos'
import Categorias from './admin/Categorias'
import Combos from './admin/Combos'
import Definicoes from './admin/Definicoes'
import Equipa from './admin/Equipa'
import Auditoria from './admin/Auditoria'
import Feedback from './admin/Feedback'
import Faturas from './admin/Faturas'

const SECCOES = [
  { id: 'analytics', rotulo: 'Analytics', Componente: Analytics },
  { id: 'caixa', rotulo: 'Fecho de caixa', Componente: Caixa },
  { id: 'faturas', rotulo: 'Faturas', Componente: Faturas },
  { id: 'produtos', rotulo: 'Produtos', Componente: Produtos },
  { id: 'categorias', rotulo: 'Categorias', Componente: Categorias },
  { id: 'combos', rotulo: 'Combos', Componente: Combos },
  { id: 'definicoes', rotulo: 'Avisos & Horário', Componente: Definicoes },
  { id: 'feedback', rotulo: 'Feedback', Componente: Feedback },
  { id: 'equipa', rotulo: 'Equipa', Componente: Equipa },
  { id: 'auditoria', rotulo: 'Auditoria', Componente: Auditoria },
]

// Item 1 da v2: atalhos para os painéis já existentes (rotas próprias,
// sem fundir shells nem duplicar lógica)
const PAINEIS = [
  { to: '/staff', rotulo: 'Staff', dica: 'Entregas e pagamentos' },
  { to: '/operacional', rotulo: 'Operacional', dica: 'Cozinha e bar' },
  { to: '/ecran', rotulo: 'Ecrã', dica: 'TV de sala' },
]

function Admin() {
  const perfil = usePerfil()
  const [ativa, setAtiva] = useState('analytics')

  // Guard por papel: uma conta staff não entra no admin nem por URL direto
  if (perfil?.papel && perfil.papel !== 'admin') {
    return <Navigate to="/staff" replace />
  }

  const { Componente } = SECCOES.find((s) => s.id === ativa) || SECCOES[0]

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
      {/* Sidebar (colapsa para pills com scroll horizontal em ecrãs pequenos) */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <nav
          aria-label="Secções do admin"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {SECCOES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAtiva(s.id)}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-left text-sm font-semibold uppercase tracking-widest transition-colors lg:rounded-lg ${
                ativa === s.id
                  ? 'bg-grafite-900 text-creme-50'
                  : 'text-grafite-600 hover:text-grafite-900'
              }`}
            >
              {s.rotulo}
            </button>
          ))}
        </nav>

        <div className="mt-2 border-t border-creme-300 pt-3 lg:mt-6">
          <p className="px-4 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-grafite-600/70 lg:px-0">
            Painéis
          </p>
          <nav
            aria-label="Painéis operacionais"
            className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {PAINEIS.map((p) => (
              <Link
                key={p.to}
                to={p.to}
                title={p.dica}
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-widest text-cobre-600 transition-colors hover:text-cobre-500 lg:rounded-lg"
              >
                {p.rotulo}
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 8h11M9 3.5 13.5 8 9 12.5" />
                </svg>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="mt-6 lg:mt-0">
        <Componente />
      </div>
    </main>
  )
}

export default Admin
