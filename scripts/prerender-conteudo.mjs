// Passo final do build: injeta o conteúdo já renderizado (SSG) no <div id="root">
// de cada página estática, por cima do HTML que o vite-plugin-seo.js já escreveu
// com o <head> correto.
//
// Ordem no build (package.json):
//   1. vite build            → dist/ com <head> por rota (vite-plugin-seo.js)
//   2. vite build --ssr      → dist-ssr/entry-server.js (função render)
//   3. node este ficheiro    → lê o render e injeta o corpo em dist/*.html
//
// Só toca nas rotas de ROTAS_SSG. O cliente hidrata por cima (main.jsx deteta o
// data-prerendered). Idempotente: se o marcador já lá estiver, não duplica.
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIST = process.env.SSG_DIST || 'dist'
const SERVER_ENTRY = process.env.SSG_SERVER || 'dist-ssr/entry-server.js'

const ROTAS = [
  { url: '/', ficheiro: 'index.html' },
  { url: '/quem-somos', ficheiro: 'quem-somos.html' },
  { url: '/contacto', ficheiro: 'contacto.html' },
]

const PLACEHOLDER = '<div id="root"></div>'

const { render } = await import(pathToFileURL(resolve(SERVER_ENTRY)).href)

let feitos = 0
for (const { url, ficheiro } of ROTAS) {
  const caminho = join(DIST, ficheiro)
  let html
  try {
    html = await readFile(caminho, 'utf8')
  } catch {
    console.warn(`[ssg] ${ficheiro} não existe — ignorado.`)
    continue
  }
  if (html.includes('data-prerendered')) {
    console.warn(`[ssg] ${ficheiro} já tem conteúdo pré-renderizado — ignorado.`)
    continue
  }
  if (!html.includes(PLACEHOLDER)) {
    console.warn(`[ssg] ${ficheiro} sem <div id="root"> vazio — ignorado.`)
    continue
  }
  const corpo = render(url)
  const novo = html.replace(
    PLACEHOLDER,
    `<div id="root" data-prerendered="1">${corpo}</div>`,
  )
  await writeFile(caminho, novo, 'utf8')
  feitos++
  console.log(`[ssg] ${ficheiro}: conteúdo injetado (${corpo.length} chars).`)
}
console.log(`[ssg] ${feitos}/${ROTAS.length} páginas pré-renderizadas com conteúdo.`)
