# 100PRESSÃO — app

Contexto permanente do repositório. Qualquer sessão de Claude que abra este projecto
lê este ficheiro primeiro e **não volta a perguntar** o que está aqui dentro.

Manter curto. Se deixar de caber num ecrã, deixa de ser lido.

---

## Arranque de sessão — obrigatório

1. Invocar a skill `task-observer-shemot` **antes** de começar o trabalho.
   A activação por descrição não é garantida; esta linha é o gatilho.
2. Ler este ficheiro inteiro antes de propor alterações.
3. Antes de estimar seja o que for sobre a base de dados, inspeccionar o esquema
   real. Nunca estimar de memória.

## O que é

Cervejaria artesanal e petiscos no Mercado Municipal de Carnaxide (Loja n.º 6), Algés.
Sociedade do grupo Shemot. Sucessora de "O Oráculo" e, antes, "Noury Smart Eats" —
esses nomes estão arquivados e não devem reaparecer em copy nem em código.

## Stack

- React + Vite + Tailwind
- Supabase (Postgres 17) — projecto `upbwaweymbtcatfvjmdg`, região `eu-west-3`
- Vercel + GitHub
- Conta de serviço: `equipa@100pressao.pt`

**Não há ambiente de staging.** Existe um único projecto Supabase e é o de produção,
com pedidos, stock e vendas reais. Testes destrutivos ou de concorrência fazem-se num
*branch* Supabase temporário, nunca directamente.

### Áreas da aplicação

- Dashboard de Administrador
- Dashboard Operacional
- Interface de cliente por QR code
- Módulo de Colaboradores a recibos verdes (vínculos, pagamentos, candidaturas)
- Módulo Financeiro (despesas, receita externa, orçamento, fornecedores)
- Portal público de candidaturas em `/colaborador`
- Registo público de beta testers em `/beta`

### Onde estão as coisas

| | |
|---|---|
| Rotas | `src/App.jsx` — react-router-dom 7, tudo em `lazy()` + `Suspense` |
| Cliente Supabase | `src/lib/supabase.js`. Exporta **dois**: `supabase` (com sessão) e `supabasePublico` (sem persistência) |
| Estilos partilhados do admin | `src/pages/equipa/admin/comuns.jsx` — `CAMPO`, `BOTAO_PRIMARIO`, `CARTAO`, `useAviso()` |
| Dashboard de admin | `src/pages/equipa/Admin.jsx` — secções declaradas no array `SECCOES` |
| Regras de negócio | `src/lib/*.js`, funções puras, com testes em `*.test.mjs` (`npm test`) |
| Camada de dados do Financeiro | `src/lib/financeiro.js` — `fin()` = `supabase.schema('financeiro')` |
| SEO e rotas pré-renderizadas | `src/seo/pages.js` |
| Variáveis de ambiente | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nomes; valores nunca aqui) |
| Vercel | conta por confirmar — o conector está autenticado numa equipa sem projectos |

**Regra do cliente Supabase:** páginas públicas usam `supabasePublico`. Com o
cliente normal, a sessão de staff guardada no mesmo browser interfere com
páginas que nem precisam de autenticação.

## Dois esquemas, não um

`public` tem o negócio (pedidos, stock, ementa, equipa, candidaturas, beta).
`financeiro` tem contabilidade de gestão: `despesas`, `categorias`, `fornecedores`,
`receitas_externas`, `orcamento`, mais cinco vistas `v_*` — todas com
`security_invoker=true`, para que a RLS das tabelas de baixo se aplique a quem
consulta e não a quem criou a vista.

O esquema `financeiro` **só dá USAGE a `authenticated`**. A `anon` não tem nada lá
dentro e não pode ter: é a diferença entre um número de vendas e a contabilidade da
casa. Toda a RLS ali é `e_admin()`, nunca `e_equipa()`.

**Esquema novo não aparece na API sozinho.** Supabase → Integrations → Data API →
Settings → *Exposed schemas*. Sem isso todos os pedidos dão 404 e o erro não diz
porquê. Foi o que segurou o Financeiro depois de estar escrito e migrado.

Nesse mesmo ecrã há *Exposed tables* e *Exposed functions*. **Não os usar para o
`financeiro`**: os `GRANT` já estão feitos na migração, à medida, e o interruptor da
consola concede também à `anon`.

## Convenções do esquema — verificadas em produção

Estas não são preferências. São o que as tabelas existentes já fazem.
Divergir cria dívida permanente.

| Regra | Detalhe |
|---|---|
| Língua | Nomes de tabelas e colunas em português. `criado_em`, nunca `created_at` |
| Timestamps | `timestamptz` com `default now()`; `atualizado_em` por trigger `touch_atualizado_em()` |
| Chaves | `uuid` com `gen_random_uuid()`. Sequenciais visíveis ao utilizador por coluna *identity* (ver `orders.numero`) |
| Configuração | Tabela `definicoes` (chave/`jsonb`). Interruptores e limites vivem aí, não em constantes no código |
| Acessos | `e_admin()` e `e_equipa()`. Dados pessoais e financeiros leem-se com `e_admin()`, nunca com `e_equipa()` |
| Auditoria | `audit_log` (acao, detalhe `jsonb`) |
| Buckets | Privados por omissão, com limite de tamanho e lista de MIME. `produtos` é o único público |

