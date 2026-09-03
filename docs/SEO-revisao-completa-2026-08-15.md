# Revisão completa de SEO — 100pressao.pt

**Data:** 15/08/2026
**Autor:** Daniel Cunha (Diretor de TI)
**Para:** Leandro Noury Miranda

---

## 1. Bloqueios de indexação — nenhum

Confirmado outra vez, agora com o site em produção:

| Verificação | Estado |
|---|---|
| `robots.txt` acessível e permissivo | OK |
| `<meta name="robots" content="noindex">` | Não existe em lado nenhum |
| Header `X-Robots-Tag` a bloquear | Não existe |
| Apex → www | 301 limpo |
| `sitemap.xml` acessível e XML válido | OK |
| Proteção de deployment no Vercel | Não aplicável (site responde publicamente) |

Nunca houve bloqueio. O que havia era um site que o Google não conseguia **ler**.

---

## 2. O que estava errado, por ordem de gravidade

### 2.1 O horário anunciado ao Google estava errado

O JSON-LD dizia **2ª a 6ª, 08:00–12:00**. A base de dados diz **8:00–22:00, sete
dias por semana**.

Isto é o mais grave da lista e não tem nada de técnico: durante meses o Google
teve autorização para dizer a quem pesquisasse que a casa fechava ao meio-dia e
não abria ao fim de semana. Corrigido.

### 2.2 A ementa estava fechada aos motores de busca

O `/cardapio` pedia nome e mesa antes de mostrar seja o que for. Medi o que o
Googlebot via: um formulário, cerca de 1.000 caracteres, zero pratos. Nenhuma
pesquisa por "petiscos Carnaxide" ou "pastéis de bacalhau Oeiras" podia
encontrar-vos — essas palavras não existiam no site.

### 2.3 Todas as páginas tinham o mesmo título vazio

Sendo uma SPA, o Vercel devolvia o mesmo `index.html` para as 12 rotas:
`100PRESSÃO · Draft House`, sem description e sem canonical. Os títulos certos só
apareciam depois de o Google executar JavaScript, o que num site novo raramente
acontece. (Corrigido na sessão anterior; validado outra vez agora.)

### 2.4 Coordenadas e redes sociais por ligar

As coordenadas GPS **já existiam na base de dados** — na chave `entrega` das
`definicoes`, usadas para calcular o raio de entrega. Ou seja: as coordenadas
operacionais reais estavam lá, mas não estavam a ser ditas ao Google.

Os URLs das redes também já estavam no `Footer.jsx`, mas não no `sameAs` do
JSON-LD, que é o que liga os perfis à entidade aos olhos do Google.

---

## 3. O que fiz

### Página `/ementa` — pública, estática, indexável

Nova página gerada no build (`scripts/gerar-ementa.js`), servida como HTML puro,
**sem React e sem JavaScript**. O `cleanUrls` do Vercel faz `/ementa` servir
`ementa.html` antes de o rewrite da SPA agir.

- **6.718 caracteres** de texto legível pelo Google, contra ~1.000 antes
- **34 itens** em 5 secções de comida + 8 estilos de cerveja
- Dados lidos do Supabase no momento do build; se o Supabase não responder, usa
  o snapshot em `scripts/ementa-snapshot.json` — o build nunca parte por isto
- JSON-LD `Menu` completo, ligado à entidade `Restaurant`
- Carrega instantaneamente: sem bundle, sem chamadas a API, sem estado

O `/cardapio` continua a ser o sistema de pedidos à mesa, intacto, acessível pelo
QR. Passou a `noindex` — é um formulário, não tem conteúdo para indexar, e
competia com a `/ementa` pela mesma pesquisa. Ganhou um link "Só queres ver o que
há? Vê a ementa completa" para quem chega pelo QR e só quer espreitar.

### Cervejas a liderar a página

Este ponto merece explicação, porque decidi contra os dados.

A tabela `products` tem **uma** cerveja artesanal registada ("Copo Cheio", IPA
6.2%) contra 18 itens de pequeno-almoço e 11 petiscos. Gerar a ementa
directamente da base de dados publicaria uma página que diz ao Google, em texto:
*isto é um snack-bar que também tem uma cerveja*. O contrário do posicionamento.

