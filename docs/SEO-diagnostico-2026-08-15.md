# Diagnóstico SEO — 100pressao.pt

**Data:** 15/08/2026
**Autor:** Daniel Cunha (Diretor de TI)
**Para:** Leandro Noury Miranda

---

## Resumo executivo

Não há nenhum bloqueio de indexação. O `robots.txt` está correcto, não existe
`noindex` em lado nenhum, não há `X-Robots-Tag` a bloquear, e o domínio responde
bem (`100pressao.pt` → `www.100pressao.pt`, 301 limpo).

**O problema é outro:** o site é uma SPA em React. O Vercel devolvia o mesmo
`index.html` genérico para todas as rotas. O que o Googlebot recebia na primeira
passagem era isto — em `/`, em `/cardapio`, em `/contacto`, em todo o lado:

```
<title>100PRESSÃO · Draft House</title>
(sem meta description, sem canonical, sem Open Graph)
```

Os títulos e descrições certos existem, mas são injectados por JavaScript
(`react-helmet-async`) e só aparecem quando o Google executa o JS numa segunda
passagem — que é adiada, tem orçamento limitado e não é garantida num site novo
sem autoridade. Na prática: 12 URLs a competir entre si com o mesmo título vazio.

Confirmei no browser que o lado cliente funciona (em `/cardapio` o título e a
description corretos aparecem depois de renderizar) — o problema é só que o
Google raramente chega a essa fase.

---

## O que verifiquei

| Verificação | Estado | Nota |
|---|---|---|
| `robots.txt` acessível e permissivo | OK | Melhorado (ver abaixo) |
| `<meta name="robots" content="noindex">` | Não existe | Nada bloqueado |
| Header `X-Robots-Tag` | Não existe | Nada bloqueado |
| Redirecionamento apex → www | OK | 301 para `www.100pressao.pt` |
| HTTPS / certificado | OK | — |
| `sitemap.xml` acessível | OK | Estava desactualizado |
| Títulos/descrições no HTML de origem | **FALHA** | Corrigido |
| Canonical no HTML de origem | **FALHA** | Corrigido |
| Dados estruturados | Parcial | Corrigido e enriquecido |
| Presença no Google para "100 Pressão Carnaxide" | **Não aparece** | Ver plano |

---

## Alterações feitas

### 1. Pré-renderização do `<head>` por rota — `scripts/vite-plugin-seo.js` (novo)

Plugin de build que, no fim do `vite build`, escreve um HTML estático por rota
pública (`dist/cardapio.html`, `dist/contacto.html`, …) a partir do `index.html`,
já com `<title>`, `meta description`, `canonical`, `robots` e Open Graph
escritos no HTML de origem.

As tags injectadas levam `data-rh="true"` — é o marcador que o
`react-helmet-async` usa. Ao hidratar, o Helmet remove-as e insere as suas, por
isso não ficam duplicadas. Verificado: exactamente **1** `meta description` por
página.

Rotas não pré-renderizadas (`/admin`, `/staff`, `/caixa`, …) continuam a cair no
rewrite para `index.html` — nada muda no comportamento da aplicação.

### 2. `vercel.json`

- `cleanUrls: true` — faz `/cardapio` servir `cardapio.html`. **Sem isto o plugin
  não tem efeito**, porque o rewrite apanhava tudo primeiro.
- `trailingSlash: false` — evita `/contacto` e `/contacto/` como URLs distintos.
- `X-Robots-Tag: noindex` nas rotas internas (`/admin`, `/staff`, `/operacional`,
  `/ecran`, `/caixa`, `/visor`) — o `robots.txt` pede para não rastrear, este
  header garante que não indexa mesmo que alguém lhe aponte um link.
- Cache curto no `sitemap.xml` e `robots.txt`.

### 3. `sitemap.xml` — agora gerado no build

Antes era um ficheiro à mão, desactualizado: faltavam `/restaurante` e `/app`
(duas páginas de conversão), e usava `changefreq`/`priority`, que o Google
**ignora desde 2023**. Agora é gerado a partir de `ROTAS_INDEXAVEIS`
(`src/seo/pages.js`), com `lastmod` real. Acrescentar uma página passa a ser uma
linha nessa lista.

Passou de 10 para 12 URLs. XML validado.

### 4. `robots.txt`

Acrescentado `/caixa`, `/visor` e `/equipa` (só `/equipa/` com barra estava
bloqueado — `/equipa` sem barra passava). Comentado para se perceber o porquê.

### 5. Dados estruturados (`index.html`)

- `BarOrPub` → **`Restaurant`**. A casa serve pequeno-almoço, almoço PF e
  petiscos — não é só bebida. `Restaurant` é o tipo que alimenta os *rich
  results* de restauração no Google (horário, ementa, gama de preços).
- Acrescentado: `image`, `logo`, `hasMap`, `hasMenu`, `areaServed` (Carnaxide,
  Oeiras, Linda-a-Velha, Algés, Queijas), `paymentAccepted`, `alternateName`
  (inclui "100 Pressao" sem acento — é como muita gente escreve na pesquisa) e
  uma `OrderAction` a apontar para `/restaurante`.
- Segundo bloco `WebSite` ligado à entidade do restaurante.
- Ambos validados como JSON válido.

### 6. Canonical da raiz

Estava a gerar `https://www.100pressao.pt` (sem barra) e o sitemap dizia
`https://www.100pressao.pt/`. Dois URLs para a mesma página. Uniformizado com
barra nos dois sítios (`SEOHead.jsx` e o plugin).

---

## Por confirmares (não inventei valores)