## Regras que não se negoceiam

1. **Escrita pública nunca vai directa à tabela.** Passa por função
   `SECURITY DEFINER` com validação no servidor, tecto de submissões lido das
   `definicoes` e limite por `ip_hash`. Modelos: `criar_pedido_online()`,
   `inscrever_beta_tester()`. A chave `anon` viaja no bundle do browser — assumir
   sempre que está nas mãos de qualquer pessoa.
2. **Guardar `ip_hash`, nunca o IP.**
3. **Versão de consentimento é carimbada pelo servidor**, lida das `definicoes`.
   Nunca aceite do cliente — se vier do cliente, a prova não vale nada.
4. **Todo o dado pessoal nasce com prazo de conservação.** Coluna `expira_em`
   calculada por trigger, função de expurgo, tarefa `pg_cron`, registo no
   `audit_log`. Modelo: `expurgar_candidaturas()`.
5. **O registo de um apagamento não pode recriar o dado apagado.** Guardar o
   identificador e o motivo, nunca o nome nem o contacto.
6. **Minimização à entrada.** Formulários públicos não pedem NIF, NISS, IBAN,
   morada nem data de nascimento. Esses dados entram depois, pelo painel.
7. **Nada de chaves no repositório.** A `service_role` nunca entra no código,
   nem em exemplos, nem em comentários.
8. **Nada de tabelas `backup_*` novas.** Já há cinco a apodrecer no esquema.
   Cópias fazem-se fora da base de dados.
9. **Rota nova = entrada em `src/seo/pages.js`, em `SEO_PAGES` e em
   `ORDEM_ROTAS`.** Sem ela a rota não ganha ficheiro no `dist` e o `cleanUrls`
   do Vercel devolve 404 em produção. Em desenvolvimento funciona à mesma, por
   isso não se nota até ao deploy — foi assim que o `/admin` desapareceu.
10. **Origem de campanha no URL chama-se `via`.** Um só vocabulário: o gerador
    de QR do admin emite `?via=`, o Analytics lê-o no `page_location`, e o
    registo da beta grava-o. Só minúsculas, números e hífenes.
11. **Ficheiro novo importado por outro = `git add` no mesmo commit.** O plugin
    de SEO lê `dist/index.html` no `closeBundle()`, por isso um import que não
    resolve chega ao ecrã como `ENOENT: dist/index.html` e esconde a causa real.
    Antes de commitar: `npm run build > /tmp/build.log 2>&1 && git commit …` —
    encadeado pelo código de saída, nunca por `grep` ao output.

## Tarefas agendadas (pg_cron)

| Hora | O quê |
|---|---|
| 03:15 | `expurgar_candidaturas()` |
| 03:25 | `expurgar_beta_testers()` |

## Em curso

**Beta testers — no ar e a receber inscrições.** Rota `/beta`, gestão em
Admin → Beta testers. Campanha de abertura em três actos: pré-abertura → abertura
em beta → inauguração, que fecha a beta. Vagas em três lotes (`vaga` 1/2/3),
atribuídas à mão no admin.

`src/pages/Beta.jsx`, `src/lib/beta.js` (+ testes),
`src/pages/equipa/admin/BetaTesters.jsx`, `src/components/AvisoPrivacidadeBeta.jsx`.
Texto do aviso arquivado em `docs/consentimentos/beta-2026-08-28.v1.txt` — é para
lá que aponta o `aviso_versao` gravado em cada linha. **Ficheiro imutável:** versão
nova é ficheiro novo, nunca uma edição.

Por fechar, tudo fora do código:

- `definicoes.beta.beta_terminou_em` — pôr a data da inauguração. É isso que fecha
  a beta, arranca o prazo de 30 dias e manda expurgar quem não consentiu contacto
  posterior.
- NIF da entidade responsável nos avisos, e a mesma identidade nas três páginas
  (`/beta`, `/colaborador`, política de privacidade) — hoje divergem.
- Secção 11 da política de privacidade, e fechar a secção 5.
- Entidade responsável pelo tratamento: a concessão do mercado ainda está em nome
  pessoal; a transferência para a sociedade está pendente.

**Dois consentimentos, não um.** O primeiro acto não é consentimento nenhum — é o
aviso do artigo 13.º, e a base legal da inscrição é a alínea b). O segundo
(`contacto_pos_beta`, opcional, nunca pré-marcado) é o que permite falar com a
pessoa depois da inauguração. Recolhidos no mesmo acto, com carimbos separados.
O segundo nunca pode passar a obrigatório: um consentimento que é condição de
acesso não é livre e deixa de valer. Só a própria pessoa o dá ou retira — no
painel é campo de leitura.

## Quem decide o quê

| Área | Pessoa |
|---|---|
| Tecnologia, arquitectura, estimativas | Daniel Cunha (CTO) |
| RGPD, base legal, segurança, acessos | Bea Salgado |
| Prazos fiscais, societários e laborais | Sofia Bastos |
| Copy de marca e visual | Sérgio Grosman |
| Marketing, canais, medição | Marta Aguiar |
| Menu, custeio, HACCP | Rita Falcão |

Copy de marca nunca é inventada pelo agente. Placeholder até o Sérgio entregar.