Escrevi por isso uma secção editorial "Cervejas à Pressão" no topo, por estilos
(IPA, Pilsner, Witbier, Amber Ale, Red Ale, Tripel, Blonde, Lager), sem preços
fixos. Os estilos não são inventados — são os que a própria cozinha já usa nas
notas de harmonização dos petiscos. Está em `src/seo/cervejas.js`, isolado e
comentado, para desaparecer assim que carregares o barril real no `/admin`.

**Valida este texto.** É a primeira coisa que o Google e o cliente vão ler sobre
a casa.

### Sem preços — de propósito

Conforme decidiste. Os valores em base de dados parecem ser de custo e não de
venda: Tosta Simples 0,56 €, Torrada de Broa 1,04 €, Ovos Mexidos 1,12 €,
Batatas com Cheddar e Bacon 2,54 €, e uma IPA a 1,84 €. Havia ainda uma categoria
"Ingredientes" visível com "Fiambre 0,30 €".

Preços errados afixados online são risco de contra-ordenação. E para SEO não
fazem falta nenhuma: o que o Google lê são os nomes e as descrições. A página tem
o aviso legal de que os preços em vigor são os afixados no estabelecimento.

A categoria "Ingredientes" fica excluída da página por regra, não por acaso —
ver `CATEGORIAS_EXCLUIDAS` em `gerar-ementa.js`.

### Horário, GPS e redes

- Horário corrigido para **8:00–22:00, 7 dias**, em bloco corrido. Não declarei
  janelas separadas por serviço: se dissesse "pequeno-almoço 8–11" e "almoço
  12–15" como blocos distintos, o Google mostraria **"Fechado"** às 16h — quando
  a casa está aberta a servir cerveja. As janelas aparecem em texto na ementa,
  onde informam sem fechar portas.
- **Coordenadas** `38.7262329, -9.2369446` acrescentadas ao JSON-LD.
- **`sameAs`** com Instagram, Facebook e TikTok oficiais.

### Novo ficheiro `src/lib/marca.js`

Morada, contactos, coordenadas, horário e redes passaram a viver num só sítio.
Estavam espalhados por quatro ficheiros e já tinham divergido — foi assim que o
horário errado sobreviveu tanto tempo. Em SEO local, a consistência do NAP
(*Name, Address, Phone*) entre site, Google Business Profile e directórios é um
dos fatores que mais pesa.

### Títulos e descrições com localização

| Página | Antes | Agora |
|---|---|---|
| `/` | 100PRESSÃO \| Cervejaria Artesanal em Carnaxide | 100PRESSÃO Draft House \| Cervejaria em Carnaxide |
| `/home` | A Casa: Petiscos, Cervejas e Muito Mais | A Casa: Petiscos e Cervejas em Carnaxide |
| `/ementa` | *(não existia)* | Ementa \| 100PRESSÃO Draft House em Carnaxide |
| `/restaurante` | *(sem título próprio)* | Encomendar Online em Carnaxide \| 100PRESSÃO |
| `/contacto` | Contacto e Localização | Contacto e Morada em Carnaxide |
| `/quem-somos` | Quem Somos \| 100PRESSÃO Draft House | Quem Somos \| 100PRESSÃO Draft House Carnaxide |
| `/cardapio` | Ementa: Petiscos e Cervejas | Pedir à Mesa \| 100PRESSÃO Carnaxide (noindex) |

Todos abaixo de ~60 caracteres para não serem cortados nos resultados.

---

## 4. Google Business Profile — precisa de ti

**Não consigo fazer isto.** Não há conector de Google Business Profile
disponível (procurei no registo de conectores) e não tenho acesso à tua conta.
Editar o GBP é trabalho manual teu ou da Marta.

E é a parte que mais importa: para "cervejaria Carnaxide" ou "cerveja artesanal
perto de mim", quem decide é o **map pack**, que aparece acima dos resultados
orgânicos e é alimentado pelo GBP, não pelo site.

### Valores exactos para colares

```
Nome                  100PRESSÃO Draft House
Categoria principal   Cervejaria
Categorias extra      Restaurante · Bar · Petiscaria
Morada                Praceta Eugénio de Castro, Loja 6
                      2790-063 Carnaxide, Oeiras
Coordenadas           38.7262329, -9.2369446
Telefone              +351 935 995 011
Website               https://www.100pressao.pt
Link da ementa        https://www.100pressao.pt/ementa
Link de encomenda     https://www.100pressao.pt/restaurante
Horário               Segunda a Domingo, 08:00 – 22:00
```

