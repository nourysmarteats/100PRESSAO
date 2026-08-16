// Gera a página pública /ementa — HTML estático, sem React, sem JavaScript.
//
// Porque existe separada de /cardapio
// -----------------------------------
// O /cardapio é o sistema de pedidos: pede nome e mesa antes de mostrar seja o
// que for. O Googlebot vê um formulário e mais nada, por isso nenhuma pesquisa
// por "petiscos Carnaxide" ou "pastéis de bacalhau Oeiras" podia encontrar a
// casa — as palavras não existiam em lado nenhum do site.
//
// Esta página resolve isso: é servida como ficheiro estático (o cleanUrls do
// Vercel faz /ementa servir ementa.html antes de o rewrite da SPA agir), não
// depende do Supabase em runtime, não tem estado, e carrega instantaneamente.
//
// Dados: tenta ler do Supabase no momento do build; se falhar, usa o snapshot
// committed em scripts/ementa-snapshot.json. O build nunca parte por causa disto.
//
// Preços: ausentes por decisão do Leandro (15/08/2026). Os valores em base de
// dados parecem ser de custo e não de venda (Tosta Simples a 0,56 €, IPA a
// 1,84 €). Publicar preços errados é risco legal; a ementa indexa na mesma sem
// eles, porque o que o Google lê são os nomes e as descrições.

import { readFile } from 'node:fs/promises'
import { SITE_URL, MARCA, MORADA, GEO, HORARIO, SERVICOS, MAPA_URL } from '../src/lib/marca.js'
import { CERVEJAS_INTRO, ESTILOS, CERVEJAS_RODAPE } from '../src/seo/cervejas.js'

const CATEGORIAS_EXCLUIDAS = ['Ingredientes', 'Imperial', 'Cervejas']

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Ordem de apresentação: a comida que define a casa primeiro, o pequeno-almoço
// e as bebidas soltas no fim. A cerveja é editorial e entra antes de tudo isto.
const ORDEM = ['Entrada', 'Petiscos', 'Almoço PF', 'Pequeno Almoço', 'Bebidas']

