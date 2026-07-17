// Blocos partilhados pelos ecrãs do admin (tema claro aprovado)
import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Cores dos gráficos: ambar-500 validado para contraste e CVD na
// superfície clara; tinta/grelha nos tons de texto da paleta
export const GRAFICO = {
  serie: '#c9822e',
  grelha: '#d9cfba',
  tinta: '#3a3f48',
  tintaForte: '#16181d',
}

export function TooltipGrafico({ active, payload, label, formatador }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-creme-300 bg-creme-50 px-3 py-2 text-xs shadow-lg">
      <p className="text-grafite-600/70">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5 font-semibold text-grafite-900">
          {p.name}: {formatador ? formatador(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export function CampoTexto({ rotulo, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        {rotulo}
      </span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-lg border border-creme-300 bg-creme-100 px-3 py-2.5 text-grafite-900 outline-none focus:border-ambar-500"
      />
    </label>
  )
}

export function useAviso() {
  const [aviso, setAviso] = useState('')
  function mostrarAviso(msg) {
    setAviso(msg)
    setTimeout(() => setAviso(''), 3000)
  }
  const Aviso = aviso ? (
    <p
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-grafite-900 px-6 py-3 text-sm font-semibold text-creme-50 shadow-lg"
    >
      {aviso}
    </p>
  ) : null
  return { mostrarAviso, Aviso }
}

// ── Reordenação partilhada (drag nativo + setas de fallback) ──

export function moverItem(lista, de, para) {
  const nova = [...lista]
  const [movido] = nova.splice(de, 1)
  nova.splice(para, 0, movido)
  return nova
}

export function useReordenacao(itens, setItens, tabela, aoErro) {
  const arrastado = useRef(null)

  async function aplicar(novaLista) {
    const comOrdem = novaLista.map((item, i) => ({ ...item, ordem: (i + 1) * 10 }))
    setItens(comOrdem)
    const alteracoes = comOrdem.filter((item, i) => novaLista[i].ordem !== item.ordem)
    const resultados = await Promise.all(
      alteracoes.map((u) => supabase.from(tabela).update({ ordem: u.ordem }).eq('id', u.id)),
    )
    if (resultados.some((r) => r.error)) aoErro?.()
  }

  function mover(de, para) {
    if (de === para || para < 0 || para >= itens.length) return
    aplicar(moverItem(itens, de, para))
  }

  const propsArrasto = (i) => ({
    draggable: true,
    onDragStart: (e) => {
      arrastado.current = i
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      if (arrastado.current != null && arrastado.current !== i) {
        mover(arrastado.current, i)
      }
      arrastado.current = null
    },
  })

  return { mover, propsArrasto }
}

export function SetasOrdem({ i, total, mover, rotulo }) {
  return (
    <span className="flex flex-col">
      <button
        type="button"
        onClick={() => mover(i, i - 1)}
        disabled={i === 0}
        aria-label={`Subir ${rotulo}`}
        className="cursor-pointer px-1 text-grafite-600/50 hover:text-ambar-600 disabled:opacity-20"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => mover(i, i + 1)}
        disabled={i === total - 1}
        aria-label={`Descer ${rotulo}`}
        className="cursor-pointer px-1 text-grafite-600/50 hover:text-ambar-600 disabled:opacity-20"
      >
        ▼
      </button>
    </span>
  )
}

// Pega de arrasto com dica visual
export function PegaArrasto() {
  return (
    <span
      aria-hidden="true"
      title="Arrasta para reordenar"
      className="cursor-grab text-grafite-600/50 active:cursor-grabbing"
    >
      ⠿
    </span>
  )
}

// Upload directo para o Supabase Storage (bucket "produtos")
export function UploadImagem({ valor, aoMudar, aoAvisar }) {
  const [aEnviar, setAEnviar] = useState(false)
  const inputRef = useRef(null)

  async function enviar(e) {
    const ficheiro = e.target.files?.[0]
    e.target.value = ''
    if (!ficheiro) return
    if (!ficheiro.type.startsWith('image/')) {
      aoAvisar('Escolhe um ficheiro de imagem (JPG, PNG, WebP…).')
      return
    }
    if (ficheiro.size > 5 * 1024 * 1024) {
      aoAvisar('Imagem acima de 5 MB. Reduz o tamanho antes de enviar.')
      return
    }
    setAEnviar(true)
    const ext = (ficheiro.name.split('.').pop() || 'jpg').toLowerCase()
    const caminho = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from('produtos')
      .upload(caminho, ficheiro, { cacheControl: '31536000' })
    setAEnviar(false)
    if (error) {
      aoAvisar('Erro no upload. Confirma que o bucket "produtos" existe (migração SQL).')
      return
    }
    const { data } = supabase.storage.from('produtos').getPublicUrl(caminho)
    aoMudar(data.publicUrl)
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-ambar-600">
        Imagem
      </span>
      {valor && (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-creme-300">
          <img src={valor} alt="Pré-visualização da imagem" className="aspect-[16/9] w-full object-cover" />
          <button
            type="button"
            onClick={() => aoMudar('')}
            className="absolute right-2 top-2 cursor-pointer rounded-full bg-grafite-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-creme-50 hover:bg-red-500/80"
          >
            Remover
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={enviar}
          className="hidden"
          aria-label="Enviar imagem"
        />
        <button
          type="button"
          disabled={aEnviar}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500 disabled:opacity-40"
        >
          {aEnviar ? 'A enviar…' : valor ? 'Substituir imagem' : '↑ Enviar imagem'}
        </button>
        <span className="text-xs text-grafite-600/70">ou cola um URL abaixo</span>
      </div>
    </div>
  )
}

export const BOTAO_PRIMARIO =
  'cursor-pointer rounded-full bg-ambar-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-grafite-950 hover:bg-ambar-400'
export const BOTAO_SECUNDARIO =
  'cursor-pointer rounded-full border border-creme-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-grafite-600 hover:border-ambar-500'
export const BOTAO_PERIGO =
  'cursor-pointer rounded-full border border-red-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:border-red-500'
export const CARTAO = 'rounded-xl border border-creme-300 bg-white/70'
export const CAMPO =
  'mt-1.5 w-full rounded-lg border border-creme-300 bg-creme-100 px-3 py-2.5 text-grafite-900 outline-none focus:border-ambar-500'
