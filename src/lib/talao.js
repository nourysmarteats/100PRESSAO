// Impressão do talão da fatura na impressora térmica do balcão.
//
// Montagem (out 2026): iggual TP EASY 58 (papel de 58 mm, área útil 48 mm),
// por USB ao Mac do ponto de recolha, instalada no macOS como
// "POS58_100PRESSAO" com o driver ZJ-58 e definida como impressora
// predefinida. O Staff corre nesse Mac num Chrome aberto com --kiosk-printing,
// que imprime directamente na predefinida sem mostrar a janela de impressão.
// Num Chrome normal aparece a janela — funciona na mesma, com um clique a mais.
//
// Tablet Android (out 2026): a mesma impressora ligada por USB (hub) a um
// tablet Lenovo. O Chrome do Android não tem --kiosk-printing nem driver para
// a iggual, por isso aí o talão segue para a app RawBT: desenha-se o HTML da
// Vendus num canvas de 384 pontos (a largura útil do rolo de 58 mm), converte-
// -se em raster ESC/POS e entrega-se ao RawBT por intent — sai sem janela,
// desde que no RawBT esteja marcado "Comece a imprimir automaticamente na
// impressora padrão". Se alguma coisa falhar, cai para a impressão normal
// (janela do Android, onde se escolhe o RawBT).
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

// ---------------------------------------------------------------
// Android → RawBT
// ---------------------------------------------------------------
const eAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

// 48 mm de área útil a 203 dpi = 384 pontos. Desenha-se a 192 px CSS e
// escala-se ×2 — o mesmo tamanho de letra que sai no Mac (10px em 48 mm).
const PONTOS = 384
const LARGURA_CSS = 192
const ESCALA = PONTOS / LARGURA_CSS

const CSS_TALAO_CANVAS = `
*{box-sizing:border-box;max-width:${LARGURA_CSS}px !important}
html,body{margin:0;padding:0;background:#fff;color:#000}
body{width:${LARGURA_CSS}px;font-size:10px;line-height:1.25;font-family:Arial,Helvetica,sans-serif}
img,svg,canvas{max-width:100% !important;height:auto !important}
table{width:100% !important;border-collapse:collapse}
`

// Mede a altura real do talão a esta largura, num iframe escondido.
function medirAltura(htmlCompleto) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${LARGURA_CSS}px;height:10px;border:0;visibility:hidden`
    document.body.appendChild(iframe)
    iframe.onload = () => {
      setTimeout(() => {
        let h = 600
        try {
          h = Math.ceil(iframe.contentDocument.documentElement.scrollHeight)
        } catch {
          /* fica a altura por defeito */
        }
        iframe.remove()
        resolve(Math.min(Math.max(h, 50), 4000))
      }, 300)
    }
    iframe.srcdoc = htmlCompleto
  })
}

// HTML → canvas via SVG <foreignObject> (sem bibliotecas). As imagens já vêm
// em data: URI do servidor, por isso o canvas não fica "sujo".
async function desenharTalao(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script').forEach((n) => n.remove())
  const estilos = [...doc.querySelectorAll('style')].map((n) => n.textContent).join('\n')
  const corpo = doc.body.innerHTML

  const completo = `<!doctype html><html><head><meta charset="utf-8"><style>${estilos}${CSS_TALAO_CANVAS}</style></head><body>${corpo}</body></html>`
  const altura = await medirAltura(completo)

  // XHTML válido para o foreignObject.
  const div = document.createElement('div')
  div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  div.innerHTML = `<style>${estilos}${CSS_TALAO_CANVAS}</style><div style="width:${LARGURA_CSS}px;background:#fff">${corpo}</div>`
  const xhtml = new XMLSerializer().serializeToString(div)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA_CSS}" height="${altura}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`

  const img = new Image()
  img.decoding = 'sync'
  await new Promise((ok, falha) => {
    img.onload = ok
    img.onerror = () => falha(new Error('Não consegui desenhar o talão.'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })

  const canvas = document.createElement('canvas')
  canvas.width = PONTOS
  canvas.height = Math.ceil(altura * ESCALA)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(ESCALA, ESCALA)
  ctx.drawImage(img, 0, 0)
  return canvas
}

// Canvas → bytes ESC/POS: inicializar, impulso à gaveta (igual ao Mac, onde o
// driver abre a gaveta antes de cada trabalho), raster GS v 0 em faixas e
// avanço de papel para rasgar.
function canvasParaEscPos(canvas) {
  const { width, height } = canvas
  const px = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const bytesLinha = width / 8
  const partes = [[0x1b, 0x40], [0x1b, 0x70, 0x00, 0x19, 0xfa]]
  const FAIXA = 255
  for (let y0 = 0; y0 < height; y0 += FAIXA) {
    const linhas = Math.min(FAIXA, height - y0)
    const faixa = new Uint8Array(8 + bytesLinha * linhas)
    faixa.set([0x1d, 0x76, 0x30, 0x00, bytesLinha & 0xff, bytesLinha >> 8, linhas & 0xff, linhas >> 8])
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < width; x++) {
        const i = ((y0 + y) * width + x) * 4
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
        if (px[i + 3] > 128 && lum < 160) faixa[8 + y * bytesLinha + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    partes.push(faixa)
  }
  partes.push([0x1b, 0x64, 0x04])
  const total = partes.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of partes) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function enviarParaRawBT(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  window.location.href = `intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

async function imprimirNoRawBT(html) {
  const canvas = await desenharTalao(html)
  enviarParaRawBT(canvasParaEscPos(canvas))
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

  // No tablet não há recurso à janela do Android: o teste de 26 out mostrou
  // que ela abre em A4 e não chega à térmica. Se o RawBT falhar, diz-se porquê.
  const viaRawBT = eAndroid()
  if (viaRawBT) {
    if (!(json.formato === 'html' && json.html)) {
      throw new Error('a Vendus devolveu o talão em PDF; no tablet só imprime em HTML')
    }
    try {
      await imprimirNoRawBT(json.html)
    } catch (e) {
      throw new Error(`RawBT: ${e.message || e}`)
    }
  } else if (json.formato === 'html' && json.html) {
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
  return { via, rawbt: viaRawBT }
}
