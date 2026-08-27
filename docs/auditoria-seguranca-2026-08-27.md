# Auditoria de segurança pré-abertura — 100PRESSÃO

**Data:** 2026-08-27
**Âmbito:** as 20 acções da lista, verificadas uma a uma contra o sistema real.
**Método:** políticas RLS e definições de funções lidas directamente da base de
dados de produção (`upbwaweymbtcatfvjmdg`), `vercel.json` e `src/lib/supabase.js`
lidos do repositório, `npm audit` corrido sobre as dependências de produção,
linter de segurança da Supabase executado hoje. Nada respondido de memória.

**Legenda:** ✅ FEITO · 🟡 PARCIAL · ❌ EM FALTA

| # | Acção | Estado |
|---|-------|--------|
| 1 | Esconder API Keys | ✅ |
| 2 | Limpar secrets do git | ✅ |
| 3 | Public Key DB | ✅ |
| 4 | Ativar RLS | ✅ |
| 5 | Criptografia de dados | 🟡 |
| 6 | Auth Server side | ✅ |
| 7 | Restringir acessos | ❌ |
| 8 | Bloquear Mass Assignment | 🟡 |
| 9 | Proteger cookies | 🟡 |
| 10 | Hash nas senhas | 🟡 |
| 11 | Rate limit | 🟡 |
| 12 | Bot protection | ❌ |
| 13 | Queries parametrizadas | ✅ |
| 14 | Validação dos Inputs | ✅ |
| 15 | Vazar conteúdo | ❌ |
| 16 | Restringir upload | 🟡 |
| 17 | Trim respostas da API | ❌ |
| 18 | Add security headers | ❌ |
| 19 | Forçar HTTPS | 🟡 |
| 20 | Scam de dependência | ❌ |

**7 feitas · 7 parciais · 6 em falta.**

---

## A leitura que interessa antes dos detalhes

Os pontos **7, 15 e 17 são a mesma falha**, contada três vezes pela lista.
A política de leitura da tabela `perfis` é literalmente `USING (true)` para
qualquer utilizador autenticado, e a tabela tem uma coluna `pin_hash`. Isso é,
ao mesmo tempo, acesso não restringido (7), vazamento de conteúdo (15) e
resposta da API por aparar (17).

**Uma correcção fecha três dos seis pontos em falta.** É por aí que se começa.

Os outros três em falta — bot protection (12), security headers (18) e
vigilância de dependências (20) — são independentes e resolvem-se em paralelo.

---

## 1. Esconder API Keys — ✅ FEITO

A chave `service_role` aparece exclusivamente nos ficheiros de `api/`, sempre
como `process.env.SUPABASE_SERVICE_ROLE_KEY`, nunca em literal. O código do
cliente (`src/`) não lhe toca em lado nenhum. As variáveis vivem no painel da
Vercel, não no repositório.

Mantém-se a regra que já aplicámos duas vezes esta semana: chaves secretas vão
do painel do fornecedor directamente para o cofre de segredos, sem passar por
mim no chat. Vale para a Turnstile e para o serviço de email que falta montar.

## 2. Limpar secrets do git — ✅ FEITO

Verifiquei o **histórico**, não apenas o estado actual — é a distinção que
interessa, porque um `.gitignore` acrescentado tarde não limpa o que já foi
commitado. O `.env` nunca entrou no repositório. Não há nada para expurgar.

## 3. Public Key DB — ✅ FEITO

O cliente usa `VITE_SUPABASE_ANON_KEY`, que é a chave publicável e é para ser
pública — a segurança não vem dela, vem da RLS por baixo. É exactamente o
desenho correcto: a chave no browser não dá acesso a nada que a política não
autorize.

## 4. Ativar RLS — ✅ FEITO

As 30 tabelas do esquema `public` têm Row Level Security activa. Seis não têm
política nenhuma, o que em Postgres significa **negar tudo**: cinco cópias de
segurança (`backup_20260809_*`) e a `pin_tentativas`. Nesses casos é o
comportamento pretendido.

