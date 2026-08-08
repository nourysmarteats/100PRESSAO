// Cartão com QR code para imprimir e pôr no saco das entregas, ao balcão ou
// nas mesas — o caminho mais curto entre um cliente que veio pela plataforma e
// o canal próprio.
//
// O QR é gerado aqui, no browser, e não por um serviço externo: um cartaz que
// depende de um site de terceiros deixa de funcionar no dia em que esse site
// mudar de ideias, e já estaria impresso.
//
// Correção de nível alto (H): recupera até 30% do código danificado, que é o
// que faz um autocolante amarrotado dentro de um saco continuar a ler-se.
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../../lib/supabase'
import logoStamp from '../../../assets/logo-100pressao.png'
import { CAMPO, BOTAO_PRIMARIO } from './comuns'

// Dois destinos, para dois propósitos diferentes:
//   · encomendar — cai na loja, para quem quer comer hoje
//   · instalar   — cai no /app, página curta que só trata da instalação
const DESTINOS = [
  { id: 'loja', rotulo: 'Encomendar', base: 'https://www.100pressao.pt/restaurante', dica: 'Abre a loja' },
  { id: 'app', rotulo: 'Instalar app', base: 'https://www.100pressao.pt/app', dica: 'Abre a instalação' },
]

// A origem fica no URL para se saber por onde entrou cada cliente. Chega ao
// Google Analytics pelo page_location, que leva a query string completa
// (ver trackPageview). Não identifica ninguém: diz de que cartaz veio a visita,
// não quem a fez.
const ORIGENS = [
  { id: 'saco', rotulo: 'Saco de entrega', dica: 'Autocolante ou cartão dentro do saco' },
  { id: 'balcao', rotulo: 'Balcão', dica: 'Junto à caixa' },
  { id: 'mesa', rotulo: 'Mesa', dica: 'No cavalete ou no menu' },
  { id: 'flyer', rotulo: 'Flyer', dica: 'Distribuição em mão' },
]

function QrCode() {
  const [destino, setDestino] = useState('loja')
  const [origem, setOrigem] = useState('saco')
  const [svg, setSvg] = useState('')
  const [png, setPng] = useState('')
  const [poupanca, setPoupanca] = useState(null)

  const url = useMemo(() => {
    const d = DESTINOS.find((x) => x.id === destino) || DESTINOS[0]
    return `${d.base}?via=${origem}`
  }, [destino, origem])

  useEffect(() => {
    let vivo = true
    const opcoes = { errorCorrectionLevel: 'H', margin: 1, color: { dark: '#16181d', light: '#ffffff' } }
    QRCode.toString(url, { ...opcoes, type: 'svg', width: 512 }).then((s) => vivo && setSvg(s))
    QRCode.toDataURL(url, { ...opcoes, width: 1024 }).then((d) => vivo && setPng(d))
    return () => {
      vivo = false
    }
  }, [url])

  // A poupança anunciada tem de sair dos preços reais, não de um número
  // escolhido à mão — senão o cartaz promete o que a loja não cumpre.
  const carregarPoupanca = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('preco_online, preco_plataforma')
      .eq('disponivel', true)
      .gt('preco_online', 0)
      .gt('preco_plataforma', 0)
    if (error || !data?.length) return
    const online = data.reduce((s, p) => s + Number(p.preco_online), 0)
    const plataforma = data.reduce((s, p) => s + Number(p.preco_plataforma), 0)
    if (plataforma > 0) setPoupanca(Math.round((1 - online / plataforma) * 100))
  }, [])

  useEffect(() => {
    carregarPoupanca()
  }, [carregarPoupanca])

  return (
    <div className="space-y-8">
      <section className="print:hidden">
        <h3 className="font-display text-lg font-bold uppercase text-grafite-600">
          QR code do restaurante online
        </h3>
        <p className="mt-1 text-sm text-grafite-600/70">
          Para imprimir e pôr no saco das entregas, ao balcão ou nas mesas. Cada
          origem gera um endereço próprio, para se saber por onde entraram os
          clientes.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {DESTINOS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDestino(d.id)}
              className={`cursor-pointer rounded-full border px-5 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                destino === d.id
                  ? 'border-ambar-500 bg-ambar-500 text-grafite-950'
                  : 'border-creme-300 text-grafite-600 hover:border-grafite-600'
              }`}
              title={d.dica}
            >
              {d.rotulo}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {ORIGENS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrigem(o.id)}
              className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                origem === o.id
                  ? 'border-ambar-500 bg-ambar-500/10'
                  : 'border-creme-300 hover:border-grafite-600'
              }`}
            >
              <span className="block text-sm font-semibold text-grafite-900">{o.rotulo}</span>
              <span className="mt-0.5 block text-xs text-grafite-600/70">{o.dica}</span>
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
            Endereço no código
          </span>
          <input readOnly value={url} className={CAMPO} onFocus={(e) => e.target.select()} />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} className={BOTAO_PRIMARIO}>
            Imprimir cartão
          </button>
          {png && (
            <a
              href={png}
              download={`100pressao-qr-${destino}-${origem}.png`}
              className="inline-flex cursor-pointer items-center justify-center rounded-full border border-creme-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-600 transition-colors hover:border-grafite-600"
            >
              Descarregar PNG
            </a>
          )}
        </div>

        <p className="mt-4 text-sm text-grafite-600/70">
          Um QR não instala nada sozinho: abre um endereço. O destino "Instalar
          app" leva a uma página curta que só trata disso, em vez de deixar o
          cliente à procura do botão no rodapé da loja.
        </p>
      </section>

      {/* ── O cartão a imprimir ── */}
      <section
        aria-label="Cartão para impressão"
        className="mx-auto w-full max-w-sm rounded-3xl border-2 border-grafite-900 bg-white p-8 text-center print:border-0 print:shadow-none"
      >
        <img
          src={logoStamp}
          alt="100PRESSÃO"
          width="640"
          height="640"
          className="mx-auto h-20 w-20 rounded-full bg-grafite-900"
        />
        <p className="mt-4 font-display text-2xl font-bold uppercase leading-none tracking-tight text-grafite-900">
          {destino === 'app' ? 'Instala a nossa app' : 'Encomenda direto'}
        </p>
        {poupanca > 0 && (
          <p className="mt-2 font-display text-lg font-bold uppercase text-cobre-600">
            Poupa cerca de {poupanca}%
          </p>
        )}
        <p className="mt-2 text-sm text-grafite-600">
          Sem taxas de plataforma. Entrega e levantamento.
        </p>

        {svg && (
          <div
            className="mx-auto mt-5 w-52 [&>svg]:h-auto [&>svg]:w-full"
            // O SVG vem da biblioteca de QR, gerada aqui a partir do nosso
            // próprio endereço — não há entrada de utilizador nesta cadeia.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-grafite-600">
          Aponta a câmara
        </p>
        <p className="mt-3 text-xs text-grafite-600/70">100pressao.pt · Carnaxide</p>
      </section>
    </div>
  )
}

export default QrCode
