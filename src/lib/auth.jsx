import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

// undefined = a verificar; null = sem sessão; objeto = autenticado
const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(undefined)

  useEffect(() => {
    if (!supabase) {
      setSessao(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={sessao}>{children}</AuthContext.Provider>
}

export function useSessaoAuth() {
  return useContext(AuthContext)
}
