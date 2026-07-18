// Consulta do feedback dos clientes (formulário público em /contato).
// Leitura restrita a admins por RLS; enviar é público/anónimo.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARTAO } from './comuns'

const ROTULO_TIPO = {
  sugestao: 'Sugestão',
  elogio: 'Elogio',
  critica: 'Crítica',
  outro: 'Outro',
}

const COR_TIPO = {
  sugestao: 'bg-ambar-500/15 text-ambar-600',
  elogio: 'bg-green-600/15 text-green-700',
  critica: 'bg-red-500/10 text-red-600',
  outro: 'border border-grafite-600/30 text-grafite-600/70',
}

function Feedback() {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('nao_lidos')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(300)
    if (error) {
      setErro(
        'Sem acesso ao feedback. A migração SQL foi aplicada? (a leitura é restrita a admins)',
      )
      setItens([])
      return
    }
    setItens(data)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarLido(f) {
    await supabase.from('feedback').update({ lido: !f.lido }).eq('id', f.id)
    carregar()
  }

  if (itens === null) return <p className="text-grafite-600/70">A carregar…</p>
  if (erro) return <p className={`${CARTAO} p-6 text-grafite-600`}>{erro}</p>

  const naoLidos = itens.filter((i) => !i.lido).length
  const filtrados =
    filtro === 'todos'
      ? itens
      : filtro === 'nao_lidos'
        ? itens.filter((i) => !i.lido)
        : itens.filter((i) => i.tipo === filtro)

  const FILTROS = [
    { id: 'nao_lidos', rotulo: `Por ler (${naoLidos})` },
    { id: 'todos', rotulo: `Todos (${itens.length})` },
    { id: 'sugestao', rotulo: 'Sugestões' },
    { id: 'elogio', rotulo: 'Elogios' },
    { id: 'critica', rotulo: 'Críticas' },
    { id: 'outro', rotulo: 'Outros' },
  ]

  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              filtro === f.id
                ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className={`${CARTAO} mt-4 p-6 text-grafite-600`}>
          {itens.length === 0
            ? 'Ainda sem feedback. As mensagens do formulário em /contato aparecem aqui.'
            : 'Nada neste filtro.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtrados.map((f) => (
            <li
              key={f.id}
              className={`${CARTAO} p-4 ${f.lido ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest ${COR_TIPO[f.tipo] || COR_TIPO.outro}`}
                  >
                    {ROTULO_TIPO[f.tipo] || f.tipo}
                  </span>
                  {f.nome && <span className="font-semibold text-grafite-900">{f.nome}</span>}
                </span>
                <span className="text-xs tabular-nums text-grafite-600/70">
                  {new Date(f.criado_em).toLocaleString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-grafite-800">{f.mensagem}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {f.contacto ? (
                  <span className="text-sm text-cobre-600">{f.contacto}</span>
                ) : (
                  <span className="text-sm text-grafite-600/50">sem contacto</span>
                )}
                <button
                  type="button"
                  onClick={() => alternarLido(f)}
                  className="cursor-pointer rounded-full border border-creme-300 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500"
                >
                  {f.lido ? 'Marcar por ler' : 'Marcar lido'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Feedback
