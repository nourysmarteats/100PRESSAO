// Restaurante online (jul 2026) — configuração do canal de encomendas próprio:
// interruptor de ativação, mínimo de encomenda e regra de entrega (grátis até
// X km, depois Y €/km) e a localização da loja (para o cálculo de distância).
// Guardado na tabela definicoes sob a chave 'entrega' (JSON). O storefront e o
// checkout (a construir) leem esta configuração.
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { registarAuditoria } from '../../../lib/equipa'
import { useAviso, BOTAO_PRIMARIO, CARTAO, CAMPO } from './comuns'

// Valores por omissão combinados com o Leandro (2026-07-24). Coordenadas da
// loja iguais às do mapa da página Contacto (Carnaxide).
const CONFIG_INICIAL = {
  ativo: false,
  cartao_ativo: false,
  pix_ativo: false,
  dinheiro_ativo: false,
  min_encomenda: 20,
  km_gratis: 2,
  taxa_base: 1.6,
  preco_km: 0.9,
  raio_max: 12,
  prazo_preparacao: 20,
  loja_lat: 38.7262329,
  loja_lng: -9.2369446,
  // Geridos no painel Estafetas; lidos aqui só para calcular a margem.
  estafeta_base: 2,
  estafeta_km: 0.4,
}

// Os preços online estão todos a 1,10 × o preço de balcão. Desse acréscimo
// nasce a margem que suporta a entrega: num carrinho de X €, o que entra a mais
// por ser online é X − X/1,10, ou seja X/11.
const FATOR_ONLINE = 1.1
const acrescimoOnline = (subtotal) => subtotal - subtotal / FATOR_ONLINE