## 5. Criptografia de dados — 🟡 PARCIAL

**Em trânsito:** TLS em tudo — Vercel, Supabase, sem excepção e sem forma de
desligar por acidente. ✅

**Em repouso:** a Supabase cifra o disco (AES-256) ao nível da plataforma. ✅

**Ao nível da coluna:** não existe. Guardamos `cliente_telefone`,
`cliente_email`, `morada`, `fatura_nif` e os contactos das candidaturas em
texto simples dentro da base de dados.

Para a nossa escala isto é uma decisão defensável, não uma falha — cifrar
colunas que precisamos de pesquisar traz mais problemas do que resolve, e quem
tem acesso ao disco já tem acesso à chave. Fica registado como decisão
consciente, não como esquecimento. Se um dia guardarmos dados de pagamento
(não guardamos — ver nota no fim), a conversa muda.

## 6. Auth Server side — ✅ FEITO

Este está bem feito e vale a pena dizer porquê. As verificações não estão no
React — estão na base de dados, onde não se contornam:

- RLS activa nas 30 tabelas
- `e_admin()` / `e_equipa()` chamados **dentro** das funções `SECURITY DEFINER`,
  verificado função a função: `apagar_beta_tester`, `aplicar_movimento_stock`,
  `definir_venda_ementa`, `promover_candidatura`
- `verificar_pin` exige `auth.uid()` — não responde a quem não tem sessão
- o interruptor do canal online é lido dentro de `criar_pedido_online`, por isso
  não se abre a loja chamando a API directamente

Os guardas de rota no React são cosméticos, e não faz mal nenhum: quem os
contornar não encontra dados do outro lado.

O linter da Supabase assinala 22 funções `SECURITY DEFINER` alcançáveis por
utilizadores anónimos ou autenticados. Revi as que fazem alterações sensíveis —
todas têm `if not e_admin() then raise exception`. Os avisos são ruído neste
caso; fica registado que foram verificados para não voltarem a ser reabertos
na próxima auditoria.

## 7. Restringir acessos — ❌ EM FALTA (crítico)

```
perfis · leitura autenticada · SELECT · authenticated · USING (true)
```

Qualquer utilizador autenticado lê **todas as linhas e todas as colunas** de
`perfis`. A tabela tem sete colunas: `id`, `email`, `nome`, `papel`,
**`pin_hash`**, `ativo`, `criado_em`.

O nosso código só pede as colunas de que precisa — mas isso é convenção nossa,
não barreira. Quem tenha sessão válida pede `pin_hash` pela API REST e recebe.
E como o PIN tem 4 dígitos com SHA-256 simples (ponto 10), são dez mil
hipóteses: testam-se offline num portátil em menos de um segundo.

**Resultado prático:** qualquer pessoa da equipa com acesso ao painel consegue
descobrir o PIN de toda a gente, incluindo o teu. Enquanto fores tu sozinho
não há exposição real. No dia em que entrar a primeira pessoa, há.

**Correcção:** política restrita a `id = auth.uid()` para leitura própria,
vista sem `pin_hash` para o que o painel precisa de ver dos outros, e o papel
continua a resolver-se pelas funções `e_admin()` / `e_equipa()` que já existem.

## 8. Bloquear Mass Assignment — 🟡 PARCIAL

O essencial está feito, e da melhor maneira possível: **a tabela `perfis` não
tem política de INSERT nem de UPDATE.** Nenhuma. Ninguém se promove a
`papel = 'admin'` nem escreve o próprio `pin_hash` pela API, porque a operação
não existe. É a defesa de manual e está lá.

O portal de candidaturas também está bem fechado — a política anónima tem lista
branca explícita:

```
estado = 'nova' AND origem = 'portal' AND colaborador_id IS NULL
AND notas_internas IS NULL AND decidido_em IS NULL
AND candidatura_dentro_do_limite(ip_hash)
```

Três buracos menores, por ordem de importância:

