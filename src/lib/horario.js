// Horário de funcionamento configurável no admin (tabela definicoes).
// Lido por REST puro (fetch + anon key) para o supabase-js continuar fora
// do bundle público — o Footer está em todas as páginas.
import { useEffect, useState } from 'react'

const URL = import.meta.env.VITE_SUPABASE_URL
const CHAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const DIAS_SEMANA = [
  ['segunda', 'Segunda'],
  ['terca', 'Terça'],
  ['quarta', 'Quarta'],
  ['quinta', 'Quinta'],
  ['sexta', 'Sexta'],
  ['sabado', 'Sábado'],
  ['domingo', 'Domingo'],
]

// Fallback = horário que estava fixo no código antes do item 7 da v2
export const HORARIO_FALLBACK = [{ dias: 'Segunda a Sexta', horas: '8:00 – 12:00' }]

// Agrupa dias consecutivos com o mesmo horário em linhas legíveis:
// { segunda..sexta: "8:00 – 12:00" } → [{ dias: "Segunda a Sexta", horas: … }]
export function resumirHorario(horario) {
  if (!horario) return null
  const linhas = []
  let grupo = null
  DIAS_SEMANA.forEach(([chave, rotulo]) => {
    const horas = (horario[chave] || '').trim()
    if (!horas) {
      grupo = null
      return
    }
    if (grupo && grupo.horas === horas) {
      grupo.fim = rotulo
    } else {
      grupo = { inicio: rotulo, fim: rotulo, horas }
      linhas.push(grupo)
    }
  })
  if (linhas.length === 0) return null
  return linhas.map((g) => ({
    dias: g.inicio === g.fim ? g.inicio : `${g.inicio} a ${g.fim}`,
    horas: g.horas,
  }))
}

export function useHorario() {
  const [linhas, setLinhas] = useState(HORARIO_FALLBACK)

  useEffect(() => {
    if (!URL?.startsWith('http') || !CHAVE_ANON) return
    fetch(`${URL}/rest/v1/definicoes?chave=eq.horario&select=valor`, {
      headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${CHAVE_ANON}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const resumo = resumirHorario(rows?.[0]?.valor)
        if (resumo) setLinhas(resumo)
      })
      .catch(() => {
        /* mantém o fallback */
      })
  }, [])

  return linhas
}
