# Registo de Códigos de Campanha — Beta Testers

**Marta Aguiar, Marketing · 25/08/2026**
Fonte única de verdade dos códigos `?o=`. Nenhum código é usado numa peça impressa sem estar nesta lista. Quem acrescentar um código acrescenta-o aqui primeiro.

**Regra de formato:** só minúsculas, números e hífenes. Sem acentos, sem espaços, sem maiúsculas, sem underscores. Um código fora desta regra grava `invalido` e a peça fica cega.

**Granularidade: uma peça, um código.** Não um por canal. Dois cartazes diferentes são dois códigos, mesmo que estejam no mesmo sítio.

---

## Dropdown "Como soube de nós?"

Cinco opções, por esta ordem, nenhuma pré-seleccionada:

1. Um amigo ou familiar
2. Alguém do mercado
3. Vi a loja ou um cartaz no mercado
4. Redes sociais ou grupo do bairro
5. Outra coisa

O dropdown **não espelha os códigos** — cobre o que o parâmetro não consegue apanhar. Onde o parâmetro é fiável (links tocados), o dropdown é redundante; onde o parâmetro se perde (recomendação verbal, URL escrito à mão, print reenviado), o dropdown é a única fonte.

---

## Códigos

### Pessoais — Beta 1

| Código | Peça |
|---|---|
| `pessoal-leandro` | Mensagens individuais do Leandro |
| `pessoal-neide` | Mensagens individuais da Neide |

### Loja e mercado — presença física

| Código | Peça |
|---|---|
| `vinil-obra` | Vinil de grande formato no tapume da Loja 6 |
| `cartaz-porta` | Cartaz A3 na porta da Loja 6 |
| `mesa-beta` | Cartão de mesa, durante a fase beta |

### Bancas vizinhas — um por banca

Esquema `banca-<ofício>`, numerado se houver repetição (`banca-talho-1`, `banca-talho-2`).
Ofício e não nome próprio: se a banca mudar de dono, o código continua a dizer alguma coisa.

| Código | Peça |
|---|---|
| `banca-talho` | Cartão A6 ao balcão |
| `banca-peixaria` | Cartão A6 ao balcão |
| `banca-frutaria` | Cartão A6 ao balcão |
| `banca-mercearia` | Cartão A6 ao balcão |
| `banca-padaria` | Cartão A6 ao balcão |
| `banca-flores` | Cartão A6 ao balcão |
| `banca-charcutaria` | Cartão A6 ao balcão |
| `banca-queijos` | Cartão A6 ao balcão |

> Lista provisória — não conheço as bancas reais do Mercado de Carnaxide. Confirmar no levantamento presencial e corrigir aqui antes de imprimir.

### Grupos locais — um por grupo

Esquema `grupo-<localidade>`, numerado se houver mais do que um grupo por localidade.

| Código | Peça |
|---|---|
| `grupo-carnaxide` | Post no grupo de Carnaxide |
| `grupo-alges` | Post no grupo de Algés |
| `grupo-linda-a-velha` | Post no grupo de Linda-a-Velha |
| `grupo-miraflores` | Post no grupo de Miraflores |
| `grupo-oeiras` | Post no grupo de Oeiras |

> Confirmar quais os grupos que existem e aceitam o post antes de fixar.

### Contas próprias

| Código | Peça |
|---|---|
| `bio-instagram` | Link na bio do Instagram |
| `bio-facebook` | Link na página de Facebook |
| `bio-tiktok` | Link na bio do TikTok |

### Institucionais

| Código | Peça |
|---|---|
| `junta-carnaxide` | Junta de Freguesia de Carnaxide e Queijas |
| `cm-oeiras` | Câmara Municipal de Oeiras |
| `mercado-carnaxide` | Gestão / página do Mercado Municipal |
| `google-business` | Publicação no Google Business Profile |

### Imprensa — um por publicação

Esquema `imprensa-<publicacao>`. Criar à medida que confirmarem publicação.

| Código | Peça |
|---|---|
| `imprensa-jornal-oeiras` | Provisório |
| `imprensa-oeiras-actual` | Provisório |

### Sistema

| Código | Peça |
|---|---|
| `partilha` | Link gerado pelo botão de partilha da página de confirmação |
| `directo` | Automático quando não há parâmetro. Não imprimir. |

---

## Aviso técnico para o Daniel

Se a página de confirmação tiver botão de partilha, o link que ele produz tem de ser limpo e levar `?o=partilha` — **não** o parâmetro com que a pessoa chegou. Caso contrário, quem chegou por `banca-talho` e partilha o URL faz com que o amigo conte também como `banca-talho`, e esse código infla sozinho até deixar de significar nada.
