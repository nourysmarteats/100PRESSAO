// Consulta do log de auditoria (item 5 da v2) — quem alterou o quê.
// Escrita acontece nos handlers via registarAuditoria(); leitura é
// restrita a admins por RLS.
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARTAO } from './comuns'

const ROTULO_ACAO = {
  produto_criado: 'Produto criado',
  produto_editado: 'Produto editado',
  produto_apagado: 'Produto apagado',
  preco_alterado: 'Preço alterado',
  disponibilidade_alterada: 'Disponibilidade alterada',
  esgotado_lote: 'Esgotado em lote',
  categoria_criada: 'Categoria criada',
  categoria_editada: 'Categoria editada',
  categoria_apagada: 'Categoria apagada',
  categoria_visibilidade: 'Categoria mostrada/oculta',
  combo_criado: 'Combo criado',
  combo_editado: 'Combo editado',
  combo_apagado: 'Combo apagado',
  combo_disponibilidade: 'Combo ativado/desativado',
  variante_criada: 'Variante criada',
  variante_apagada: 'Variante apagada',
  conta_criada: 'Conta criada',
  conta_desativada: 'Conta desativada',
  conta_reativada: 'Conta reativada',
  pin_alterado: 'PIN alterado',
  banner_alterado: 'Aviso operacional alterado',
  horario_alterado: 'Horário alterado',
}

function descreverDetalhe(detalhe) {
  if (!detalhe) return ''
  return Object.entries(detalhe)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? v : String(v)}`)
    .join(' · ')
}

function Auditoria() {
  const [registos, setRegistos] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(200)
      if (!ativo) return
      if (error) {
        setErro(
          'Sem acesso ao log. A migração SQL v2 foi aplicada? (a leitura também é restrita a admins)',
        )
        setRegistos([])
        return
      }
      setRegistos(data)
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  if (registos === null) return <p className="text-grafite-600/70">A carregar…</p>
  if (erro) return <p className={`${CARTAO} p-6 text-grafite-600`}>{erro}</p>

  return (
    <div>
      <p className="text-grafite-600/70">
        Últimas {registos.length} ações · retenção a definir com a Bea Salgado (RGPD)
      </p>
      {registos.length === 0 ? (
        <p className={`${CARTAO} mt-4 p-6 text-grafite-600`}>
          Ainda sem registos. As ações no admin começam a aparecer aqui.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {registos.map((r) => (
            <li key={r.id} className={`${CARTAO} px-4 py-2.5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold text-grafite-900">
                  {ROTULO_ACAO[r.acao] || r.acao}
                </span>
                <span className="text-xs tabular-nums text-grafite-600/70">
                  {new Date(r.criado_em).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-grafite-600">
                {r.operador ? `${r.operador} · ` : ''}
                {r.email || 'conta desconhecida'}
                {r.detalhe ? ` · ${descreverDetalhe(r.detalhe)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Auditoria
