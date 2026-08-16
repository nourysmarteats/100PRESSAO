// Plugin de build: pré-renderiza o <head> de cada rota pública e gera o sitemap.
//
// Problema que resolve
// --------------------
// O site é uma SPA (React Router + react-helmet-async). O Vercel serve sempre o
// mesmo dist/index.html para todas as rotas, por isso o HTML de origem que o
// Googlebot recebe na primeira vaga de rastreio é idêntico em /, /cardapio,
// /contacto, etc.: título genérico "100PRESSÃO · Draft House", sem description e
// sem canonical. As tags corretas só aparecem depois de o Google executar o
// JavaScript (segunda vaga), o que é adiado e não é garantido num site novo.
//
// Como resolve
// ------------
// No fim do build escreve um ficheiro HTML por rota (dist/cardapio.html, …) a
// partir do index.html gerado pelo Vite, com <title>, <meta description>,
// canonical e Open Graph já escritos no HTML. O vercel.json tem "cleanUrls":
// true, por isso /cardapio serve cardapio.html; as rotas não pré-renderizadas
// (/admin, /staff, …) continuam a cair no rewrite para index.html.
//
// As tags injetadas levam data-rh="true" — é o atributo que o react-helmet-async
// usa para marcar as tags que gere. Ao hidratar, o Helmet remove-as e insere as
// suas, em vez de ficarem duplicadas (mesma convenção do SSR do Helmet).

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { loadEnv } from 'vite'
import { SEO_PAGES, ROTAS_INDEXAVEIS, ROTAS_PRERENDER } from '../src/seo/pages.js'
import { obterEmenta, construirEmentaHtml } from './gerar-ementa.js'

const SITE_URL = 'https://www.100pressao.pt'
const OG_IMAGE = '/og-image.jpg'
const OG_ALT = '100PRESSÃO — Cervejaria e petiscos em Carnaxide'

const escapar = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// A raiz canoniza como ".../" (com barra), não "..." — é a forma que o Google
// normaliza e tem de bater certo com o canonical do SEOHead.jsx.
const canonicalDe = (path) => `${SITE_URL}${path}`

function tagsHead({ title, description, path, noindex }) {
  const url = canonicalDe(path)
  const t = escapar(title)
  const d = escapar(description)
  const robots = noindex
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1'
  return `    <meta name="description" content="${d}" data-rh="true" />
    <link rel="canonical" href="${url}" data-rh="true" />
    <meta name="robots" content="${robots}" data-rh="true" />
    <meta property="og:type" content="website" data-rh="true" />
    <meta property="og:site_name" content="100PRESSÃO" data-rh="true" />
    <meta property="og:title" content="${t}" data-rh="true" />
    <meta property="og:description" content="${d}" data-rh="true" />
    <meta property="og:url" content="${url}" data-rh="true" />
    <meta property="og:image" content="${SITE_URL}${OG_IMAGE}" data-rh="true" />
    <meta property="og:image:width" content="1200" data-rh="true" />
    <meta property="og:image:height" content="630" data-rh="true" />
    <meta property="og:image:alt" content="${escapar(OG_ALT)}" data-rh="true" />
    <meta property="og:locale" content="pt_PT" data-rh="true" />
    <meta name="twitter:card" content="summary_large_image" data-rh="true" />
    <meta name="twitter:title" content="${t}" data-rh="true" />
    <meta name="twitter:description" content="${d}" data-rh="true" />
    <meta name="twitter:image" content="${SITE_URL}${OG_IMAGE}" data-rh="true" />
`
}

// Ficheiro de destino no dist para cada rota. "/" fica como index.html;
// "/quem-somos" fica como quem-somos.html (resolvido pelo cleanUrls do Vercel).
const ficheiroDe = (path) => (path === '/' ? 'index.html' : `${path.replace(/^\//, '')}.html`)

