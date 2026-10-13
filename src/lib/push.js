// Subscrição de notificações push (Web Push). No iPhone só funciona com a app
// instalada no ecrã principal; no Android funciona também no browser.
const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushDisponivel = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!chavePublica

export const pushAtivo = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

function paraUint8(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Pede autorização, subscreve e guarda a subscrição na conta de quem está com sessão
// (cliente Supabase passado: equipa, empresa ou estafeta). Devolve true/false.
export async function ativarNotificacoes(cliente) {
  if (!pushDisponivel() || !cliente) return false
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraUint8(chavePublica) }))
  const j = sub.toJSON()
  const { data: u } = await cliente.auth.getUser()
  if (!u?.user) return false
  const { error } = await cliente
    .from('push_subscricoes')
    .upsert({ user_id: u.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  return !error
}

// Chamado pelo Staff (sessão da equipa). Nunca bloqueia o fluxo: se falhar, falha calado.
export async function avisarDespacho(supabase, acao, orderId, ofertaId = null) {
  try {
    const { data } = await supabase.auth.getSession()
    await fetch('/api/push-despacho', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ acao, order_id: orderId, oferta_id: ofertaId }),
    })
  } catch {
    /* sem rede ou sem chaves: o tempo real e o alerta no ecrã continuam a funcionar */
  }
}
