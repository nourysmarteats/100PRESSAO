// App do estafeta — 100pressao.pt/estafeta (Fase 2A, ata de 2026-10-12).
//
// O estafeta pertence a uma EMPRESA; o 100PRESSÃO não lhe paga nem lhe dá ordens.
// Regras fixas que este ecrã respeita (art. 12.º-A CT):
//   · liga-se e desliga-se quando quer (Disponível / Indisponível);
//   · cada oferta aceita-se ou recusa-se livremente, sem consequência;
//   · a oferta NÃO mostra valor — o preço é tratado com a empresa;
//   · não há GPS nesta fase.
//
// O acesso nasce de um convite da empresa (/estafeta?convite=…): o servidor cria a
// conta e este telemóvel fica com a sessão. Não há password para decorar.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabaseEstafeta as sb } from '../lib/supabase'
import SEOHead from '../components/SEOHead'
import { ESTADO_ENTREGA, porSemana, rotuloSemana } from '../lib/despacho'
import { ativarNotificacoes, pushAtivo, pushDisponivel } from '../lib/push'

const CARTAO = 'rounded-2xl border border-creme-300 bg-white/80 p-5'
const BOTAO = 'w-full cursor-pointer rounded-xl px-5 py-4 font-display text-base font-bold uppercase tracking-widest disabled:opacity-60'
const RECOLHA = 'Mercado Municipal de Carnaxide, Loja 6 e 7 — Praceta Eugénio de Castro'

// Alerta sonoro. Os browsers (sobretudo o Safari do iPhone) só deixam tocar som depois
// de um toque do utilizador no ecrã: criar o AudioContext dentro do aviso de tempo real
// falha em silêncio. Por isso o som é "desbloqueado" no primeiro toque e o mesmo
// contexto é reutilizado. No iPhone, com o botão lateral em silêncio, o som da página
// não toca — para isso existem as notificações.
let ctxSom = null
function desbloquearSom() {
  try {
    ctxSom = ctxSom || new (window.AudioContext || window.webkitAudioContext)()
    if (ctxSom.state === 'suspended') ctxSom.resume()
    const vazio = ctxSom.createBuffer(1, 1, 22050)
    const fonte = ctxSom.createBufferSource()
    fonte.buffer = vazio
    fonte.connect(ctxSom.destination)
    fonte.start(0)
  } catch {
    /* sem áudio neste dispositivo */
  }
  return somPronto()
}
const somPronto = () => !!ctxSom && ctxSom.state === 'running'

function tocar() {
  navigator.vibrate?.([300, 150, 300, 150, 300])
  if (!ctxSom) return
  try {
    if (ctxSom.state === 'suspended') ctxSom.resume()
    ;[0, 0.3, 0.6, 1.2, 1.5, 1.8].forEach((t, i) => {
      const o = ctxSom.createOscillator()
      const g = ctxSom.createGain()
      o.type = 'square'
      o.frequency.value = i % 2 ? 1175 : 880
      g.gain.value = 0.35
      o.connect(g).connect(ctxSom.destination)
      o.start(ctxSom.currentTime + t)
      o.stop(ctxSom.currentTime + t + 0.2)
    })
  } catch {
    /* a oferta aparece na mesma */
  }
}

// Mantém o ecrã ligado enquanto o estafeta está disponível com a app aberta.
let bloqueioEcra = null
async function manterEcraLigado(ligado) {
  try {
    if (ligado && 'wakeLock' in navigator && !bloqueioEcra) bloqueioEcra = await navigator.wakeLock.request('screen')
    if (!ligado && bloqueioEcra) {
      await bloqueioEcra.release()
      bloqueioEcra = null
    }
  } catch {
    bloqueioEcra = null
  }
}

const instalada = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