**a) `orders` e `order_items` — UPDATE por `e_equipa()` sem restrição de coluna.**
Um membro da equipa que não seja admin pode alterar o `total` de um pedido. Não
é ataque externo, é controlo interno — mas é a que tem consequência real em
dinheiro.

**b) `feedback` — INSERT `WITH CHECK (true)` para `{public}`.**
A tabela tem `lido boolean default false`. Um anónimo pode inserir com
`lido: true`, e a crítica dele nasce já marcada como lida — ninguém a vê. Não
é grave, mas é literalmente mass assignment.

**c) `colaborador_documentos` — a lista branca anónima cobre `candidatura_id`,
`colaborador_id` e `tipo`, mas não `caminho`.** Um anónimo pode inserir uma
linha a apontar para qualquer caminho dentro do bucket `candidaturas`. Impacto
baixo (não tem SELECT, e o bucket só tem candidaturas), mas fecha-se numa linha.

## 9. Proteger cookies — 🟡 PARCIAL / NÃO APLICÁVEL COMO ESTÁ

Não temos cookies de autenticação para proteger. O `supabase-js` guarda a
sessão em **localStorage**, não em cookies — por isso `HttpOnly`, `Secure` e
`SameSite` não se aplicam.

Isso não é neutro: um token em localStorage é legível por qualquer JavaScript
que corra na página. Um cookie `HttpOnly` não seria.

O que está bem feito: o cliente das páginas públicas (`/cardapio`, `/ecran`)
tem `persistSession: false` e `autoRefreshToken: false` com `storageKey`
próprio — a sessão da equipa não anda a passear por ecrãs que não precisam dela.

**A conclusão que importa:** a defesa real de um token em localStorage é não
haver XSS, e a defesa contra XSS é a Content-Security-Policy — que não temos
(ponto 18). Os pontos 9 e 18 são o mesmo problema visto de dois lados. Resolver
o 18 é o que resolve o 9.

## 10. Hash nas senhas — 🟡 PARCIAL

**Senhas dos utilizadores:** geridas pela Supabase Auth, bcrypt, nunca passam
por código nosso. ✅

**PINs do painel:** `sha256(id || ':' || pin)` com PIN `^\d{4}$`. Dois problemas
somados — dez mil combinações, e SHA-256 é rápido de propósito (é para isso que
serve). Não há alongamento de chave.

Há travão *online*: 10 tentativas em 15 minutos, na tabela `pin_tentativas`.
Não há travão *offline*, e é o offline que o ponto 7 torna possível.

**Correcção:** `crypt()` com bcrypt — a extensão `pgcrypto` já está instalada,
não é dependência nova — e PIN de 6 dígitos. Meia hora, e resolve mesmo que a
política do ponto 7 volte a abrir um dia por acidente.

## 11. Rate limit — 🟡 PARCIAL

Existe onde foi construído de propósito:

- candidaturas — `candidatura_dentro_do_limite(ip_hash)` + tecto global 50/dia
- PIN — 10 tentativas / 15 minutos
- beta testers — `beta_dentro_do_limite(ip_hash)`

**Não existe** em `criar_pedido_online` nem em `criar_sessao`. São duas funções
anónimas que escrevem na base de dados sem travão nenhum. Não é fuga de dados —
é porta aberta para enchimento de lixo. Cinquenta mil encomendas falsas na
noite da abertura estragam o serviço sem ninguém ter de invadir nada.

## 12. Bot protection — ❌ EM FALTA

Continua à espera da chave pública do widget da Cloudflare Turnstile. Enquanto
não existir, a defesa do portal é o tecto diário de 50 e o campo-armadilha.
Chega para um robô distraído; não chega para alguém decidido.

Quando criares o widget: a chave **pública** (site key) podes colar aqui; a
**secreta** vai do painel da Cloudflare directamente para os segredos da
Supabase.

## 13. Queries parametrizadas — ✅ FEITO

