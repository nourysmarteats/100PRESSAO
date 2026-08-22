import { Helmet } from 'react-helmet-async'

// Domínio canónico confirmado pelo Leandro (2026-07-12): www.100pressao.pt
// (resolve hoje para 100pressao.vercel.app via redirect).
const SITE_URL = 'https://www.100pressao.pt'
// Imagem OG de marca (1200×630) — mostrada no preview ao partilhar links
// (WhatsApp, Facebook, etc.). Gerada em public/og-image.jpg.
const DEFAULT_OG_IMAGE = '/og-image.jpg'

function SEOHead({ title, description, path, image, noindex = false, manifest = '/site.webmanifest' }) {
  // A raiz canoniza como ".../" (com barra) — tem de bater certo com o
  // canonical pré-renderizado em scripts/vite-plugin-seo.js e com o sitemap,
  // senão o Google vê dois URLs diferentes para a mesma página.
  const canonical = `${SITE_URL}${path}`
  const ogImage = image ?? DEFAULT_OG_IMAGE

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {/* Manifest por rota — por defeito o do site inteiro; o /cardapio
          passa o seu próprio (ver Cardapio.jsx) para poder ser instalado
          como app isolada, com start_url/scope só nessa página. Helmet
          dedupe por "rel", por isso só existe um <link rel="manifest">
          de cada vez — nunca remover o link estático do index.html
          duplicaria isto. */}
      <link rel="manifest" href={manifest} />

      {/* Tem de espelhar o que scripts/vite-plugin-seo.js escreve no HTML
          estático: ao hidratar, o Helmet remove todas as tags data-rh="true"
          e substitui-as pelas suas. Uma tag que exista só no pré-render
          desaparece do DOM renderizado (que é o que o Google indexa). */}
      <meta
        name="robots"
        content={
          noindex
            ? 'noindex, nofollow'
            : 'index, follow, max-image-preview:large, max-snippet:-1'
        }
      />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="100PRESSÃO" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${SITE_URL}${ogImage}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="100PRESSÃO — Cervejaria e petiscos em Carnaxide" />
      <meta property="og:locale" content="pt_PT" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${ogImage}`} />
    </Helmet>
  )
}

export default SEOHead