function AtivarAvisos() {
  const [estado, setEstado] = useState(pushAtivo() ? 'ativo' : 'idle')
  if (!pushDisponivel() || estado === 'ativo') return null
  return (
    <button type="button" onClick={async () => setEstado((await ativarNotificacoes(sb)) ? 'ativo' : 'recusado')}
      className="w-full cursor-pointer rounded-xl border border-ambar-500 bg-ambar-500/10 px-4 py-3 text-sm font-semibold text-ambar-900">
      {estado === 'recusado'
        ? 'As notificações estão bloqueadas. Ativa-as nas definições do telemóvel.'
        : 'Ativar notificações (recebes as entregas mesmo com a app fechada)'}
    </button>
  )
}

function AvisoInstalar() {
  if (instalada()) return null
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <div className="rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-4 text-sm text-ambar-900">
      <p className="font-semibold">Para receberes as chamadas de recolha:</p>
      <p className="mt-1">
        {ios
          ? 'instala a app no ecrã principal (botão Partilhar → "Adicionar ao ecrã principal")'
          : 'instala a app (menu ⋮ do browser → "Instalar app" ou "Adicionar ao ecrã principal")'}
        {' '}ou mantém esta página aberta enquanto estiveres disponível.
      </p>
    </div>
  )
}

function AceitarConvite({ convite, equipa = false, aoEntrar }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function aceitar(e) {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    const r = await fetch('/api/entregas-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(equipa ? { acao: 'aceitar-equipa', convite, nome, telefone } : { acao: 'aceitar-convite', convite, telefone }),
    })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) {
      setOcupado(false)
      return setErro(corpo.erro || 'Não foi possível aceitar o convite.')
    }
    const { error } = await sb.auth.signInWithPassword({ email: corpo.email, password: corpo.password })
    setOcupado(false)
    if (error) return setErro('Convite aceite, mas a entrada falhou. Peça um novo convite à sua empresa.')
    window.history.replaceState(null, '', '/estafeta') // o token sai do endereço
    aoEntrar()
  }
  return (
    <form onSubmit={aceitar} className={`${CARTAO} mt-6 space-y-4`}>
      <p className="text-grafite-700">
        A tua empresa convidou-te para fazeres entregas do restaurante online 100PRESSÃO.
        {equipa && ' Depois de entrares, a empresa ativa o teu acesso.'}
      </p>
      {equipa && (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">O teu nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required
            className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500" />
        </label>
      )}
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">O teu telemóvel</span>
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" required
          className="mt-2 w-full rounded-xl border border-creme-300 bg-creme-50 px-4 py-3 text-grafite-900 outline-none focus:border-ambar-500" />
      </label>
      <p className="text-xs text-grafite-600/80">
        Usamos o teu nome e telemóvel para te oferecer entregas e o cliente te poder contactar durante a entrega.
        Com a app aberta, e só enquanto estás disponível ou a meio de uma entrega, usamos a tua posição atual
        para te oferecer entregas próximas e para o cliente ver a entrega a chegar. Nunca guardamos o percurso:
        a posição é apagada quando ficas indisponível. Não é usada para te avaliar. Responsável: Sintonia dos
        Temperos. Dúvidas e direitos: geral@100pressao.pt
      </p>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button type="submit" disabled={ocupado} className={`${BOTAO} bg-cobre-600 text-creme-50`}>Aceitar convite</button>
    </form>
  )
}

