# Prato Feito (PF) — Rotação Semanal

**100PRESSÃO** · Mercado Municipal de Carnaxide
Chef Executiva: Rita Falcão · Versão 1 — 12/08/2026

---

## Regras de serviço

| | |
|---|---|
| **Horário PF** | Segunda a sexta, **12:00 – 15:00** |
| **Estrutura** | **3 opções por dia**: 1 Peixe do Dia + 2 pratos rotativos |
| **Bitoque da Casa** | **Fora da rotação** — disponível a qualquer hora, todos os dias (13,50 €) |
| **Fim de semana** | Sem PF. Só petiscos + Bitoque |

Na prática o cliente tem sempre **4 opções de almoço** durante a semana (3 PF + Bitoque).

---

## Rotação — 5 pratos, 2 aparições por semana cada

| | Slot 1 | Slot 2 | Slot 3 |
|---|---|---|---|
| **Segunda** | Bife Acebolado · 12,90 € | Frango Grelhado · 12,90 € | Peixe do Dia · preço do dia |
| **Terça** | Porco à Moda do Chef · 12,90 € | Bacalhau à Brás · 13,90 € | Peixe do Dia · preço do dia |
| **Quarta** | Carne de Sol com Mandioca · 13,90 € | Frango Grelhado · 12,90 € | Peixe do Dia · preço do dia |
| **Quinta** | Bife Acebolado · 12,90 € | Porco à Moda do Chef · 12,90 € | Peixe do Dia · preço do dia |
| **Sexta** | Carne de Sol com Mandioca · 13,90 € | Bacalhau à Brás · 13,90 € | Peixe do Dia · preço do dia |

**Lógica da grelha:**

- Nenhum prato aparece em dias consecutivos — o cliente habitual nunca vê o mesmo prato dois dias seguidos.
- Todos os dias têm pelo menos uma opção a 12,90 €, excepto sexta (compensado pelo Bitoque a 13,50 €).
- Segunda é dia fraco: pratos mais simples e baratos, menos risco de desperdício.
- Sexta puxa o ticket médio: os dois pratos de 13,90 € no dia de maior lota.
- Todos os dias: 1 carne vermelha/porco + 1 ave ou bacalhau + 1 peixe fresco.

---

## Prato retirado da rotação

**Frango à Passarinho** — sai do PF, fica como candidato a petisco ou especial de fim de semana.

Dois motivos:

1. **Fritadeira saturada.** Em pico de almoço a fritadeira está ocupada com coxinhas, bolinhas, rissóis e pastéis de vento. Meter um PF de fritura em cima disso atrasa o serviço inteiro.
2. **Redundância de ave.** Já temos Frango Grelhado, que é a opção "leve" que o almoço de escritório procura. Dois frangos na mesma lista não acrescenta escolha real.

---

## Alergénios — a completar

Todos os PF incluem base fixa com farofa → **LEITE** transversal a todos.

| Prato | Alergénios declarados |
|---|---|
| Bife Acebolado | LEITE |
| Frango Grelhado | LEITE |
| Porco à Moda do Chef | LEITE |
| Carne de Sol com Mandioca | LEITE |
| Bacalhau à Brás | LEITE, PEIXE, OVO |
| Peixe do Dia | LEITE, PEIXE (restantes variam com o corte) |

> ⚠️ A declaração de alergénios do **Peixe do Dia** tem de ser actualizada em ardósia todos os dias, com o peixe efectivamente servido. É obrigação legal, não opcional.

---

## Harmonização com as cervejas da casa

| Prato | Cerveja |
|---|---|
| Bife Acebolado | **Noite Fechada** (Stout) — torrado da cerveja contra o tostado do bife e da cebola |
| Frango Grelhado | **Pressão da Casa** (Lager) — limpa o paladar, não abafa o limão e coentros |
| Porco à Moda do Chef | **Copo Cheio** (IPA) — o amargor corta a gordura da entremeada e segura a dedo-de-moça |
| Carne de Sol com Mandioca | **Copo Cheio** (IPA) — final seco contra a manteiga de garrafa |
| Bacalhau à Brás | **Pressão da Casa** (Lager) — prato já rico em ovo e batata, cerveja tem de ser leve |
| Peixe do Dia | **Pressão da Casa** (Lager) — segura qualquer peixe grelhado |

---

## Dois buracos por fechar antes da abertura

### 1. A "base fixa" nunca foi definida

Todos os PF dizem "inclui base fixa" e todos declaram farofa, mas **não existe ficha técnica** que diga o que é a base fixa. Presumo arroz + feijão + farofa + salada, mas isso é presunção minha, não decisão registada.

Sem isto fechado não há custeio possível, não há compras, e a equipa serve doses diferentes conforme quem está ao fogão.

### 2. Nenhum PF está custeado

O ficheiro `2026-07-28-seed-fichas-tecnicas.sql` cobre pequeno-almoço e petiscos. **Não cobre um único PF.** Não tenho food cost % para nenhum destes sete pratos.

A €12,90 com base fixa completa, a minha suspeita é que o Bife Acebolado e a Carne de Sol estão apertados. Mas é suspeita — não afirmo margens sem números.

**Próximo passo:** definir a base fixa, custear os 5 pratos + bitoque, e só depois confirmar os preços da grelha acima.