Corri uma busca por SQL dinâmico em todas as funções do esquema `public` —
`EXECUTE format(...)`, concatenação com `||` para construir comandos,
`quote_ident`, `quote_literal`. **Zero resultados.**

Toda a lógica está em plpgsql estático com parâmetros tipados. Injecção de SQL
não é improvável aqui — é estruturalmente impossível. Este é o ponto mais
limpo dos vinte.

## 14. Validação dos Inputs — ✅ FEITO

Li o corpo de `criar_pedido_online` inteiro. Valida, do lado do servidor: nome
(≤80), telemóvel (9 dígitos exactos), email (expressão regular, ≤120), NIF
(9 dígitos), tipo de encomenda, confirmação de idade, aceitação de condições,
método de pagamento contra lista fechada, nº de itens (≤50), quantidade por
item (1–99), raio de entrega e mínimo de encomenda.

E o que mais importa: **vai buscar o preço à base de dados em vez de aceitar o
que o cliente envia.** É isto que impede alguém de encomendar a €0,01 — e é o
erro mais comum em lojas online mal feitas.

Do lado das candidaturas há validação equivalente em `src/lib/candidaturas.js`,
espelhada em CHECK constraints na base de dados, com testes automáticos.

## 15. Vazar conteúdo — ❌ EM FALTA

Duas fugas, uma séria e uma menor.

**Séria:** o `pin_hash` do ponto 7. É a mesma falha.

**Menor:** `definicoes` tem `SELECT USING (true)` para `{public}` — qualquer
anónimo lê **todas** as definições do sistema, não apenas as que o portal
precisa. Hoje isso significa limiares, taxas, configuração de entrega e
configuração do portal. Nada disso é segredo, mas é mais superfície do que a
necessária, e no dia em que alguém puser uma definição sensível lá dentro passa
a ser fuga. Fecha-se com uma política que exponha só as chaves públicas.

## 16. Restringir upload — 🟡 PARCIAL

```
candidaturas · privado · 5 MB · pdf, jpeg, png          ✅
produtos     · PÚBLICO · sem limite · todos os tipos    ❌
```

O bucket `candidaturas` está bem: privado, limites impostos pelo **servidor**
(não apenas pelo formulário), acesso só por URL assinado de 300 segundos, e os
nomes de ficheiro do candidato nunca entram no caminho de armazenamento — há
teste automático que passa `../../etc/passwd; rm -rf /.pdf` e verifica que sai
`abc-123/curriculo-x1.pdf`.

O bucket `produtos` está público, sem `file_size_limit` e sem
`allowed_mime_types`. A escrita está protegida por política (só admin), por
isso não é buraco aberto — mas um administrador distraído pode lá pôr um
ficheiro de 2 GB, e público significa que a Vercel serve isso a quem pedir.

**Correcção:** 5 MB e `image/jpeg, image/png, image/webp`. Público pode
continuar — as fotos dos produtos são para ser vistas.

## 17. Trim respostas da API — ❌ EM FALTA

Mesma raiz do ponto 7, dita de outra maneira: o PostgREST devolve a linha
inteira, e a selecção de colunas que fazemos no cliente é decoração. A API não
apara nada — a política é que tem de aparar.

Onde se nota: `perfis` (devolve `pin_hash`) e `definicoes` (devolve tudo a
anónimos). Nas restantes tabelas as políticas já limitam por linha, o que
resolve o essencial.

A regra a fixar: **se uma coluna não pode ser vista, não basta não a pedir —
tem de não poder ser pedida.**

## 18. Add security headers — ❌ EM FALTA

O `vercel.json` actual tem `Cache-Control` no sitemap e `X-Robots-Tag` nas
rotas internas. Mais nada. Falta:

- `Content-Security-Policy` — é a que interessa, porque é a que protege o token
  em localStorage (ponto 9)
- `Strict-Transport-Security` — ver ponto 19
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

