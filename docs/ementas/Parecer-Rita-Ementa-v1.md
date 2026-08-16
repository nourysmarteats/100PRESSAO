# Parecer da Chef sobre a Ementa Finalizada

**100PRESSÃO** · Mercado Municipal de Carnaxide
Rita Falcão, Chef Executiva · 16/08/2026
Ficheiro analisado: `Ementa 100Pressão - Corrigida e Delivery.xlsx`

---

## Veredicto em três linhas

A ementa está **bem construída em identidade e em estrutura** — o cruzamento luso-brasileiro está coerente, as harmonizações fazem sentido, e o trabalho de alergénios e de adaptação ao delivery está acima do que se vê em 90% das aberturas.

**Não está pronta para publicar.** Há três bloqueios que, se passarem para a abertura, custam dinheiro ou custam uma coima.

E há uma decisão de fundo por tomar: **esta ementa é grande demais para a cozinha que vamos ter.**

---

## 🔴 Bloqueios — resolver antes de qualquer impressão ou publicação

### 1. O markup de delivery de +15% faz-nos perder dinheiro em cada encomenda

Esta é a mais grave. As plataformas (Uber Eats, Glovo, Bolt Food) cobram tipicamente **25% a 35% de comissão** sobre o preço de venda. Com +15% de markup, o que nos entra é:

| Item | Balcão | Delivery (+15%) | Líquido @30% comissão | Δ vs balcão |
|---|---|---|---|---|
| Rissóis de Gambas | 6,90 € | 7,90 € | **5,53 €** | −20% |
| Pastéis de Bacalhau | 8,90 € | 10,20 € | **7,14 €** | −20% |
| Bife Acebolado (PF) | 12,90 € | 14,80 € | **10,36 €** | −20% |
| Tábua da Casa | 17,90 € | 20,60 € | **14,42 €** | −19% |
| Bitoque da Casa | 13,50 € | 15,50 € | **10,85 €** | −20% |

Estamos a vender **20% abaixo do preço de balcão** — e ainda por cima com custo acrescido de embalagem, que não está calculado em lado nenhum.

Exemplo prático nos Rissóis: se o food cost ao balcão for 30% (2,07 € de custo), no delivery passa a 2,07 € + ~0,40 € de embalagem = 2,47 € sobre 5,53 € líquidos → **food cost real de 45%**. Isso não é margem apertada, é prejuízo depois de contar mão-de-obra.

**Markup necessário só para ficarmos neutros:**

| Comissão da plataforma | Markup mínimo |
|---|---|
| 25% | **+33%** |
| 30% | **+43%** |
| 35% | **+54%** |

**O que precisamos:** a comissão real negociada com cada plataforma (isto é com o Alex, não comigo). Só com esse número fecho os preços. Enquanto não houver, o +15% não passa.

Se o receio for o choque de preço para o cliente, a alternativa é **reduzir a carta de delivery** ao que aguenta o markup — petiscos fritos de valor médio-alto e PF — e deixar de fora tudo o que não sobrevive a +40%.

### 2. Alergénios em falta — é obrigação legal, não boa prática

O Regulamento (UE) 1169/2011 obriga à declaração dos 14 alergénios em **todos** os itens alimentares. Neste momento:

- **Calabresa Acebolada** — marcada "A CONFIRMAR †" em ambas as ementas. Não vai para a carta assim. É pedir a ficha técnica ao fornecedor da linguiça (leva quase sempre sulfitos, muitas vezes leite ou soja).
- **Todo o pequeno-almoço está sem alergénios declarados.** Tosta Mista, Croissant, Pão de Queijo, Bolo da Dona Célia, Torrada de Broa — nenhum tem coluna preenchida. Tem tudo glúten, leite e/ou ovo. É a secção mais exposta da ementa e é a que está em branco.
- **Bolo da Dona Célia** — se é produção externa, precisamos de ficha de alergénios do produtor e de rastreabilidade HACCP. Se é produção nossa, precisa de ficha técnica.
- **Combos de pequeno-almoço** — herdam os alergénios dos componentes e também estão vazios.

Isto é o único ponto da ementa que dá coima da ASAE. Fecha-se numa tarde, mas tem de ser fechado.

### 3. As fichas técnicas em sistema não batem com a ementa

O `2026-07-28-seed-fichas-tecnicas.sql` tem quantidades que contradizem a carta:

| Prato | Ementa | Ficha técnica em sistema |
|---|---|---|
| Pastéis de Bacalhau | 6 un | **2 un** |
| Rissóis de Gambas | 6 un | **3 un** |
| Pastéis de Vento | 9 un | **4 un** |
| Bolinhas de Feijoada | 8 un | **6 un** |
| Bolinhas de Mandioca | 8 un | **6 un** |
| Coxinha de Frango | 5 un | **1 un** |

Consequência: o stock desconta errado desde o primeiro dia, o inventário nunca fecha, e qualquer food cost que o sistema calcule é ficção. A Coxinha desconta 1 unidade quando saem 5 — em duas semanas o stock está completamente descolado da realidade.

Isto é coordenação comigo e com o Daniel. **Antes de abrir.**

---

## 🟠 Riscos operacionais — decidir antes da abertura

### A fritadeira é o estrangulamento de todo o serviço

Dos 11 petiscos, **7 são de fritura**: pastéis de bacalhau, rissóis, bolinhas de feijoada, bolinhas de mandioca, pastéis de vento, coxinhas, batatas fritas. Somam-se as batatas do Bitoque, que está disponível a toda a hora.

