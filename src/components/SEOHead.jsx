import { Helmet } from 'react-helmet-async'

// Domínio canónico confirmado pelo Leandro (2026-07-12): www.100pressao.pt
// (resolve hoje para 100pressao.vercel.app via redirect).
const SITE_URL = 'https://www.100pressao.pt'
// Imagem OG de marca (1200×630) — mostrada no preview ao partilhar links
// (WhatsApp, Facebook, etc.). Gerada em public/og-image.jpg.
const DEFAULT_OG_IMAGE = '/og-image.jpg'

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
