// Balcao Beta -- conferencia rapida ao pagar. A equipa introduz o numero que o
// cliente mostra e ve, contra a lista real, se e Cliente Beta ativo e qual o
// nome (para cruzar com o que a pessoa diz). O 10% aplica-se depois no Vendus.
// A verdade e sempre do servidor (RPC verificar_cliente_beta, so autenticados).
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const CAMPO =
  'mt-2 w-full rounded-2xl border border-creme-300 bg-creme-100 px-6 py-6 text-center text-6xl font-bold tracking-[0.3em] text-grafite-900 outline-none focus:border-ambar-500'

export default function BetaBalcao() {
  const [numero, setNumero] = useState('')
  const [estado, setEstado] = useState('idle') // idle | a_verificar | ok | inativo | nao | erro
  const [res, setRes] = useState(null)

  async function verificar(ev) {
    ev.preventDefault()
    const n = Number(String(numero).replace(/\D/g, ''))
    if (!(n >= 100 && n <= 999)) { setEstado('erro'); return }
    setEstado('a_verificar')
    const { data, error } = await supabase.rpc('verificar_cliente_beta', { p_numero: n })
    if (error) { setEstado('erro'); return }
    if (!data || !data.length) { setRes(null); setEstado('nao'); return }
    setRes(data[0]); setEstado(data[0].ativo ? 'ok' : 'inativo')
  }

  function limpar() { setNumero(''); setRes(null); setEstado('idle') }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-grafite-900">Balcão Beta</h1>
      <p className="mt-1 text-sm text-grafite-600/80">Confirma se é Cliente Beta antes de aplicar os 10% no Vendus.</p>

      <form onSubmit={verificar} className="mt-6">
        <label className="block text-xs font-semibold uppercase tracking-widest text-ambar-600" htmlFor="num">Número do cliente</label>
        <input
          id="num"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={numero}
          onChange={(e) => { setNumero(e.target.value.replace(/\D/g, '').slice(0, 3)); if (estado !== 'idle') setEstado('idle') }}
          className={CAMPO}
          placeholder="000"
          autoFocus
        />
        <button type="submit" disabled={estado === 'a_verificar'} className="mt-4 w-full cursor-pointer rounded-full bg-ambar-500 px-8 py-4 font-semibold uppercase tracking-widest text-grafite-950 transition-colors hover:bg-ambar-400 disabled:opacity-40">
          {estado === 'a_verificar' ? 'A verificar…' : 'Verificar'}
        </button>
      </form>

      {estado === 'ok' && res && (
        <div className="mt-6 rounded-2xl border-2 border-green-600 bg-green-50 p-6 text-center">
          <p className="text-4xl">✓</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-800">Cliente Beta ativo</p>
          <p className="mt-2 text-xl font-semibold text-grafite-900">{res.nome}</p>
          {res.unidade && <p className="text-sm text-grafite-600/80">{res.unidade}</p>}
          <p className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm text-grafite-800">Confirma que o nome bate com a pessoa e aplica <strong>10% no Vendus</strong>.</p>
        </div>
      )}
      {estado === 'inativo' && res && (
        <div className="mt-6 rounded-2xl border-2 border-ambar-500 bg-ambar-500/10 p-6 text-center">
          <p className="font-display text-xl font-bold text-ambar-800">Cliente Beta sem benefício ativo</p>
          <p className="mt-1 text-grafite-700">{res.nome} saiu do programa. <strong>Não aplicar o desconto.</strong></p>
        </div>
      )}
      {estado === 'nao' && (
        <div className="mt-6 rounded-2xl border-2 border-red-600 bg-red-50 p-6 text-center">
          <p className="text-4xl">✗</p>
          <p className="mt-1 font-display text-xl font-bold text-red-700">Não é Cliente Beta</p>
          <p className="mt-1 text-grafite-700">Este número não está na lista. <strong>Não aplicar o desconto.</strong></p>
        </div>
      )}
      {estado === 'erro' && (
        <p role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700">Número inválido (3 dígitos) ou falha de ligação. Tenta outra vez.</p>
      )}

      {estado !== 'idle' && estado !== 'a_verificar' && (
        <button type="button" onClick={limpar} className="mt-4 w-full cursor-pointer rounded-full border border-creme-300 px-8 py-3 font-semibold uppercase tracking-widest text-grafite-700 transition-colors hover:border-ambar-500">Novo</button>
      )}
    </div>
  )
}