function ordenar(categorias) {
  return [...categorias].sort((a, b) => {
    const ia = ORDEM.indexOf(a.categoria)
    const ib = ORDEM.indexOf(b.categoria)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

async function lerSnapshot(raiz) {
  const bruto = await readFile(new URL('./ementa-snapshot.json', raiz), 'utf8')
  return JSON.parse(bruto).categorias
}

// `env` vem do plugin, não de process.env: o Vite carrega os ficheiros .env para
// import.meta.env do bundle, mas NÃO os injeta em process.env do processo de
// build. Ler process.env directamente funcionaria no Vercel (onde as variáveis
// estão mesmo no ambiente) e falhava sempre em local — a build caía no snapshot
// sem razão aparente. O plugin resolve as duas fontes com loadEnv e passa-as
// aqui já resolvidas.
async function lerSupabase(env = {}) {
  const url = env.VITE_SUPABASE_URL
  const chave = env.VITE_SUPABASE_ANON_KEY
  if (!url?.startsWith('http') || !chave) {
    console.warn('[ementa] Sem credenciais do Supabase no ambiente — a usar o snapshot.')
    return null
  }

  const pedir = async (caminho) => {
    const r = await fetch(`${url}/rest/v1/${caminho}`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`${caminho} devolveu ${r.status}`)
    return r.json()
  }

  const [categorias, produtos, variantes] = await Promise.all([
    pedir('categories?visivel=eq.true&select=id,nome,tipo,ordem&order=ordem'),
    pedir('products?disponivel=eq.true&select=id,category_id,nome,descricao,origem,alergenios,ordem&order=ordem'),
    pedir('product_variants?disponivel=eq.true&select=product_id,nome,ordem&order=ordem'),
  ])

  return categorias
    .filter((c) => !CATEGORIAS_EXCLUIDAS.includes(c.nome))
    .map((c) => ({
      categoria: c.nome,
      tipo: c.tipo,
      itens: produtos
        .filter((p) => p.category_id === c.id)
        .map((p) => ({
          nome: p.nome,
          descricao: p.descricao || undefined,
          origem: p.origem || undefined,
          alergenios: p.alergenios || undefined,
          variantes: variantes.filter((v) => v.product_id === p.id).map((v) => v.nome),
        })),
    }))
    .filter((c) => c.itens.length > 0)
}

export async function obterEmenta(raiz, env) {
  try {
    const vivo = await lerSupabase(env)
    if (vivo?.length) return { categorias: ordenar(vivo), fonte: 'supabase' }
  } catch (e) {
    console.warn(`[ementa] Supabase indisponível (${e.message}) — a usar o snapshot.`)
  }
  return { categorias: ordenar(await lerSnapshot(raiz)), fonte: 'snapshot' }
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function jsonLdMenu(categorias) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE_URL}/ementa#menu`,
    name: `Ementa ${MARCA.nome}`,
    inLanguage: 'pt-PT',
    url: `${SITE_URL}/ementa`,
    provider: { '@id': `${SITE_URL}/#restaurante` },
    hasMenuSection: [
      {
        '@type': 'MenuSection',
        name: 'Cervejas à Pressão',
        description: CERVEJAS_INTRO,
        hasMenuItem: ESTILOS.map((e) => ({
          '@type': 'MenuItem',
          name: e.nome,
          description: e.notas,
        })),
      },
      ...categorias.map((c) => ({
        '@type': 'MenuSection',
        name: c.categoria,
        hasMenuItem: c.itens.map((i) => {
          const item = { '@type': 'MenuItem', name: i.nome }
          if (i.descricao) item.description = i.descricao
          return item
        }),
      })),
    ],
  }
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const ESTILO = `
:root{
  --grafite-950:#0e1013; --grafite-900:#16181d; --grafite-800:#1e2126; --grafite-600:#3a3f48;
  --creme-50:#f6f1e7; --creme-100:#efe8da; --creme-300:#d9cfba; --creme-500:#b8ac92;
  --ambar-400:#e09a3e; --ambar-500:#c9822e; --cobre-600:#8a4c22;
}
*{box-sizing:border-box}
body{margin:0;background:var(--creme-50);color:var(--grafite-800);
  font:16px/1.65 Barlow,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
a{color:var(--cobre-600)}
.env{max-width:820px;margin:0 auto;padding:0 24px}
header.topo{background:var(--grafite-900);color:var(--creme-50);padding:28px 0}
header.topo a{color:var(--creme-100);text-decoration:none}
.marca{font:700 26px/1 Oswald,Impact,sans-serif;letter-spacing:.06em;text-transform:uppercase}
.nav{margin-top:14px;display:flex;flex-wrap:wrap;gap:18px;
  font:600 12px/1 Barlow,sans-serif;letter-spacing:.14em;text-transform:uppercase}
.nav a:hover{color:var(--ambar-400)}
h1{font:700 40px/1.1 Oswald,Impact,sans-serif;text-transform:uppercase;
  letter-spacing:-.01em;margin:44px 0 10px;color:var(--grafite-900)}
h2{font:700 24px/1.2 Oswald,Impact,sans-serif;text-transform:uppercase;
  margin:44px 0 4px;color:var(--grafite-900);
  border-bottom:2px solid var(--creme-300);padding-bottom:8px}
h3{font:600 17px/1.3 Barlow,sans-serif;margin:0 0 2px;color:var(--grafite-900)}
.chapeu{font-size:18px;color:var(--grafite-600);max-width:60ch;margin:0 0 8px}
.info{background:var(--creme-100);border:1px solid var(--creme-300);
  border-radius:12px;padding:18px 22px;margin:26px 0}
.info p{margin:4px 0;font-size:15px}
.servicos{list-style:none;padding:0;margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px 22px;font-size:15px}
ul.itens{list-style:none;padding:0;margin:18px 0 0}
ul.itens li{padding:14px 0;border-bottom:1px solid var(--creme-300)}
ul.itens li:last-child{border-bottom:0}
.desc{margin:2px 0 0;color:var(--grafite-600);font-size:15px}
.meta{margin:6px 0 0;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--creme-500)}
.tag{display:inline-block;background:var(--ambar-500);color:#fff;border-radius:999px;
  padding:2px 9px;font:600 11px/1.6 Barlow,sans-serif;letter-spacing:.1em;
  text-transform:uppercase;margin-left:8px;vertical-align:2px}
.variantes{margin:8px 0 0;font-size:14.5px;color:var(--grafite-600)}
.cta{display:inline-block;background:var(--grafite-900);color:var(--creme-50);
  text-decoration:none;border-radius:999px;padding:13px 26px;margin:10px 12px 0 0;
  font:600 13px/1 Barlow,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.cta.alt{background:var(--ambar-500)}
footer{background:var(--grafite-900);color:var(--creme-500);margin-top:64px;padding:34px 0;font-size:14px}
footer a{color:var(--creme-100)}
.aviso{font-size:13px;color:var(--grafite-600);margin-top:28px;font-style:italic}
@media(max-width:600px){h1{font-size:31px}h2{font-size:21px}}
`

function seccaoCervejas() {
  const linhas = ESTILOS.map(
    (e) => `        <li>
          <h3>${esc(e.nome)}</h3>
          <p class="desc">${esc(e.notas)}</p>
          <p class="meta">Harmoniza com ${esc(e.harmoniza)}</p>
        </li>`,
  ).join('\n')

  return `      <h2>Cervejas à Pressão</h2>
      <p class="chapeu">${esc(CERVEJAS_INTRO)}</p>
      <ul class="itens">
${linhas}
      </ul>
      <p class="aviso">${esc(CERVEJAS_RODAPE)}</p>`
}

function seccaoComida(c) {
  const itens = c.itens
    .map((i) => {
      const tag = i.origem
        ? `<span class="tag">${esc(i.origem === 'Portugues' ? 'Português' : i.origem)}</span>`
        : ''
      const desc = i.descricao ? `\n          <p class="desc">${esc(i.descricao)}</p>` : ''
      const vars = i.variantes?.length
        ? `\n          <p class="variantes"><strong>À escolha:</strong> ${i.variantes.map(esc).join(' · ')}</p>`
        : ''
      const alerg = i.alergenios
        ? `\n          <p class="meta">Alergénios: ${esc(i.alergenios)}</p>`
        : ''
      return `        <li>
          <h3>${esc(i.nome)}${tag}</h3>${desc}${vars}${alerg}
        </li>`
    })
    .join('\n')

  return `      <h2>${esc(c.categoria)}</h2>
      <ul class="itens">
${itens}
      </ul>`
}

export function construirEmentaHtml(categorias, { gaId } = {}) {
  const titulo = `Ementa | 100PRESSÃO Draft House em Carnaxide`
  const descricao =
    'Ementa completa do 100PRESSÃO Draft House, no Mercado Municipal de Carnaxide: ' +
    'cervejas artesanais à pressão, petiscos portugueses e brasileiros, pratos feitos e pequeno-almoço.'

  const servicos = SERVICOS.map(
    (s) => `<li><strong>${esc(s.nome)}</strong> ${esc(s.horas)}</li>`,
  ).join('')

  const ga = gaId
    ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
    <script>
      window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
      gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',
        ad_user_data:'denied',ad_personalization:'denied'});
      gtag('js',new Date());gtag('config','${esc(gaId)}');
    </script>`
    : ''

  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(titulo)}</title>
    <meta name="description" content="${esc(descricao)}" />
    <link rel="canonical" href="${SITE_URL}/ementa" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="#16181d" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="100PRESSÃO" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descricao)}" />
    <meta property="og:url" content="${SITE_URL}/ementa" />
    <meta property="og:image" content="${SITE_URL}/og-image.jpg" />
    <meta property="og:locale" content="pt_PT" />
    <meta name="twitter:card" content="summary_large_image" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>${ESTILO}</style>

    <script type="application/ld+json">
${JSON.stringify(jsonLdMenu(categorias), null, 2)
  .split('\n')
  .map((l) => `      ${l}`)
  .join('\n')}
    </script>${ga}
  </head>
  <body>
    <header class="topo">
      <div class="env">
        <a class="marca" href="/">100PRESSÃO</a>
        <nav class="nav" aria-label="Navegação principal">
          <a href="/">Início</a>
          <a href="/quem-somos">Quem Somos</a>
          <a href="/ementa">Ementa</a>
          <a href="/restaurante">Encomendar</a>
          <a href="/cardapio">Pedir à Mesa</a>
          <a href="/contacto">Contacto</a>
        </nav>
      </div>
    </header>

    <main class="env">
      <h1>Ementa</h1>
      <p class="chapeu">
        Cervejaria artesanal e petiscos luso-brasileiros no Mercado Municipal de
        ${esc(MORADA.localidade)}, ${esc(MORADA.regiao)}. Cerveja europeia servida
        à pressão, petiscos portugueses e brasileiros, prato feito ao almoço e
        pequeno-almoço desde as ${esc(HORARIO.abre.replace(':00', 'h'))}.
      </p>

      <div class="info">
        <p><strong>${esc(MARCA.nomeCompleto)}</strong></p>
        <p>${esc(MORADA.rua)}, ${esc(MORADA.codigoPostal)} ${esc(MORADA.localidade)}</p>
        <p>Telefone <a href="tel:${esc(MARCA.telefone)}">${esc(MARCA.telefoneFormatado)}</a> · ${esc(HORARIO.legivel)}</p>
        <ul class="servicos">${servicos}</ul>
      </div>

${seccaoCervejas()}

${categorias.map(seccaoComida).join('\n\n')}

      <h2>Onde estamos</h2>
      <p class="chapeu">
        Estamos no Mercado Municipal de ${esc(MORADA.localidade)}, em ${esc(MORADA.rua)},
        a poucos minutos de Linda-a-Velha, Algés, Queijas e do centro de ${esc(MORADA.regiao)}.
        Abrimos todos os dias das ${esc(HORARIO.abre)} às ${esc(HORARIO.fecha)}.
      </p>
      <p>
        <a class="cta" href="${esc(MAPA_URL)}" rel="noopener">Ver no mapa</a>
        <a class="cta alt" href="/restaurante">Encomendar online</a>
      </p>

      <p class="aviso">
        Ementa sujeita a alterações e a disponibilidade diária. Os preços em vigor
        são os afixados no estabelecimento. Para alergias ou intolerâncias, fala
        connosco ao balcão antes de pedir.
      </p>
    </main>

    <footer>
      <div class="env">
        <p><strong>${esc(MARCA.nome)}</strong> · ${esc(MORADA.rua)}, ${esc(MORADA.codigoPostal)} ${esc(MORADA.localidade)}</p>
        <p>${esc(HORARIO.legivel)} · <a href="tel:${esc(MARCA.telefone)}">${esc(MARCA.telefoneFormatado)}</a> · <a href="mailto:${esc(MARCA.email)}">${esc(MARCA.email)}</a></p>
        <p><a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a> · <a href="/contacto">Contacto</a></p>
      </div>
    </footer>
  </body>
</html>
`
}