// As minhas entregas, por semana (segunda a domingo). Só data, n.º e km das entregas
// concluídas pelo próprio: sem clientes, sem valores, sem recusas, sem tempos.
function MinhasEntregas() {
  const [semanas, setSemanas] = useState(null)
  useEffect(() => {
    sb.rpc('minhas_entregas', { p_semanas: 8 }).then(({ data }) => setSemanas(porSemana(data || [])))
  }, [])
  if (semanas === null) return <p className="text-center text-sm text-grafite-600">A carregar…</p>
  if (semanas.length === 0) return <p className={`${CARTAO} text-sm text-grafite-600`}>Ainda não tens entregas concluídas nas últimas 8 semanas.</p>
  return (
    <div className="space-y-3">
      {semanas.map((g) => (
        <details key={g.semana} className={CARTAO} open={g === semanas[0]}>
          <summary className="flex cursor-pointer items-center justify-between gap-3">
            <span className="font-semibold text-grafite-900">Semana de {rotuloSemana(g.semana)}</span>
            <span className="text-sm text-grafite-700">{g.entregas.length} entregas · {String(g.km).replace('.', ',')} km</span>
          </summary>
          <ul className="mt-3 divide-y divide-creme-300 text-sm">
            {g.entregas.map((l) => (
              <li key={l.numero} className="flex justify-between py-2">
                <span>N.º {l.numero} · {new Date(l.data).toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span>{String(l.distancia_km ?? '—').replace('.', ',')} km</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="text-center text-xs text-grafite-600/70">Últimas 8 semanas. Dúvidas sobre pagamentos: fala com a tua empresa.</p>
    </div>
  )
}

function Painel() {
  const [eu, setEu] = useState(null)
  const [ofertas, setOfertas] = useState([])
  const [entrega, setEntrega] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const vistas = useRef(new Set())
  const [som, setSom] = useState(somPronto())

  const carregar = useCallback(async () => {
    const { data: u } = await sb.auth.getUser()
    const [rEu, rOf, rEnt] = await Promise.all([
      sb.from('estafetas').select('id, nome, disponivel, ativo, aprovado').eq('user_id', u?.user?.id).maybeSingle(),
      sb.from('entregas_ofertas').select('id, order_id, distancia_km, criado_em').eq('estado', 'oferecida').order('criado_em'),
      sb.rpc('minha_entrega'),
    ])
    setEu(rEu.data || false)
    const novas = rOf.data || []
    if (novas.some((o) => !vistas.current.has(o.id))) tocar()
    novas.forEach((o) => vistas.current.add(o.id))
    setOfertas(novas)
    setEntrega(rEnt.data?.[0] || null)
  }, [])

  useEffect(() => {
    carregar()
    const canal = sb
      .channel('ofertas-estafeta')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas_ofertas' }, () => carregar())
      .subscribe()
    const t = setInterval(carregar, 15000) // reserva, se o tempo real falhar
    const toque = () => setSom(desbloquearSom())
    window.addEventListener('pointerdown', toque)
    return () => {
      sb.removeChannel(canal)
      clearInterval(t)
      window.removeEventListener('pointerdown', toque)
    }
  }, [carregar])

  // Enquanto houver uma oferta por responder, o alerta repete a cada 8 segundos.
  useEffect(() => {
    if (!ofertas.length) return
    const r = setInterval(tocar, 8000)
    return () => clearInterval(r)
  }, [ofertas.length])

  // Posição (Fase 2B): só é enviada quando serve para alguma coisa — despacho por
  // proximidade ligado, ou uma entrega a decorrer (o cliente acompanha). Só com a app
  // aberta, a cada 60 s. Ficar indisponível apaga-a no servidor. Nunca há histórico.
  const [modo, setModo] = useState('todos')
  useEffect(() => {
    sb.from('definicoes').select('valor').eq('chave', 'entrega').maybeSingle()
      .then(({ data }) => setModo(data?.valor?.despacho_modo || 'todos'))
  }, [])
  const enviaPosicao = !!eu?.ativo && ((eu?.disponivel && modo === 'proximidade') || !!entrega)
  const [gps, setGps] = useState('')
  useEffect(() => {
    if (!enviaPosicao || !('geolocation' in navigator)) return
    const enviar = () =>
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setGps('ok')
          sb.rpc('estafeta_posicao', { p_lat: p.coords.latitude, p_lng: p.coords.longitude })
        },
        () => setGps('recusado'),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
      )
    enviar()
    const t = setInterval(enviar, 60000)
    return () => clearInterval(t)
  }, [enviaPosicao])

  useEffect(() => {
    manterEcraLigado(!!eu?.disponivel)
    return () => manterEcraLigado(false)
  }, [eu?.disponivel])

  async function alternar() {
    setOcupado(true)
    await sb.rpc('estafeta_disponivel', { p_disponivel: !eu.disponivel })
    setOcupado(false)
    carregar()
  }

  async function aceitar(id) {
    setOcupado(true)
    const { data } = await sb.rpc('aceitar_oferta', { p_oferta: id })
    setOcupado(false)
    setAviso(data ? '' : 'Esta entrega já foi aceite por outro estafeta.')
    carregar()
  }

  async function recusar(id) {
    await sb.rpc('recusar_oferta', { p_oferta: id })
    carregar()
  }

  async function avancar() {
    setOcupado(true)
    await sb.rpc('avancar_entrega', { p_order: entrega.order_id })
    setOcupado(false)
    carregar()
  }

  const [separador, setSeparador] = useState('agora')

  if (eu === null) return <p className="mt-6 text-grafite-600">A carregar…</p>
  if (eu === false || !eu.ativo) {
    return (
      <div className={`${CARTAO} mt-6`}>
        <p className="text-grafite-700">Este acesso já não está ativo. Pede um novo convite à tua empresa.</p>
        <button type="button" className="mt-3 text-sm font-semibold text-cobre-600" onClick={() => sb.auth.signOut()}>Sair</button>
      </div>
    )
  }

  if (eu.aprovado === false) {
    return (
      <div className={`${CARTAO} mt-6`}>
        <p className="font-semibold text-grafite-900">Olá, {eu.nome.split(' ')[0]}!</p>
        <p className="mt-1 text-grafite-700">O teu acesso está à espera de ser ativado pela tua empresa. Quando estiver, esta página passa a mostrar as entregas.</p>
        <button type="button" className="mt-3 text-sm font-semibold text-cobre-600" onClick={carregar}>Verificar outra vez</button>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-creme-300 bg-white/70 p-1 text-sm font-semibold uppercase tracking-widest">
        {[['agora', 'Agora'], ['historico', 'As minhas entregas']].map(([id, r]) => (
          <button key={id} type="button" onClick={() => setSeparador(id)}
            className={`cursor-pointer rounded-full px-3 py-2 ${separador === id ? 'bg-grafite-900 text-creme-50' : 'text-grafite-600'}`}>{r}</button>
        ))}
      </div>
      {separador === 'historico' ? <MinhasEntregas /> : (<>
      <AvisoInstalar />
      <AtivarAvisos />
      {!som && (
        <button type="button" onClick={() => { setSom(desbloquearSom()); tocar() }}
          className="w-full cursor-pointer rounded-xl border border-grafite-600/30 bg-white px-4 py-3 text-sm font-semibold text-grafite-800">
          🔈 Tocar aqui para ativar o som dos alertas
        </button>
      )}
      {enviaPosicao && gps === 'recusado' && (
        <p className="rounded-xl border border-ambar-500/40 bg-ambar-500/10 p-3 text-xs text-ambar-900">
          Sem acesso à localização: recebes as ofertas na mesma, mas não por proximidade, e o cliente não vê a entrega no mapa.
          Usamos só a posição atual, enquanto estás disponível ou a meio de uma entrega — nunca o percurso.
        </p>
      )}
      {som && (
        <p className="text-center text-xs text-grafite-600">
          🔊 Som ativo. No iPhone, confirma que o botão lateral não está em silêncio.
        </p>
      )}
      <div className={`${CARTAO} flex items-center justify-between gap-3`}>
        <div>
          <p className="font-semibold text-grafite-900">{eu.nome}</p>
          <p className={`text-sm font-semibold ${eu.disponivel ? 'text-emerald-700' : 'text-grafite-600'}`}>
            {eu.disponivel ? 'Disponível para entregas' : 'Indisponível'}
          </p>
        </div>
        <button type="button" disabled={ocupado} onClick={alternar}
          className={`cursor-pointer rounded-full px-5 py-3 text-sm font-bold uppercase tracking-widest ${eu.disponivel ? 'border border-creme-300 text-grafite-700' : 'bg-emerald-600 text-white'}`}>
          {eu.disponivel ? 'Ficar indisponível' : 'Ficar disponível'}
        </button>
      </div>

      {entrega && (
        <div className={`${CARTAO} border-cobre-600/40`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">Entrega n.º {entrega.numero} · {ESTADO_ENTREGA[entrega.entrega_estado]}</p>
          {entrega.entrega_estado === 'aceite' ? (
            <p className="mt-2 text-grafite-800"><strong>Recolha:</strong> {RECOLHA}</p>
          ) : null}
          <p className="mt-2 text-lg font-semibold text-grafite-900">{entrega.cliente_nome}</p>
          <p className="text-grafite-800">{entrega.morada}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a className="rounded-full border border-creme-300 px-4 py-2 font-semibold" href={`tel:${entrega.cliente_telefone}`}>Ligar ao cliente</a>
            <a className="rounded-full border border-creme-300 px-4 py-2 font-semibold" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(entrega.morada || '')}`}>Abrir no mapa</a>
          </div>
          {entrega.pago ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">Já está pago. Não recebas dinheiro do cliente.</p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-red-600">Pagamento por confirmar: liga para o restaurante antes de entregar.</p>
          )}
          <button type="button" disabled={ocupado} onClick={avancar} className={`${BOTAO} mt-4 bg-cobre-600 text-creme-50`}>
            {entrega.entrega_estado === 'aceite' ? 'Recolhido' : 'Entregue'}
          </button>
        </div>
      )}

      {!entrega && ofertas.map((o) => (
        <div key={o.id} className={`${CARTAO} border-ambar-500`}>
          <p className="font-display text-xl font-bold uppercase text-grafite-900">Nova entrega</p>
          <p className="mt-1 text-grafite-700">Recolha: {RECOLHA}</p>
          <p className="text-grafite-700">Distância até ao cliente: {String(o.distancia_km ?? '—').replace('.', ',')} km</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" disabled={ocupado} onClick={() => recusar(o.id)} className={`${BOTAO} border border-creme-300 text-grafite-700`}>Recusar</button>
            <button type="button" disabled={ocupado} onClick={() => aceitar(o.id)} className={`${BOTAO} bg-emerald-600 text-white`}>Aceitar</button>
          </div>
        </div>
      ))}

      {!entrega && ofertas.length === 0 && eu.disponivel && (
        <p className="text-center text-sm text-grafite-600">À espera de entregas. Quando chegar uma, ouves um alerta.</p>
      )}
      {aviso && <p role="status" className="text-center text-sm font-semibold text-grafite-700">{aviso}</p>}
      </>)}
    </div>
  )
}

function Estafeta() {
  const [sessao, setSessao] = useState(undefined)
  const parametros = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const equipa = parametros?.get('equipa') || null
  const convite = parametros?.get('convite') || equipa
  useEffect(() => {
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!sb) return null
  return (
    <main className="min-h-screen bg-creme-50 text-grafite-800">
      <SEOHead title="Estafetas | 100PRESSÃO" description="Área reservada a estafetas das empresas parceiras." path="/estafeta" noindex manifest="/estafeta.webmanifest" />
      <div className="mx-auto max-w-md px-5 py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-ambar-600">100PRESSÃO · Entregas</p>
        {sessao === undefined ? null : convite && !sessao ? (
          <AceitarConvite convite={convite} equipa={!!equipa} aoEntrar={() => sb.auth.getSession().then(({ data }) => setSessao(data.session))} />
        ) : sessao ? (
          <Painel />
        ) : (
          <div className={`${CARTAO} mt-6`}>
            <p className="text-grafite-700">Para usar esta app precisas de um convite da tua empresa de entregas.</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default Estafeta
