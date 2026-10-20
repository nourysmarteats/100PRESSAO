// Impressão do talão da fatura na impressora térmica do balcão.
//
// Montagem (out 2026): iggual TP EASY 58 (papel de 58 mm, área útil 48 mm),
// por USB ao Mac do ponto de recolha, instalada no macOS como
// "POS58_100PRESSAO" com o driver ZJ-58 e definida como impressora
// predefinida. O Staff corre nesse Mac num Chrome aberto com --kiosk-printing,
// que imprime directamente na predefinida sem mostrar a janela de impressão.
// Num Chrome normal aparece a janela — funciona na mesma, com um clique a mais.
//
// O documento vem da Vendus (rota /api/fatura-pdf com formato 'talao'): não se
// desenha a fatura aqui, para o talão sair com tudo o que a lei exige.
import { supabase } from './supabase'

// Lembra, neste browser, que faturas já saíram em original — as reimpressões
// seguintes saem como 2.ª via. É uma conveniência do balcão, não um registo:
// se a memória do browser se perder, o pior é sair outro "original".
const CHAVE = 'talao-impressos-v1'
function jaImpressos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || '{}')
  } catch {
    return {}
  }
}
function marcarImpresso(docId) {
  try {
    const m = jaImpressos()
    m[docId] = Date.now()
    // Guarda só os últimos 500 para não crescer sem fim.
    const recentes = Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
    localStorage.setItem(CHAVE, JSON.stringify(Object.fromEntries(recentes)))
  } catch {
    /* sem armazenamento: segue sem memória */
  }
}
export const jaFoiImpresso = (docId) => !!(docId && jaImpressos()[docId])

// Largura do papel. A área imprimível de um rolo de 58 mm é 48 mm.
const CSS_TALAO = `
@page { size: 58mm auto; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
body { width: 48mm; margin-left: 5mm !important; font-size: 10px; line-height: 1.25; color: #000; }
body * { max-width: 48mm !important; box-sizing: border-box; }
img, svg, canvas { max-width: 100% !important; height: auto !important; }
table { width: 100% !important; border-collapse: collapse; }
`

function imprimirNumIframe(montar) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)
    const limpar = () => setTimeout(() => iframe.remove(), 60000)
    iframe.onload = () => {
      // Dá tempo a que o QR e as imagens carreguem antes de imprimir.
      setTimeout(() => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
          resolve()
        } catch (e) {
          reject(e)
        }
        limpar()
      }, 400)
    }
    try {
      montar(iframe)
    } catch (e) {
      iframe.remove()
      reject(e)
    }
  })
}

export async function imprimirTalao(pedidoId, documentoId, { segundaVia } = {}) {
  const via = (segundaVia ?? jaFoiImpresso(documentoId)) ? 'SECOND' : 'ORIGINAL'
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/fatura-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data?.session?.access_token}`,
    },
    body: JSON.stringify({ pedido_id: pedidoId, formato: 'talao', via }),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.erro || 'Erro no servidor.')

  if (json.formato === 'html' && json.html) {
    await imprimirNumIframe((iframe) => {
      const html = /<head[\s>]/i.test(json.html)
        ? json.html.replace(/<head([\s>])/i, `<head$1<style>${CSS_TALAO}</style>`)
        : `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_TALAO}</style></head><body>${json.html}</body></html>`
      iframe.srcdoc = html
    })
  } else if (json.pdf_base64) {
    const bytes = Uint8Array.from(atob(json.pdf_base64), (c) => c.charCodeAt(0))
    const endereco = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    await imprimirNumIframe((iframe) => {
      iframe.src = endereco
    })
    setTimeout(() => URL.revokeObjectURL(endereco), 60000)
  } else {
    throw new Error('O Vendus não devolveu o talão.')
  }

  marcarImpresso(documentoId)
  return { via }
}
