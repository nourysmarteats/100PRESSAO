-- 100PRESSÃO — Desempenho: índices de FK + RLS initplan
-- Autor: Daniel Cunha · Data: 2026-07-20 · Estado: APLICADO
-- Migração registada: 20260720_indices_fk_e_rls_initplan
--
-- Sem alteração de comportamento. Duas correcções de desempenho apontadas
-- pelo linter da Supabase, ambas relevantes para o serviço ao balcão:
--
--   1. Dez chaves estrangeiras sem índice de cobertura. A mais importante é
--      order_items.order_id — é a consulta que o Staff repete a cada
--      actualização de ecrã ("itens deste pedido"). Sem índice, é varrimento
--      sequencial da tabela toda. Irrelevante com 15 pedidos; sensível com
--      centenas por noite.
--      Acrescentado ainda idx_orders_criado_em: o Staff e o fecho de caixa
--      filtram sempre por data.
--
--   2. Seis políticas de RLS chamavam auth.uid() directamente, o que faz o
--      Postgres reavaliar a função por CADA linha analisada. Envolver a
--      chamada em (select ...) reduz a uma avaliação por consulta.
--      Aproveitou-se para unificar todas as políticas nas funções
--      e_equipa() / e_admin(), criadas na migração de RLS do mesmo dia.
--
-- VERIFICAÇÃO PÓS-APLICAÇÃO
--   - Advisor de performance: 0 avisos de unindexed_foreign_keys e 0 de
--     auth_rls_initplan (antes: 10 e 6).
--   - Leitura com role anon: menu visível (37 produtos), orders e perfis a
--     devolver 0. Comportamento inalterado.
--   - Os avisos "unused_index" que aparecem a seguir são esperados: índices
--     criados há segundos numa base quase vazia nunca foram usados. Reavaliar
--     passadas algumas semanas de serviço real, não agora.
--
-- REVERSÃO
--   Os índices podem ser removidos sem risco (drop index ...). As políticas
--   revertem-se trocando (select public.e_equipa()) pela expressão anterior
--   -- ver 20260720_rls_ementa_e_perfis.sql e o histórico de migrações.

-- Conteúdo exacto aplicado: ver a migração registada com o nome
-- `indices_fk_e_rls_initplan` no histórico do projecto Supabase.
-- Este ficheiro fica no repositório como registo e justificação.

-- Índices
create index if not exists idx_order_items_order_id      on public.order_items (order_id);
create index if not exists idx_order_items_product_id    on public.order_items (product_id);
create index if not exists idx_order_items_variant_id    on public.order_items (variant_id);
create index if not exists idx_order_items_combo_id      on public.order_items (combo_id);
create index if not exists idx_orders_session_id         on public.orders (session_id);
create index if not exists idx_products_category_id      on public.products (category_id);
create index if not exists idx_combos_category_id        on public.combos (category_id);
create index if not exists idx_combo_items_combo_id      on public.combo_items (combo_id);
create index if not exists idx_combo_items_product_id    on public.combo_items (product_id);
create index if not exists idx_product_variants_prod_id  on public.product_variants (product_id);
create index if not exists idx_orders_criado_em          on public.orders (criado_em desc);

-- Políticas: todas as expressões passaram a (select public.e_equipa())
-- ou (select public.e_admin()). Lista completa na migração registada.