const eur = (n) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',')} €`
const km1 = (n) => `${n.toFixed(1).replace('.', ',')} km`

// Mesma regra do checkout (Restaurante.jsx): grátis até km_gratis — e é mesmo
// zero, não a taxa base — e só acima disso taxa base + km adicionais.
const portesA = (d, c) => (d <= c.km_gratis ? 0 : c.taxa_base + c.preco_km * (d - c.km_gratis))
const custoA = (d, c) => c.estafeta_base + c.estafeta_km * d

// Distância a que os portes cobrados igualam o que se paga ao estafeta.
// Abaixo dela a entrega dá prejuízo em si mesma; acima, sobra.
// Só existe se o preço/km cobrado ao cliente for diferente do pago ao estafeta.
function equilibrio(c) {
  const declive = c.preco_km - c.estafeta_km
  if (Math.abs(declive) < 1e-9) return null
  const d = (c.estafeta_base - c.taxa_base + c.preco_km * c.km_gratis) / declive
  return d > c.km_gratis && d < c.raio_max ? d : null
}

const num = (v, fallback = 0) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

function Campo({ rotulo, sufixo, dica, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        {rotulo}
      </span>
      <div className="mt-2 flex items-center gap-2">
        <input {...props} className={`${CAMPO} mt-0`} />
        {sufixo && <span className="text-sm text-grafite-600/70">{sufixo}</span>}
      </div>
      {dica && <span className="mt-1 block text-xs text-grafite-600/70">{dica}</span>}
    </label>
  )
}

// Confronta o que se cobra de portes com o que se paga ao estafeta, à medida
// que se mexe nos campos acima. Serve uma decisão concreta: os portes não têm
// de se pagar a si próprios, porque o acréscimo online já entra em cada
// carrinho — o que não pode é a soma dos dois ficar negativa.
function EconomiaEntrega({ cfg, entregas }) {
  const c = {
    km_gratis: num(cfg.km_gratis),
    taxa_base: num(cfg.taxa_base),
    preco_km: num(cfg.preco_km),
    raio_max: num(cfg.raio_max, 12),
    min_encomenda: num(cfg.min_encomenda),
    estafeta_base: num(cfg.estafeta_base, 2),
    estafeta_km: num(cfg.estafeta_km, 0.4),
  }
  // Carrinho mínimo: o pior caso realista, já que abaixo disto não se encomenda.
  const almofada = acrescimoOnline(c.min_encomenda)
  const dEquilibrio = equilibrio(c)

  const faixas = [1, 2, 3, 4, 6, 8, 10, 12].filter((d) => d <= c.raio_max)
  if (c.raio_max > 0 && !faixas.includes(c.raio_max)) faixas.push(c.raio_max)

  const reais = (entregas || []).reduce(
    (a, e) => ({
      n: a.n + 1,
      km: a.km + Number(e.distancia_km || 0),
      portes: a.portes + Number(e.portes || 0),
      pago: a.pago + Number(e.estafeta_taxa || 0),
      subtotal: a.subtotal + (Number(e.total || 0) - Number(e.portes || 0)),
    }),
    { n: 0, km: 0, portes: 0, pago: 0, subtotal: 0 },
  )

  return (
    <div className={`${CARTAO} p-6`}>
      <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
        Economia da entrega
      </h3>
      <p className="mt-1 text-sm text-grafite-600/70">
        Atualiza enquanto mexes nos campos acima — ainda antes de guardares. Os
        portes não precisam de cobrir o estafeta sozinhos: como os preços online
        são 10% acima do balcão, cada carrinho traz{' '}
        <strong className="text-grafite-900">{eur(almofada)}</strong> de folga já
        na encomenda mínima de {eur(c.min_encomenda)}.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-125 text-sm">
          <thead>
            <tr className="border-b border-creme-300 text-left text-xs uppercase tracking-widest text-ambar-600">
              <th className="pb-2 pr-3 font-semibold">Distância</th>
              <th className="pb-2 pr-3 text-right font-semibold">Portes</th>
              <th className="pb-2 pr-3 text-right font-semibold">Estafeta</th>
              <th className="pb-2 pr-3 text-right font-semibold">Só a entrega</th>
              <th className="pb-2 text-right font-semibold">Com acréscimo online</th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((d) => {
              const so = portesA(d, c) - custoA(d, c)
              const total = so + almofada
              return (
                <tr key={d} className="border-b border-creme-200/60 last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-grafite-600">{km1(d)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-grafite-600">
                    {eur(portesA(d, c))}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-grafite-600">
                    −{eur(custoA(d, c))}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${so < 0 ? 'text-red-600' : 'text-grafite-600'}`}
                  >
                    {so >= 0 ? '+' : '−'}
                    {eur(Math.abs(so))}
                  </td>
                  <td
                    className={`py-2 text-right font-semibold tabular-nums ${total < 0 ? 'text-red-600' : 'text-grafite-900'}`}
                  >
                    {total >= 0 ? '+' : '−'}
                    {eur(Math.abs(total))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-grafite-600/70">
        {dEquilibrio
          ? `Os portes igualam o estafeta aos ${km1(dEquilibrio)}: abaixo disso a entrega
             em si dá prejuízo, acima começa a sobrar. Com o acréscimo online contado,
             o que interessa é a última coluna não ficar negativa.`
          : `Dentro do raio de ${km1(c.raio_max)} os portes nunca cruzam o custo do
             estafeta — a diferença mantém o mesmo sinal em todas as distâncias.`}
      </p>

      {/* O que realmente aconteceu, para a simulação não viver sozinha. */}
      <div className="mt-5 border-t border-creme-300 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
          Entregas já feitas
        </h4>
        {entregas === null ? (
          <p className="mt-2 text-sm text-grafite-600/70">A carregar…</p>
        ) : reais.n === 0 ? (
          <p className="mt-2 text-sm text-grafite-600/70">
            Ainda não há entregas com estafeta atribuído. Assim que houver, aparece
            aqui o confronto entre o simulado e o cobrado.
          </p>
        ) : (
          <dl className="mt-3 grid gap-4 sm:grid-cols-4">
            {[
              ['Entregas', String(reais.n)],
              ['Distância média', km1(reais.km / reais.n)],
              ['Portes − estafetas', `${reais.portes - reais.pago >= 0 ? '+' : '−'}${eur(Math.abs(reais.portes - reais.pago))}`],
              [
                'Com acréscimo online',
                `${reais.portes - reais.pago + acrescimoOnline(reais.subtotal) >= 0 ? '+' : '−'}${eur(Math.abs(reais.portes - reais.pago + acrescimoOnline(reais.subtotal)))}`,
              ],
            ].map(([r, v]) => (
              <div key={r}>
                <dt className="text-xs uppercase tracking-widest text-grafite-600/70">{r}</dt>
                <dd className="mt-1 font-display text-xl font-bold text-grafite-900 tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

function RestauranteOnline() {
  const [cfg, setCfg] = useState(null)
  // Este formulário só gere parte da chave 'entrega'. As taxas do estafeta
  // vivem na mesma linha mas são geridas no painel Estafetas — sem isto,
  // guardar aqui apagava-as silenciosamente.
  const [outrasChaves, setOutrasChaves] = useState({})
  const [entregas, setEntregas] = useState(null)
  const [tabelaEmFalta, setTabelaEmFalta] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const { mostrarAviso, Aviso } = useAviso()

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data, error } = await supabase
        .from('definicoes')
        .select('valor')
        .eq('chave', 'entrega')
        .maybeSingle()
      if (!ativo) return
      if (error) {
        setTabelaEmFalta(true)
        return
      }
      setOutrasChaves(data?.valor || {})
      setCfg({ ...CONFIG_INICIAL, ...(data?.valor || {}) })
    }
    carregar()
    // Entregas já pagas a estafetas: o que aconteceu de facto, para confrontar
    // com a simulação em cima.
    supabase
      .from('orders')
      .select('distancia_km, portes, total, estafeta_taxa')
      .eq('canal', 'online')
      .eq('tipo_entrega', 'entrega')
      .not('estafeta_taxa', 'is', null)
      .then(({ data }) => ativo && setEntregas(data || []))
    return () => {
      ativo = false
    }
  }, [])

  const alterar = (campo) => (e) => setCfg((c) => ({ ...c, [campo]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setOcupado(true)
    const valor = {
      ...outrasChaves,
      ativo: !!cfg.ativo,
      cartao_ativo: !!cfg.cartao_ativo,
      pix_ativo: !!cfg.pix_ativo,
      dinheiro_ativo: !!cfg.dinheiro_ativo,
      min_encomenda: num(cfg.min_encomenda, 0),
      km_gratis: num(cfg.km_gratis, 0),
      taxa_base: num(cfg.taxa_base, 0),
      preco_km: num(cfg.preco_km, 0),
      raio_max: num(cfg.raio_max, 0),
      prazo_preparacao: num(cfg.prazo_preparacao, 20),
      loja_lat: num(cfg.loja_lat, CONFIG_INICIAL.loja_lat),
      loja_lng: num(cfg.loja_lng, CONFIG_INICIAL.loja_lng),
    }
    const { error } = await supabase
      .from('definicoes')
      .upsert({ chave: 'entrega', valor, atualizado_em: new Date().toISOString() })
    setOcupado(false)
    if (error) {
      mostrarAviso('Erro ao guardar a configuração.')
      return
    }
    setOutrasChaves(valor)
    setCfg((c) => ({ ...c, ...valor }))
    registarAuditoria('entrega_config_alterada', valor)
    mostrarAviso('Configuração guardada ✓')
  }

  if (tabelaEmFalta) {
    return (
      <p className={`${CARTAO} p-6 text-grafite-600`}>
        A tabela de definições ainda não existe. Aplica a migração
        <code className="mx-1 rounded bg-creme-100 px-1.5">docs/sql/2026-07-11-v2-equipa-combos-config.sql</code>
        no SQL Editor do Supabase.
      </p>
    )
  }
  if (!cfg) return <p className="text-grafite-600/70">A carregar…</p>

  return (
    <form onSubmit={guardar} className="space-y-8">
      {/* Interruptor de ativação */}
      <div className={`${CARTAO} p-6`}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!cfg.ativo}
            onChange={(e) => setCfg((c) => ({ ...c, ativo: e.target.checked }))}
            className="mt-1 h-5 w-5 accent-ambar-500"
          />
          <span>
            <span className="font-display text-lg font-bold uppercase text-grafite-900">
              Restaurante online ativo
            </span>
            <span className="mt-1 block text-sm text-grafite-600/70">
              Quando ligado, os clientes podem encomendar para entrega e
              levantamento no site. Mantém desligado até tudo estar pronto
              (preços online, pagamento e chave de mapas). O atendimento à mesa
              não é afetado por isto.
            </span>
          </span>
        </label>
      </div>

      {/* Pagamento por cartão — só depois de contratado no IfThenPay */}
      <div className={`${CARTAO} p-6`}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!cfg.cartao_ativo}
            onChange={(e) => setCfg((c) => ({ ...c, cartao_ativo: e.target.checked }))}
            className="mt-1 h-5 w-5 accent-ambar-500"
          />
          <span>
            <span className="font-display text-lg font-bold uppercase text-grafite-900">
              Aceitar cartão, Google Pay e Apple Pay
            </span>
            <span className="mt-1 block text-sm text-grafite-600/70">
              Acrescenta a opção "Cartão · Pay" ao checkout, que abre o gateway
              do IfThenPay com cartão Visa/Mastercard, Google Pay e Apple Pay (as
              carteiras só aparecem em dispositivos compatíveis). Só ligar depois
              de os métodos estarem contratados no IfThenPay <em>e</em> das chaves
              IFTHENPAY_GATEWAY_KEY, IFTHENPAY_CCARD_KEY, IFTHENPAY_GOOGLE_KEY e
              IFTHENPAY_APPLE_KEY estarem no Vercel — caso contrário o cliente
              escolhe e o pagamento falha. MB Way e Multibanco não dependem disto.
            </span>
          </span>
        </label>
      </div>

      {/* Pix — moeda por confirmar com o IfThenPay */}
      <div className={`${CARTAO} p-6`}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!cfg.pix_ativo}
            onChange={(e) => setCfg((c) => ({ ...c, pix_ativo: e.target.checked }))}
            className="mt-1 h-5 w-5 accent-ambar-500"
          />
          <span>
            <span className="font-display text-lg font-bold uppercase text-grafite-900">
              Aceitar Pix
            </span>
            <span className="mt-1 block text-sm text-grafite-600/70">
              Pagamento instantâneo brasileiro, para clientes com conta no Brasil.
              Pede o CPF no checkout. Precisa da IFTHENPAY_PIX_KEY no Vercel.
            </span>
            <span className="mt-2 block text-sm text-grafite-600/70">
              O cliente paga em reais; o câmbio é feito pelo IfThenPay, que liquida
              em euros. Os preços seguem em euros, como nos restantes métodos.
            </span>
          </span>
        </label>
      </div>

      {/* Dinheiro à entrega / ao levantar */}
      <div className={`${CARTAO} p-6`}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!cfg.dinheiro_ativo}
            onChange={(e) => setCfg((c) => ({ ...c, dinheiro_ativo: e.target.checked }))}
            className="mt-1 h-5 w-5 accent-ambar-500"
          />
          <span>
            <span className="font-display text-lg font-bold uppercase text-grafite-900">
              Aceitar dinheiro na entrega
            </span>
            <span className="mt-1 block text-sm text-grafite-600/70">
              A encomenda é confirmada logo e vai para a cozinha sem pagamento
              prévio; cobra-se ao entregar ou ao levantar. Ao confirmar a entrega
              no painel Staff, a encomenda passa a paga.
            </span>
            <span className="mt-2 block text-sm text-grafite-600/70">
              É o único método sem dinheiro garantido à partida: uma encomenda
              falsa custa a comida e a deslocação. Desliga aqui se acontecer.
            </span>
          </span>
        </label>
      </div>

      {/* Entrega */}
      <div className={`${CARTAO} p-6`}>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">Entrega</h3>
        <p className="mt-1 text-sm text-grafite-600/70">
          Grátis até aos km indicados; acima disso, uma taxa base + preço por km adicional,
          até ao raio máximo (distância de condução até à loja).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Campo
            rotulo="Encomenda mínima"
            sufixo="€"
            inputMode="decimal"
            value={cfg.min_encomenda}
            onChange={alterar('min_encomenda')}
          />
          <Campo
            rotulo="Grátis até"
            sufixo="km"
            inputMode="decimal"
            value={cfg.km_gratis}
            onChange={alterar('km_gratis')}
          />
          <Campo
            rotulo="Raio máximo"
            sufixo="km"
            inputMode="decimal"
            value={cfg.raio_max}
            onChange={alterar('raio_max')}
          />
          <Campo
            rotulo="Taxa base (acima do grátis)"
            sufixo="€"
            inputMode="decimal"
            value={cfg.taxa_base}
            onChange={alterar('taxa_base')}
          />
          <Campo
            rotulo="Por km adicional"
            sufixo="€/km"
            inputMode="decimal"
            value={cfg.preco_km}
            onChange={alterar('preco_km')}
          />
          <Campo
            rotulo="Prazo de preparação"
            sufixo="min"
            inputMode="numeric"
            value={cfg.prazo_preparacao}
            onChange={alterar('prazo_preparacao')}
            dica="Mostrado ao cliente no checkout (requisito legal)."
          />
        </div>
      </div>

      <EconomiaEntrega cfg={cfg} entregas={entregas} />

      {/* Localização da loja */}
      <div className={`${CARTAO} p-6`}>
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          Localização da loja
        </h3>
        <p className="mt-1 text-sm text-grafite-600/70">
          Ponto de partida para calcular a distância da entrega. Já preenchido
          com a morada de Carnaxide; só mexe se mudar.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Latitude"
            inputMode="decimal"
            value={cfg.loja_lat}
            onChange={alterar('loja_lat')}
          />
          <Campo
            rotulo="Longitude"
            inputMode="decimal"
            value={cfg.loja_lng}
            onChange={alterar('loja_lng')}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
          {ocupado ? 'A guardar…' : 'Guardar configuração'}
        </button>
      </div>

      {Aviso}
    </form>
  )
}

export default RestauranteOnline