A morada, o telefone e o horário têm de ficar **iguais ao carácter** aos do site.
São agora os valores de `src/lib/marca.js`.

### Depois de preencher

1. Categoria principal **Cervejaria**, não "Restaurante". É o que decide em que
   pesquisas apareces no mapa.
2. Fotos: mínimo 10 — fachada, interior, torneiras, pratos. O GBP dá peso a
   perfis com fotos recentes.
3. Publica o link `/ementa` no campo "Menu".
4. Pede as primeiras avaliações a clientes habituais. Volume e recência de
   avaliações são dos sinais mais fortes do map pack.
5. Nas coordenadas, arrasta o pino para a porta da loja, não para o centro do
   mercado.

### Homónimo no Funchal — atenção

Existe um "100 PRESSÃO" no Funchal, com Instagram `@100pressao.pt` (repara: usa
o vosso domínio como handle) e página de Facebook própria. **Não tem relação
convosco.** É concorrência directa no nome da marca.

Deixei isto documentado em `marca.js` com um aviso: nunca acrescentar esses URLs
ao `sameAs`, porque diria ao Google que sois a mesma entidade e misturaria os
sinais de localização de Carnaxide com os da Madeira. É também a razão para
"Draft House" entrar nos títulos — é o que vos distingue nas pesquisas.

---

## 5. Verificação feita

Corri o gerador contra o `dist` actual, três vezes seguidas:

- 13 ficheiros HTML gerados, um por rota
- exactamente **1** `title`, `description`, `canonical` e `robots` por página,
  estável após múltiplas passagens (encontrei e corrigi um bug de idempotência:
  um `\s*` guloso no regex de limpeza deixava metade das tags por remover)
- `/cardapio` com `noindex, follow` e fora do sitemap
- `/ementa` não é sobreposta pelo pré-renderizador da SPA
- `sitemap.xml` validado como XML correcto, 12 URLs, com `lastmod`
- JSON-LD validado como JSON correcto: `Restaurant`, `WebSite`, `Menu`
- horário no JSON-LD: 08:00–22:00, 7 dias
- RLS confirmada: `categories`, `products` e `product_variants` têm política
  `leitura publica` para o papel `public`, por isso o build no Vercel consegue
  ler dados frescos

### O que não consegui verificar

`npm run build` **não corre no meu ambiente** — o `node_modules` do projecto tem
binários compilados para macOS (`rolldown`, `oxlint`) e eu corro em Linux. Testei
o plugin isoladamente contra o `dist` existente.

A leitura ao vivo do Supabase durante o build também não pôde ser testada daqui
(o sandbox não tem rede para o Supabase); caiu no snapshot, como previsto. As
políticas RLS confirmam que vai funcionar no Vercel, mas confirma na primeira
build que o log diz `/ementa gerada de supabase` e não `de snapshot`.

**Corre `npm run build` na tua máquina antes do deploy.** Não fiz deploy.

---

## 6. Por fazer, por ordem

| # | Acção | Quem |
|---|---|---|
| 1 | `npm run build` local e verificar o log da ementa | Leandro |
| 2 | Validar o texto editorial das cervejas (`src/seo/cervejas.js`) | Leandro |
| 3 | Deploy | Leandro |
| 4 | Google Search Console: submeter sitemap, pedir indexação de `/` e `/ementa` | Daniel |
| 5 | Google Business Profile com os valores da secção 4 | Leandro / Marta |
| 6 | Corrigir os preços no `/admin` (parecem ser de custo) | Leandro |
| 7 | Carregar a lista real de cervejas no `/admin` | Leandro |
| 8 | Reactivar preços na ementa depois de 6 e 7 | Daniel |
| 9 | Fundir `/` e `/home`, que competem pela mesma pesquisa | Daniel |

**Expectativa realista:** a parte técnica está feita — o Google passa a conseguir
ler o site e a ementa. Mas indexação de um site novo estabiliza em 2 a 6 semanas,
e posicionar em "cervejaria Carnaxide" depende sobretudo do ponto 5. O site
sozinho não ganha o map pack.

---

## Nota

Não toquei em `api/_lib/faturacao.js` nem em `src/pages/equipa/admin/Faturas.jsx`
— apareciam já modificados no `git status` antes deste trabalho.
