# Copy da página /beta — Registo de Beta Testers

**Sérgio Grosman, Direcção Criativa · 27/08/2026**
Copy final para a rota `100pressao.pt/beta` especificada em `spec-registo-beta-testers-2026-08-25.md`.
Substitui os placeholders. Texto de marca: usar como está, não reescrever no código.

---

## Nota de voz

Frases curtas, ponto final. Tratamento por **tu**, como no resto do site.
Sem travessões, sem exclamações, sem superlativos, sem emoji.
Nunca prometer data de abertura: a campanha tem de aguentar um adiamento.

---

## Bloco 1 — Título da página

**Recomendado (directo):**

> # Abrimos primeiro para ti

**Alternativa poética:**

> # A casa antes de ser casa

**Alternativa funcional:**

> # Beta testers. As primeiras mesas.

O provisório "Sê beta tester" pede uma acção antes de explicar o que é a coisa, e trata o visitante como voluntário de um teste. "Abrimos primeiro para ti" diz a única coisa que interessa na primeira linha: há uma porta, e abre mais cedo para quem está aqui. O termo *beta tester* entra logo a seguir, no bloco 2, onde já tem contexto para significar alguma coisa.

---

## Bloco 2 — O que é a fase beta

> Antes de inaugurarmos, a casa abre em beta. Portas abertas, mas só para um grupo pequeno de cada vez.
>
> São as semanas em que acertamos a cozinha, o balcão e os tempos. Quem entra nesta fase come e bebe connosco enquanto ainda estamos a afinar, e diz-nos o que falta.
>
> A inauguração é o que fecha a beta.

Três linhas, três funções: o que é, o que se passa lá dentro, quando acaba. A última é a que dá valor à inscrição, porque estabelece que isto tem fim.

---

## Bloco 3 — O que o beta tester recebe

> **Entras antes de abrirmos.**
> As vagas saem por lotes. Avisamos-te quando for a tua vez.
>
> **O teu nome basta.**
> Ao balcão dizes o nome, está na lista, está tratado. Não há cupões, nem códigos, nem app.
>
> **Ouvimos-te enquanto ainda dá para mudar.**
> O que disseres na beta ainda apanha a carta a tempo.

Nenhum dos três inventa um benefício que ainda não está decidido. Se a Rita fechar um brinde para a fase beta, entra no lugar do terceiro ponto, e o terceiro passa a fecho da secção:

> **[Brinde a definir com a Rita.]**
> Uma vez, na primeira visita. Chega dizeres o nome.

---

## Bloco 4 — Linha do cartão de confirmação

**Recomendada:**

> Guarda este número. Ao balcão basta o teu nome.

**Alternativas:**

> Este número não volta a ser dado a ninguém.

> Fotografa. Ao balcão basta dizeres o nome.

A primeira faz os dois trabalhos numa linha: diz que o número vale a pena guardar, e evita que a pessoa chegue ao balcão a mostrar o telemóvel a um funcionário que só precisa de a ouvir dizer o nome.

Acima do número, um sobretítulo fixo:

> BETA TESTER

---

## Visual do cartão de confirmação

O cartão é o ecrã inteiro, não um cartão dentro de uma página. Sem header, sem footer, sem menu nesta vista.

| Elemento | Especificação |
|---|---|
| Fundo | `creme-50` `#f6f1e7`, chapado. Sem gradiente, sem textura, sem fotografia |
| Selo | Logótipo circular canónico, monocromático `grafite-900`, topo centro, 22% da largura, máx. 120 px |
| Sobretítulo | "BETA TESTER" em Oswald, maiúsculas, `tracking: 0.25em`, `grafite-600`, 14 px |
| Número | Oswald bold, `grafite-900`, `clamp(120px, 45vw, 260px)`, `line-height: 0.9`, `letter-spacing: 0.02em` |
| Zeros à esquerda | Mesma cor e mesmo peso dos outros dígitos. Não esbater |
| Linha de texto | `grafite-600`, 17 px, máx. duas linhas, centrada |
| Margem de segurança | 24 px em toda a volta, para que um enquadramento torto não corte o número |

**Porque é assim.** A fotografia é tirada de braço esticado, num mercado, com luz má e a câmara a compensar sozinha. Isso perdoa muito pouco:

- **Contraste máximo, uma cor só.** `grafite-900` sobre `creme-50` dá cerca de 16:1. O cobre no número desce para metade disso e é o primeiro a desaparecer quando a câmara escurece a imagem.
- **Nada de traços finos.** Sem contornos de 1 px, sem sombras suaves, sem números em contorno vazado. A compressão da fotografia come tudo isso.
- **Fundo claro e chapado** também protege a exposição: a câmara mede o creme, não uma zona escura, e o número não fica queimado.
- **Sem animação nesta vista.** Um fade apanhado a meio dá uma fotografia com o número a 40% de opacidade. O ecrã aparece feito.
- **Tudo num ecrã de 375x667 sem scroll.** Se o número obrigar a rolar, metade das fotografias vem sem ele.
- **Sem QR.** Não há nada para ler. O que confirma é o nome na lista.

---

## Antes de ir a produção

O texto de consentimento não é meu e não deve ser escrito no código à pressa: é da Bea Salgado, e a versão aceite fica gravada com cada registo, como está na spec.
