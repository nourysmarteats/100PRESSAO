import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import seoPrerender from './scripts/vite-plugin-seo.js'

// https://vite.dev/config/
export default defineConfig({
  // seoPrerender corre só no build: escreve um HTML por rota pública com o
  // <head> já preenchido e regenera o sitemap.xml (ver scripts/vite-plugin-seo.js).
  plugins: [react(), tailwindcss(), seoPrerender()],
})
