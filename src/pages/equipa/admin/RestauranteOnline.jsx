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
  min_encomenda: 20,
  km_gratis: 2,
  taxa_base: 1.6,
  preco_km: 0.9,
  raio_max: 12,
  prazo_preparacao: 20,
  loja_lat: 38.7262329,
  loja_lng: -9.2369446,
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

function RestauranteOnline() {
  const [cfg, setCfg] = useState(null)
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
      setCfg({ ...CONFIG_INICIAL, ...(data?.valor || {}) })
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [])

  const alterar = (campo) => (e) => setCfg((c) => ({ ...c, [campo]: e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setOcupado(true)
    const valor = {
      ativo: !!cfg.ativo,
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