Num espaço de mercado municipal, com equipa pequena, isto significa: em pico de sexta à noite, **tudo o que o cliente pede passa pelo mesmo equipamento**. O tempo de espera não cresce, dispara.

Já tirámos o Frango à Passarinho do PF exactamente por isto. Mas o problema de fundo mantém-se na carta de petiscos.

**Precisamos de saber:** quantas cubas de fritadeira vamos ter, e de que capacidade. Com uma cuba, esta carta não se serve. Com duas, serve-se com disciplina de mise-en-place. Com três, respira.

**Recomendação:** independentemente do equipamento, acrescentar **2 petiscos não-fritos** para desviar procura da fritadeira — algo grelhado ou frio que saia rápido. A Tábua e as Moelas são as únicas escapatórias actuais, e a Tábua é cara.

### O Bitoque canibaliza toda a rotação de Prato Feito

| | Preço | Inclui |
|---|---|---|
| PF (Bife Acebolado) | 12,90 € | prato + base fixa |
| **Bitoque da Casa** | **13,50 €** | prato + batatas + arroz + **bebida + café** |

Por **0,60 € a mais**, o cliente leva bebida (~2,50 €) e café (1,20 €) — cerca de **3,70 € de valor**. Nenhum cliente racional escolhe o PF.

Resultado previsível: a rotação semanal que montei não vende, o Bitoque vende tudo, e ficamos com desperdício nos PF e um prato-âncora de margem provavelmente fraca.

**Duas saídas:** ou o Bitoque sobe para ~15,90 €, ou os PF passam também a incluir bebida (e sobem em conformidade). A segunda é melhor para o ticket médio e para a percepção de valor do almoço de escritório, que é o nosso público das 12h às 15h.

### Os PF continuam sem custeio — e a "base fixa" continua sem definição

Já sinalizei isto no documento de rotação e mantém-se. Sete pratos de almoço com preço fixado e **zero fichas técnicas**. A "base fixa" aparece em todos os PF e não existe em lado nenhum a decisão do que é.

A €12,90, a minha suspeita é que o **Bife Acebolado** e a **Carne de Sol** estão apertados. Mas é suspeita — não afirmo margens sem números.

### Três serviços distintos, uma equipa pequena

Pequeno-almoço (11 itens + 3 combos) → almoço PF (7 pratos + Bitoque) → petiscos e bar até à noite. São **três mise-en-places diferentes** no mesmo dia, no mesmo espaço.

Não digo que não se faz. Digo que precisa de escala desenhada com transições, e que não podemos abrir com tudo ao mesmo tempo. **A minha recomendação: abrir com petiscos + bar + Bitoque, e introduzir o pequeno-almoço e a rotação de PF na semana 3 ou 4**, quando a equipa já tiver ritmo. Abrir com a carta completa é o erro clássico.

---

## 🟡 Ajustes de preço e coerência

**Rissóis de Gambas (6 un) a 6,90 € vs Pastéis de Bacalhau (6 un) a 8,90 €.** Gambas com recheio cremoso custam mais que bacalhau desfiado com puré. Os Rissóis estão subvalorizados em relação ao vizinho de lista — proponho **7,90 €**, a confirmar com o custeio.

**Bolinhas de Feijoada (8 un) a 5,90 €** — item mais barato da carta, com 8 unidades panadas e fritas. Suspeito de food cost alto face ao preço. A validar.

**Coxinha (5 un) 7,50 € vs Bolinhas de Mandioca (8 un) 6,90 €.** O cliente lê isto como incoerência: menos unidades, mais caro. Ou se justifica na descrição (a coxinha é maior e mais trabalhosa), ou se alinham as doses. O asterisco de "preço sugerido — validar food-cost" continua por resolver.

**Pastéis de Vento sortidos (9 un, 3 recheios) a 7,90 €** — bom valor para o cliente, mas são **três preparações separadas** (queijo, carne desfiada, camarão) para um item de 7,90 €. É o petisco com pior rácio trabalho/receita da carta. Ou sobe de preço, ou reduz para 2 recheios.

**Ucal (Citrino)** — continua "a confirmar". Preço, já.

**Peixe do Dia no delivery** — bem apanhado que as plataformas exigem preço fixo. A minha posição de cozinha: **retirar do delivery**. Peixe fresco grelhado é o prato que pior viaja da carta inteira, e um preço fixo médio expõe-nos ao risco de corte caro.

**Combos** — os descontos estão entre 13% e 16%, o que é saudável. Mas atenção a dois pontos:

- Estamos a descontar sobre o **jarro de cerveja da casa**, que é o item de melhor margem. Vale a pena testar se o combo funciona igual com desconto só na comida.
- **"Moelas e Mandioca" para 3-4 pessoas** com dois petiscos é magro. Ou passa a 2-3 pessoas, ou acrescenta um terceiro item.

---

## O que faço a seguir, se me disseres para avançar

1. **Custear os 7 PF + Bitoque + os 11 petiscos** — preciso da lista de fornecedores e preços de compra. Sem isso, nada disto sai de suspeita.
2. **Definir e registar a "base fixa"** dos PF em ficha técnica.
3. **Fechar a tabela de alergénios** do pequeno-almoço e da Calabresa.
4. **Corrigir as fichas técnicas em sistema** para baterem com as doses da carta (com o Daniel).
5. **Refazer os preços de delivery** assim que o Alex confirmar as comissões reais.

---

*Nenhum prato desta carta está aprovado por mim para publicação enquanto os pontos 🔴 não estiverem fechados. A regra da casa é não pôr prato na ementa sem food cost conhecido, e neste momento a maioria dos pratos de almoço não o tem.*
