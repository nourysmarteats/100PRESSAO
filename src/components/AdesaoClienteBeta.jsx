import { useEffect, useState } from 'react'
import { supabasePublico } from '../lib/supabase'
import { validarAdesao } from '../lib/beta'

export default function AdesaoClienteBeta({ token }) {
  const [dados, setDados] = useState({ aceita_regulamento: false, aviso_lido: false })
  const [estado, setEstado] = useState('idle')
  const [erro, setErro] = useState('')
  useEffect(() => {
    // O segredo fica apenas em memória. Não entra em navegação, partilhas ou histórico futuro.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }, [])
  async function aderir(e) {
    e.preventDefault()
    if (estado === 'a_enviar') return
    const erros = validarAdesao(dados)
    if (erros.length) return setErro(erros.join(' '))
    setEstado('a_enviar'); setErro('')
    const { data, error } = await supabasePublico.rpc('aderir_cliente_beta', {
      p_token: token, p_aceita_regulamento: true, p_aviso_lido: true,
    })
    if (error || !data?.[0]?.adesao_registada) {
      setEstado('idle')
      setErro('Não foi possível confirmar a adesão. Verifica a ligação; se o acesso já foi usado ou expirou, pede ajuda à equipa.')
      return
    }
    setEstado('concluido')
  }
  return <main className="min-h-dvh bg-creme-50 px-6 py-16 text-grafite-900">
    <meta name="referrer" content="no-referrer" />
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Adesão Cliente Beta</h1>
      {estado === 'concluido' ? <p role="status">Adesão registada. A tua inscrição original foi preservada. Os benefícios começam na inauguração da unidade da inscrição.</p> : <form onSubmit={aderir} className="space-y-5">
        <p>Este acesso é pessoal. A adesão preserva a elegibilidade da inscrição anterior e não altera as tuas preferências de publicidade.</p>
        <p>Depois da inauguração da unidade da inscrição: 10% no consumo próprio e acesso à ementa exclusiva, nos termos do regulamento. Durante a beta estes benefícios não se aplicam.</p>
        <label className="flex items-start gap-3"><input type="checkbox" checked={dados.aceita_regulamento} onChange={(e) => setDados({ ...dados, aceita_regulamento: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" /><span>Aceito o <a href="/legal/cliente-beta/regulamento-2026-09-14.v1.txt" target="_blank" rel="noreferrer" className="underline">regulamento Cliente Beta</a>.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" checked={dados.aviso_lido} onChange={(e) => setDados({ ...dados, aviso_lido: e.target.checked })} className="mt-1 h-5 w-5 shrink-0" /><span>Li o <a href="/legal/cliente-beta/aviso-2026-09-14.v1.txt" target="_blank" rel="noreferrer" className="underline">aviso de privacidade</a>.</span></label>
        {erro && <p role="alert" className="text-red-700">{erro}</p>}
        <button type="submit" disabled={estado === 'a_enviar'} className="rounded-xl bg-cobre-600 px-6 py-3 font-bold text-white disabled:opacity-50">{estado === 'a_enviar' ? 'A registar…' : 'Confirmar adesão'}</button>
      </form>}
    </div>
  </main>
}
