import { Helmet } from 'react-helmet-async'

// Domínio canónico confirmado pelo Leandro (2026-07-12): www.100pressao.pt
// (resolve hoje para 100pressao.vercel.app via redirect).
const SITE_URL = 'https://www.100pressao.pt'
// Imagem de partilha 1200x630 (2026-07-20). Gerada com as fontes substitutas
// do sandbox (condensada + Lato) por não haver Oswald/Barlow disponíveis
// offline — vale a pena o Sérgio refazê-la nas fontes reais da marca quando
// puder. Script em docs/og/gerar-og.py.
const DEFAULT_OG_IMAGE = '/og-100pressao.png'

function SEOHead({ title, description, path, image, manifest = '/site.webmanifest' }) {
  const canonical = `${SITE_URL}${path === '/' ? '' : path}`
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

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${SITE_URL}${ogImage}`} />
      <meta property="og:locale" content="pt_PT" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${ogImage}`} />
    </Helmet>
  )
}

export default SEOHead
