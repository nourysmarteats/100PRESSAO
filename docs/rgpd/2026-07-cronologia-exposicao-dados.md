# Cronologia técnica — exposição de dados pessoais no /cardapio

**Preparado para:** Dr. Brandão (avaliação RGPD / eventual comunicação à CNPD)
**Responsável pelo tratamento:** Sintonia dos Temperos, Lda. ("100PRESSÃO")
**Data deste documento:** 2026-07-20
**Natureza:** relato factual da configuração técnica. **Não** é uma qualificação
jurídica — a decisão de haver ou não violação comunicável (art. 33.º/34.º RGPD)
cabe à avaliação jurídica.

---

## 1. Em uma frase

Entre o arranque do sistema de pedidos e a correção aplicada esta semana, as
tabelas que guardam dados dos clientes do `/cardapio` estiveram configuradas
para **leitura por qualquer pessoa** que possuísse a chave pública da API
(chave essa que, por desenho, viaja dentro do código do site e é portanto
acessível a qualquer visitante). A falha foi de **controlo de acesso de
leitura**, já corrigida.

## 2. Que dados pessoais estavam em causa

Recolhidos no ato de fazer um pedido no `/cardapio`:

| Tabela | Campos com dado pessoal | Observação |
|---|---|---|
| `sessions` | `nome_cliente`, `posicao_mesa` | nome que o cliente escreve + mesa |
| `orders` | `total`, `metodo_pagamento`, `estado_pagamento`, `fatura_nif`, datas | **NIF** quando o cliente pede fatura |
| `order_items` | itens pedidos, quantidades, preços | conteúdo do pedido |

Sem categorias especiais de dados (art. 9.º): não há saúde, biometria, etc. O
dado mais sensível é a associação **nome + NIF + valor gasto**.

## 3. A configuração exata que causou a exposição

As três tabelas tinham, em Postgres/Supabase, estas políticas de RLS
(Row-Level Security):

```sql
create policy "anon le"     on public.sessions   for select to public using (true);
create policy "anon insere" on public.sessions   for insert to public with check (true);
create policy "anon le"     on public.orders      for select to public using (true);
create policy "anon insere" on public.orders      for insert to public with check (true);
create policy "anon le"     on public.order_items for select to public using (true);
create policy "anon insere" on public.order_items for insert to public with check (true);
```

O que isto significa, em linguagem simples:

- `for select to public using (true)` = **qualquer pedido de leitura é
  autorizado**, sem exceção, para o papel `public`.
- O papel `public` inclui o papel `anon` (anónimo). O acesso anónimo faz-se com
  a **chave publicável (anon key)** do projeto Supabase. Essa chave **está
  embutida no JavaScript do site** — tem de estar, para o site funcionar — e é
  portanto legível por qualquer visitante que inspecione o código da página.
- Conclusão: durante a janela abaixo, **qualquer pessoa na internet**, munida
  dessa chave (trivial de obter), podia ler a totalidade das linhas destas três
  tabelas — todos os nomes, mesas, valores, métodos de pagamento e NIFs.

Nota: a chave anon **não** dá acesso de administrador nem contorna RLS; o
problema não foi a chave estar exposta (é suposto estar), foi a **política
permitir leitura total** a quem a usa.

## 4. Janela temporal

- **Início da exposição:** com a entrada em funcionamento do fluxo de pedidos.
  Referências no histórico de código (Git):
  - `2026-07-05` — primeira versão do cliente de pedidos no `/cardapio`.
  - `2026-07-07` — correção da criação de sessão; **coincide com o início do
    piloto** com dados reais de clientes.
  - Tratar, de forma conservadora, **2026-07-07 como início** da recolha de
    dados reais sob a configuração exposta.
- **Fim da exposição (correção):** a migração de RLS que fechou o acesso anónimo
  e passou a leitura a só contas ativas da equipa foi **aplicada à base de dados
  de produção em 2026-07-20, 08:12:09** (hora do painel Supabase; confirmado no
  histórico de migrações). É esse o momento em que a exposição cessou. A correção
  do site que a acompanha foi publicada em **2026-07-20 ~12:00 (hora de Lisboa)**
  — pelo que, entre as 08:12 e as ~12:00, a BD já estava fechada mas o site
  antigo ainda tentava o acesso anónimo (janela em que o `/cardapio` esteve
  indisponível, sem impacto de dados).