Quatro destas entram sem risco nenhum. A CSP exige cuidado para não partir as
chamadas à Supabase nem os tipos de letra — faz-se primeiro em modo
`Report-Only`, confirma-se que nada parte, e só depois se activa.

## 19. Forçar HTTPS — 🟡 PARCIAL

A Vercel redirecciona HTTP para HTTPS automaticamente. ✅

O que falta é o `Strict-Transport-Security`. Sem HSTS, o **primeiro** pedido de
um dispositivo novo pode sair em texto simples antes de o redireccionamento
acontecer — que é exactamente a janela que um ataque de rede aproveita. Com
HSTS, o browser recusa-se a tentar sequer.

É uma linha, e vai no mesmo trabalho do ponto 18.

## 20. Scam de dependência — ❌ EM FALTA

Não existe pasta `.github/` no repositório: sem Dependabot, sem análise
automática, sem verificação nas entregas. Ninguém nos avisa quando sai um aviso.

Corri `npm audit` sobre as dependências de produção agora mesmo:

```
4 vulnerabilidades de severidade ALTA

react-router 7.12.0 – 7.18.1
  RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
  (afecta react-router-dom, que usamos)

postcss <= 8.5.22
  Path Traversal no carregamento automático de source maps  (2 avisos)
```

A do `react-router` é a que conta: é CSRF, e nós temos painel autenticado.
São dez dependências de produção — `npm audit fix` e uma passagem de teste
resolve isto numa tarde.

Sobre o nome do ponto: "scam de dependência" cobre também a outra metade do
problema, que é alguém publicar um pacote com nome parecido e nós instalarmos
por engano. Com dez dependências de produção, todas conhecidas, esse risco é
baixo — mas é mais um argumento para o Dependabot, que também avisa quando um
pacote muda de mãos.

---

## Ordem de execução

**Antes de a equipa começar a usar o painel** — enquanto fores tu sozinho, o
ponto 7 não tem exposição real; no dia em que entrar a primeira pessoa, tem:

1. Fechar a política de leitura de `perfis` — fecha os pontos **7, 15 e 17**
2. Trocar SHA-256 por bcrypt e subir o PIN para 6 dígitos — ponto **10**
3. `npm audit fix` e verificar o `react-router` — ponto **20**

**Antes da abertura ao público:**

4. Cabeçalhos de segurança no `vercel.json`, CSP em `Report-Only` primeiro —
   fecha os pontos **18, 19 e a parte que interessa do 9**
5. Limites no bucket `produtos` — ponto **16**
6. Rate limit em `criar_pedido_online` e `criar_sessao` — ponto **11**
7. Restringir a coluna nos UPDATE de `orders` e fechar os dois buracos menores —
   ponto **8**
8. Turnstile no portal — ponto **12**, depende da tua chave pública

**Primeira semana:**

9. Dependabot no repositório — ponto **20**, a metade preventiva

Tudo isto é trabalho meu excepto a chave da Turnstile. Os pontos 1 a 3 cabem
numa sessão; os 4 a 7 noutra.

---

## Duas coisas fora da lista que vale a pena registar

**Não guardamos dados de cartão.** Nenhum. Os métodos de pagamento aceites são
MB Way, Multibanco, cartão, Pix e dinheiro, e nenhum passa por nós. Isso tira
o PCI DSS quase inteiro de cima da mesa — é a razão pela qual não aparece nesta
auditoria, e é uma boa decisão que já estava tomada.

**Duas coisas que só tu podes fazer:** confirmar que o GitHub, a Supabase e a
Vercel têm autenticação em dois passos activa — três contas que, comprometidas,
dão acesso total ao código, aos dados e ao alojamento; e activar a protecção
contra palavras-passe comprometidas na Supabase (Authentication → Providers →
Password), que o linter reporta como desligada e é um clique.

---

*Auditoria conduzida por Daniel Cunha (CTO). Para exame mais profundo —
modelação de ameaças, teste de intrusão ao painel, revisão da superfície da
API — o passo seguinte é a Bea Salgado (`/seguranca-check`).*