1. **Coordenadas GPS da loja.** Deixei o campo `geo` de fora do JSON-LD de
   propósito — coordenadas erradas prejudicam mais do que a ausência delas.
   Copia a latitude/longitude do Google Business Profile e digo-te onde colar.
2. **Horário real.** O JSON-LD diz 2ª a 6ª, 08:00–12:00 — é o *fallback* antigo
   do código. É este horário que o Google mostra nos resultados. Se estiver
   errado, é urgente.
3. **URLs finais das redes sociais** para o campo `sameAs`.
4. **Homónimo no Funchal.** Ao pesquisar "100 Pressão", os resultados devolvem um
   Instagram e um Facebook associados ao Funchal/Madeira. Se são vossos, a
   localização nos perfis está errada e está a confundir o Google. Se não são,
   temos concorrência de marca no nome e a estratégia local tem de ser mais
   agressiva. Precisa de verificação tua.

---

## Melhorias de conteúdo e estrutura

### Prioridade 1 — a ementa está fechada aos motores de busca

O `/cardapio` exige nome e mesa **antes** de mostrar qualquer coisa. O Google vê
um formulário e nada mais. Isto significa que nenhuma pesquisa por
"petiscos Carnaxide", "francesinha Carnaxide", "cerveja artesanal Oeiras" pode
alguma vez encontrar-vos — as palavras não existem em lado nenhum do site.

**Recomendação:** separar em dois. Uma página pública `/ementa`, indexável, com
os pratos, descrições e preços em texto (não em imagem), e o `/cardapio` mantém-se
como está para pedir à mesa. Acrescenta-se JSON-LD `Menu` a partir dos dados que
já estão no Supabase. É a alteração com maior retorno de todas as desta lista.

### Prioridade 2 — conteúdo demasiado curto

Medi o texto renderizado: 1.000 a 2.400 caracteres por página, incluindo menu de
navegação e rodapé. É pouco para competir. As páginas com maior potencial local
(`/`, `/home`, `/contacto`) precisam de 400–600 palavras de texto real que
mencione naturalmente Carnaxide, Mercado Municipal, Oeiras.

### Prioridade 3 — `/` e `/home` a competir

A raiz é um Hero quase sem texto e o conteúdo verdadeiro está em `/home`. São
duas páginas a disputar a mesma pesquisa de marca e nenhuma tem força suficiente.
Sugiro fundir: a raiz passa a ter o conteúdo de `/home` e `/home` redirecciona
(301) para `/`.

### Prioridade 4 — Google Business Profile

Sejamos claros: para "100 Pressão Carnaxide" e "cervejaria perto de mim", quem
decide é o Google Business Profile, não o site. O *map pack* aparece acima dos
resultados orgânicos. Sem GBP verificado com morada, horário, fotos e categoria
("Cervejaria" como principal, "Restaurante" e "Bar" como secundárias), o site
sozinho não resolve.

Aqui a Marta Aguiar é quem deve liderar — é SEO local e reputação, não
infraestrutura. Eu garanto que os dados do site (morada, telefone, horário)
batem certo ao carácter com os do GBP, porque a inconsistência de NAP
(*Name, Address, Phone*) é das coisas que mais penaliza posicionamento local.

### Prioridade 5 — depois do deploy

1. Google Search Console: adicionar a propriedade, submeter o sitemap e usar
   "Inspecionar URL" → "Pedir indexação" para as 5 páginas principais.
2. Directórios locais com NAP idêntico: Zomato, TripAdvisor, Facebook, Apple
   Maps, páginas do Município de Oeiras.
3. Blogue de bairro, se justificar: 1 artigo por mês sobre cerveja e petiscos com
   ângulo local. Só vale a pena depois das prioridades 1 a 4.

---

## Sequência recomendada

| # | Acção | Quem | Quando |
|---|---|---|---|
| 1 | `npm run build` e deploy destas alterações | Daniel | Imediato |
| 2 | Confirmar horário real e GPS no JSON-LD | Leandro | Imediato |
| 3 | Search Console + submeter sitemap | Daniel | Após deploy |
| 4 | Google Business Profile verificado | Marta | Esta semana |
| 5 | Página `/ementa` pública e indexável | Daniel | 1–2 semanas |
| 6 | Reforço de texto nas páginas principais | Marta | 2–3 semanas |
| 7 | Fundir `/` e `/home` | Daniel | 3–4 semanas |

**Expectativa realista:** as alterações técnicas fazem o Google conseguir *ler* o
site como deve ser — mas indexação de um site novo demora 2 a 6 semanas a
estabilizar. Posicionar em "cervejaria Carnaxide" depende sobretudo do ponto 4
(GBP) e do ponto 5 (ementa pública), não da parte técnica.

---

## Nota de verificação

O `npm run build` não correu no meu ambiente Linux: o `node_modules` deste
projecto tem binários compilados para macOS (`rolldown`, `oxlint`). Testei o
plugin isoladamente contra o `dist/` actual e validei o resultado:

- 12 páginas HTML geradas, uma por rota
- `sitemap.xml` validado como XML correcto
- 2 blocos JSON-LD validados como JSON correcto
- exactamente 1 `meta description` por página (sem duplicação com o Helmet)

**Falta correr `npm run build` na tua máquina antes do deploy** para confirmar
que o plugin encaixa no pipeline real do Vite. Não fiz deploy — fica à tua ordem.

Não toquei em `api/_lib/faturacao.js` nem em `src/pages/equipa/admin/Faturas.jsx`;
apareciam já modificados no `git status` antes deste trabalho.