function gerarSitemap(rotas, dataISO) {
  const urls = rotas
    .map(
      ({ path }) => `  <url>
    <loc>${canonicalDe(path)}</loc>
    <lastmod>${dataISO}</lastmod>
  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gerado automaticamente no build por scripts/vite-plugin-seo.js.
     Não editar à mão: acrescentar a rota em ROTAS_INDEXAVEIS (src/seo/pages.js). -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export default function seoPrerender() {
  let dirSaida = 'dist'
  let env = {}

  return {
    name: '100pressao-seo-prerender',
    apply: 'build',

    configResolved(config) {
      dirSaida = config.build.outDir || 'dist'
      // Duas fontes, por esta ordem: os ficheiros .env (loadEnv), que é como
      // funciona em local, e process.env, que é como funciona no Vercel — lá as
      // variáveis estão no ambiente e não há .env no repositório. Sem isto a
      // ementa era gerada do snapshot em local, sem erro visível.
      env = { ...loadEnv(config.mode, config.envDir, 'VITE_'), ...process.env }
    },

    async closeBundle() {
      const caminhoIndex = join(dirSaida, 'index.html')
      const bruto = await readFile(caminhoIndex, 'utf8')

      if (!bruto.includes('</head>')) {
        this.warn('[seo] index.html sem </head> — pré-renderização ignorada.')
        return
      }

      // O ficheiro de partida é o index.html, e a rota "/" volta a escrever
      // por cima dele. Se o plugin correr duas vezes sobre o mesmo dist (build
      // sem limpar, watch, script chamado à mão), a segunda passagem leria um
      // index.html já injetado e duplicaria description, canonical e robots —
      // e duas descriptions são pior do que nenhuma. Limpar as tags marcadas
      // com data-rh torna a operação idempotente.
      // Nota: o quantificador final tem de ser [ \t]* e não \s* — \s* engole o
      // \n e a indentação da linha seguinte, o que faz o âncora ^ falhar na tag
      // seguinte e deixa uma linha sim, outra não por remover.
      const base = bruto
        .replace(/^[ \t]*<(?:meta|link)\b[^>]*\bdata-rh="true"[^>]*>[ \t]*\r?\n/gm, '')
        .replace('<title data-rh="true">', '<title>')

      for (const rota of ROTAS_PRERENDER) {
        const html = base
          .replace(/<title>[\s\S]*?<\/title>/, `<title data-rh="true">${escapar(rota.title)}</title>`)
          .replace('</head>', `${tagsHead(rota)}  </head>`)

        const destino = join(dirSaida, ficheiroDe(rota.path))
        await mkdir(dirname(destino), { recursive: true })
        await writeFile(destino, html, 'utf8')
      }

      // Ementa pública: HTML estático próprio, sem React. É a única página do
      // site cujo conteúdo (e não só o <head>) fica legível sem executar JS —
      // por isso é a que tem hipótese real de aparecer em "petiscos Carnaxide".
      const { categorias, fonte } = await obterEmenta(import.meta.url, env)
      await writeFile(
        join(dirSaida, 'ementa.html'),
        construirEmentaHtml(categorias, { gaId: 'G-KLXQVNJZ5H' }),
        'utf8',
      )
      const totalItens = categorias.reduce((n, c) => n + c.itens.length, 0)

      const hoje = new Date().toISOString().slice(0, 10)
      await writeFile(join(dirSaida, 'sitemap.xml'), gerarSitemap(ROTAS_INDEXAVEIS, hoje), 'utf8')

      const total = Object.keys(SEO_PAGES).length
      this.info?.(
        `[seo] ${ROTAS_PRERENDER.length} rotas pré-renderizadas (de ${total} definidas) + sitemap.xml`,
      )
      console.log(
        `\n[seo] ${ROTAS_PRERENDER.length} páginas com <head> estático + sitemap.xml (lastmod ${hoje}, ${ROTAS_INDEXAVEIS.length} URLs)` +
          `\n[seo] /ementa gerada de ${fonte}: ${categorias.length} secções, ${totalItens} itens` +
          (fonte === 'snapshot'
            ? '\n[seo] AVISO: Supabase não respondeu no build — ementa vinda do snapshot committed.'
            : ''),
      )
    },
  }
}
