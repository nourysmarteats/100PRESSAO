// Avisos operacionais + horário de funcionamento (itens 6 e 7 da v2).
// Guardados na tabela definicoes (leitura pública) — o banner aparece em
// /cardapio em tempo real e o horário alimenta o Footer e o Contato.
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { registarAuditoria } from '../../../lib/equipa'
import { useAviso, BOTAO_PRIMARIO, CARTAO, CAMPO } from './comuns'

export const DIAS_SEMANA = [
  ['segunda', 'Segunda'],
  ['terca', 'Terça'],
  ['quarta', 'Quarta'],
  ['quinta', 'Quinta'],
  ['sexta', 'Sexta'],
  ['sabado', 'Sábado'],
  ['domingo', 'Domingo'],
]

function Definicoes() {
  const [banner, setBanner] = useState('')
  const [horario, setHorario] = useState(null)
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data, error } = await supabase.from('definicoes').select('*')
      if (!ativo) return
      if (error) {
        setTabelaEmFalta(true)
        return
      }
      const porChave = Object.fromEntries(data.map((d) => [d.chave, d.valor]))
      setBanner(typeof porChave.banner === 'string' ? porChave.banner : '')
      setHorario(porChave.horario || Object.fromEntries(DIAS_SEMANA.map(([d]) => [d, ''])))
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  async function guardarBanner(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase
      .from('definicoes')
      .upsert({ chave: 'banner', valor: banner.trim(), atualizado_em: new Date().toISOString() })
    setOcupado(false)
    if (error) {
      mostrarAviso('Erro ao guardar o aviso.')
      return
    }
    registarAuditoria('banner_alterado', { texto: banner.trim() || '(vazio)' })
    mostrarAviso(banner.trim() ? 'Aviso publicado ✓' : 'Aviso removido ✓')
  }

  async function guardarHorario(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase
      .from('definicoes')
      .upsert({ chave: 'horario', valor: horario, atualizado_em: new Date().toISOString() })
    setOcupado(false)
    if (error) {
      mostrarAviso('Erro ao guardar o horário.')
      return
    }
    registarAuditoria('horario_alterado', horario)
    mostrarAviso('Horário atualizado ✓')
  }

  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        A tabela de definições ainda não existe — aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">docs/sql/2026-07-11-v2-equipa-combos-config.sql</code>
        no SQL Editor do Supabase.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Item 6: banner operacional */}
      <form onSubmit={guardarBanner} className={`${CARTAO} p-6`}>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Aviso no cardápio
        </h3>
        <p className="mt-1 text-sm text-grafite-600/70">
          Aparece como faixa no topo de /cardapio enquanto estiver preenchido —
          ex.: “Hoje fechamos às 20h” ou “IPA esgotada”. Vazio = sem aviso.
        </p>
        <textarea
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          rows={2}
          maxLength={180}
          placeholder="Escreve o aviso…"
          aria-label="Texto do aviso operacional"
          className={`${CAMPO} mt-3 resize-none`}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-grafite-600/70">{banner.length}/180</span>
          <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
            {banner.trim() ? 'Publicar aviso' : 'Remover aviso'}
          </button>
        </div>
      </form>

      {/* Item 7: horário de funcionamento */}
      {horario && (
        <form onSubmit={guardarHorario} className={`${CARTAO} p-6`}>
          <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
            Horário de funcionamento
          </h3>
          <p className="mt-1 text-sm text-grafite-600/70">
            Refletido no rodapé do site e na página Contato. Deixa vazio para
            “encerrado” nesse dia.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DIAS_SEMANA.map(([chave, rotulo]) => (
              <label key={chave} className="flex items-center gap-3">
                <span className="w-20 text-xs font-semibold uppercase tracking-widest text-ambar-600">
                  {rotulo}
                </span>
                <input
                  value={horario[chave] || ''}
                  onChange={(e) => setHorario((h) => ({ ...h, [chave]: e.target.value }))}
                  placeholder="Ex.: 8:00 – 12:00 (vazio = encerrado)"
                  aria-label={`Horário de ${rotulo}`}
                  className={`${CAMPO} mt-0 flex-1`}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
              Guardar horário
            </button>
          </div>
        </form>
      )}

      {Aviso}
    </div>
  )
}

export default Definicoes
