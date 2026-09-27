# Base de dados — esquemas e convenções

Movido do CLAUDE.md em 2026-09-27. Ler antes de escrever migrações, RLS ou estimar algo sobre a BD.

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

## Tarefas agendadas (pg_cron)

| Hora | O quê |
|---|---|
| 03:15 | `expurgar_candidaturas()` |
| 03:25 | `expurgar_beta_testers()` |