**Janela de exposição: 2026-07-07 → 2026-07-20 08:12:09 (cerca de 13 dias).**

## 5. Dimensão (a confirmar com números exatos)

Contagem na base de dados (produção), período desde 2026-07-07:

- **Clientes afetados (registos em `sessions`): 25** — confirmado.
- **Pedidos com NIF (`orders.fatura_nif` preenchido): 2** — confirmado.
- Faturação-piloto na ordem dos ~255 €.

O nº de pessoas singulares afetadas corresponde aos 25 registos de `sessions`; o
nº de NIFs expostos ao nº de `orders.fatura_nif` preenchidos.

## 6. A pergunta que decide tudo: houve acesso indevido *real*?

A configuração **tornou possível** o acesso não autorizado. Coisa diferente é
saber se **alguém além da própria aplicação** efetivamente leu os dados. Essa é,
tipicamente, a questão central para decidir se há violação comunicável e qual o
seu risco.

- **Não é possível confirmar nem desmentir** se houve acesso indevido efetivo.
- Motivo, verificado em 2026-07-20: o projeto está no **plano Free da Supabase**,
  cuja **retenção de logs de API/Base de Dados é de apenas 1 dia** (confirmado na
  página de preços oficial da Supabase — Free: 1 dia; Pro: 7 dias; Team: 28 dias).
  Como a janela de exposição terminou a 2026-07-20 08:12 e todo o período de
  recolha (7–19 jul) está a mais de 1 dia de distância, **os registos de acesso
  desse período já foram automaticamente eliminados** e não podem ser
  recuperados. A consulta aos logs em 2026-07-20 só devolve a última hora, com
  mensagens internas do sistema (sem qualquer leitura de clientes).
- **Consequência para a avaliação:** a empresa **não consegue demonstrar** que
  não houve acesso indevido. Não há prova de que tenha havido; também não há
  prova de que não tenha havido. Esta impossibilidade de verificação é, em si, um
  elemento a ponderar (tipicamente empurra a decisão para o lado cauteloso, por
  não ser possível fundamentar um "risco baixo").

## 7. O que ainda falta obter (só acessível na consola Supabase)

Para o Dr. Brandão decidir com factos, faltam três coisas que **não estão no
código** e têm de ser retiradas do painel Supabase (Project → Database / Logs):

1. ~~**Timestamp exato da correção**~~ **FECHADO (2026-07-20):** migração
   aplicada a **2026-07-20 08:12:09** (histórico de migrações Supabase).
2. ~~**Contagem exata de afetados**~~ **FECHADO (2026-07-20):** 25 clientes
   (`sessions`), **2** pedidos com NIF (`orders.fatura_nif`). Confirmado na
   base de dados de produção.
3. ~~**Prova de acesso indevido** — Logs → API/Postgres no período 07–20 jul.~~
   **FECHADO (2026-07-20): impossível.** A retenção de logs do plano Free é de 1
   dia; os registos do período de exposição já foram eliminados. Ver secção 6.
   Fica registada a diligência: tentou-se consultar os logs, que não alcançam o
   período.

## 8. Estado atual (o que já está resolvido)

- ✅ Leitura anónima das três tabelas **fechada**; só contas ativas da equipa
  (`authenticated` + perfil ativo) leem.
- ✅ Inserção anónima direta **removida**; os pedidos passam agora por funções
  de servidor controladas (`criar_sessao` / `criar_pedido`), com o preço lido
  na base de dados e limites defensivos.
- ✅ Site em produção alinhado com esta configuração (2026-07-20).

---

### Resumo para a decisão

Houve uma **janela de ~13 dias em que dados pessoais de clientes (25 nomes,
mesas, valores, e 2 NIFs) estiveram tecnicamente acessíveis a leitura por
qualquer pessoa** com a chave pública do site. Está **corrigido**. A dimensão
está confirmada (secção 5); a existência de acesso indevido real é
**inverificável** por limitação de retenção de logs (secção 6) — a avaliação
jurídica terá de partir desse pressuposto.
