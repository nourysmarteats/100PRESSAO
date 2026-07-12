import { Helmet } from 'react-helmet-async'

// Domínio canónico confirmado pelo Leandro (2026-07-12): www.100pressao.pt
// (resolve hoje para 100pressao.vercel.app via redirect).
const SITE_URL = 'https://www.100pressao.pt'
// TODO: substituir por uma imagem OG real (1200x630) assim que existir —
// usar o ícone por agora só para não deixar o preview de link partido.
const DEFAULT_OG_IMAGE = '/icon-512.png'

function SEOHead({ title, description, path, image }) {
  const canonical = `${SITE_URL}${path === '/' ? '' : path}`
  const ogImage = image ?? DEFAULT_OG_IMAGE

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

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
