# Brief para o Daniel — Registo de Beta Testers

**Marta Aguiar, Marketing · 25/08/2026**
Substitui a secção "O pedido ao Daniel" de `campanha-abertura-distribuicao-2026-08-25.md`, que foi escrita para outra campanha e está desactualizada.

---

## Contexto

Campanha de abertura em três actos: **pré-abertura** (revelar o que vai existir) → **abertura em versão beta** → **inauguração**. Abertura e inauguração são datas diferentes; entre as duas corre a fase beta, e a inauguração é o que a fecha.

Durante a beta, os clientes não são clientes: são **beta testers**, e inscrevem-se para isso. O registo é o que torna a adesão real — quem é adicionado a uma lista é um contacto, quem se inscreve é membro. É por isso que precisa de formulário mesmo para os primeiros, que são amigos e família.

As vagas (Beta 1 amigos e família, Beta 2 mercado e bairro, Beta 3 aberto) são geridas manualmente a partir da lista. **Não é preciso construir gestão de vagas.**

---

## Construir

**1. Rota nova** — `100pressao.pt/beta`, dentro do projecto React/Vite que já existe. Não é site novo.

**2. Página única.** O que é a beta, o que o beta tester recebe, o formulário. A copy final é do Sérgio — usar placeholder e não inventar texto de marca.

**3. Formulário — quatro campos, nem mais um.**

| Campo | Tipo | Obrigatório |
|---|---|---|
| `nome` | texto | sim |
| `telemovel` | texto | sim |
| `origem` | ver ponto 4 | automático |
| `consentimento` | checkbox, **não** pré-marcado | sim |

> **Único ponto ainda por decidir pelo Leandro:** telemóvel ou email. Está aqui como telemóvel porque as convocatórias das vagas vão por WhatsApp, que em Portugal abre e o email não. Se ele decidir email, troca-se este campo e mais nada. **Não pedir os dois** — baixa a inscrição e não acrescenta nada de que precisemos.

**4. Origem — dupla captura, os dois gravados.**

- Campo oculto `origem_param`, lido de `?o=` no URL. `directo` quando ausente.
- Dropdown visível "Como soube de nós?", cinco opções, gravado em `origem_declarada`.

Não substituir um pelo outro. O parâmetro perde-se quando alguém escreve o URL à mão ou tira print e reenvia; é a discrepância entre os dois que nos diz se os QR estão a ser lidos.

**5. Confirmação com número de inscrição.** *"És o beta tester n.º 037."* Três dígitos, zeros à esquerda. Esta página é o cartão de membro — é o que a pessoa fotografa e mostra. O visual é do Sérgio; a mecânica é tua.

**6. Supabase — tabela `beta_testers`:**

- `id`, `created_at`
- `numero` — sequencial, **gerado no servidor**, com garantia de unicidade sob concorrência. Duas inscrições simultâneas não podem receber o mesmo número.
- `nome`, `telemovel`
- `origem_param`, `origem_declarada`
- `consentimento_em` (timestamp), `consentimento_versao` (que texto foi aceite)
- `vaga` — nullable, 1/2/3, preenchida à mão depois
- `estado` — nullable: inscrito / convocado / compareceu

**7. Uma query com contagem por origem.** Sem dashboard novo.

**8. Export CSV.** Botão ou comando, tanto faz.

---

## Não construir

- Login, área de membro, app
- Cupões ou códigos resgatáveis — o benefício confirma-se pelo nome na lista, ao balcão
- Envio automático de mensagens — as convocatórias são manuais nesta fase
- Gestão automática de vagas
- Integração com plataforma de email marketing
- Pixel de tracking — não há ads
- Gerador de QR — os QR são só o URL com o parâmetro
- Multi-idioma

---

## RGPD — não vai a produção sem isto

Capta dados pessoais e contacto directo. **Base legal e texto de consentimento validados com a Bea Salgado** (Segurança) antes de activar; implementação técnica contigo.

- Política de privacidade acessível a partir da página
- Prazo de conservação definido
- Direito ao apagamento operacionalizado, não só declarado
- Versão do texto de consentimento guardada com cada registo, para prova
- Responsável pelo tratamento identificado

---

## Critérios de aceitação

- `/beta?o=grupo-alges` grava `origem_param = grupo-alges`
- `/beta` sem parâmetro grava `origem_param = directo`
- Submeter sem consentimento é bloqueado
- Duas submissões simultâneas recebem números distintos
- Export CSV devolve todas as colunas
- **Funciona bem em ecrã de telemóvel** — é onde vai ser preenchido, no mercado, de pé, ao balcão

---

Diz quantas horas leva e se alguma coisa aqui colide com o que já está construído.
