-- 2026-08-09 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Limpeza dos dados de simulação, antes de arrancar com a ementa real.
--
-- PORQUÊ
-- Tudo o que estava na base entre 7 jul e 9 ago era simulação: encomendas
-- feitas pelo Leandro para si próprio ou para conhecidos, a exercitar o
-- checkout, os pagamentos e a entrega. Com o projeto a fechar e a ementa real a
-- entrar, esses registos deixam de ser úteis e passam a ser ruído — sujam os
-- relatórios, a rentabilidade e a economia da entrega, e dão números de
-- encomenda que não correspondem a nada.
--
-- O QUE SAIU        36 encomendas (48 linhas), 50 sessões de mesa,
--                   3 feedbacks, 14 movimentos de stock do tipo 'venda'.
-- O QUE FICOU       audit_log (204 registos) — decisão do Leandro: não são
--                   encomendas, e servem para resolver problemas futuros.
--                   Os 2 movimentos de stock 'entrada' — são compras reais.
--
-- FATURAS
-- As duas emitidas (FR T01P2026/1 e /2) são da série de testes do Vendus e
-- continuam a existir lá. O "T" no número identifica a série de testes; não têm
-- valor fiscal e não há obrigação de conservação. Limpar no Vendus, se se
-- quiser, faz-se no Vendus.

-- ─────────────────────────────────────────────────────────────────────────
-- CÓPIA DE SEGURANÇA
-- ─────────────────────────────────────────────────────────────────────────
-- Mesma prática dos preços (2026-08-07): apagar com rede. Reversível enquanto
-- estas tabelas existirem; podem ser largadas quando o arranque real estiver
-- consolidado.
create table public.backup_20260809_orders as select * from public.orders;
create table public.backup_20260809_order_items as select * from public.order_items;
create table public.backup_20260809_sessions as select * from public.sessions;
create table public.backup_20260809_feedback as select * from public.feedback;
create table public.backup_20260809_stock_movements as
  select * from public.stock_movements where tipo = 'venda';

-- CREATE TABLE AS nasce SEM row-level security. Sem isto, as moradas, nomes e
-- telefones dos clientes ficariam legíveis por qualquer anónimo através da API
-- REST — a cópia de segurança seria uma fuga de dados. Com RLS ligada e zero
-- políticas, só a service role lhes chega.
alter table public.backup_20260809_orders enable row level security;
alter table public.backup_20260809_order_items enable row level security;
alter table public.backup_20260809_sessions enable row level security;
alter table public.backup_20260809_feedback enable row level security;
alter table public.backup_20260809_stock_movements enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- REPOR O STOCK
-- ─────────────────────────────────────────────────────────────────────────
-- stock_items.quantidade é um saldo guardado, não derivado dos movimentos: não
-- há gatilho em stock_movements que o recalcule. Apagar os movimentos sem
-- devolver a quantidade deixaria o Café moído a −15, o Leite a −0,75 e o Pastel
-- de bacalhau a −2 — saldos negativos sem causa visível em lado nenhum.
update public.stock_items si
set quantidade = si.quantidade + v.consumido
from (
  select stock_item_id, sum(quantidade) as consumido
  from public.stock_movements where tipo = 'venda' group by stock_item_id
) v
where v.stock_item_id = si.id;

-- ─────────────────────────────────────────────────────────────────────────
-- APAGAR
-- ─────────────────────────────────────────────────────────────────────────
-- A ordem não é arbitrária: orders.session_id referencia sessions com NO
-- ACTION, pelo que as encomendas têm de sair antes das sessões.
delete from public.feedback;
delete from public.orders;            -- order_items sai em cascata
delete from public.sessions;
delete from public.stock_movements where tipo = 'venda';

-- A primeira encomenda da ementa real é a #1, não a #55.
alter sequence public.orders_numero_seq restart with 1;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICADO APÓS APLICAR
-- ─────────────────────────────────────────────────────────────────────────
--   orders 0 · order_items 0 · sessions 0 · feedback 0
--   stock_movements 2 (as duas entradas reais)
--   audit_log 204 (intacto)
--   artigos com saldo negativo: 0
--   backup_20260809_orders 36 · backup_20260809_order_items 48

-- Para largar as cópias, quando já não fizerem falta:
--   drop table public.backup_20260809_orders,
--              public.backup_20260809_order_items,
--              public.backup_20260809_sessions,
--              public.backup_20260809_feedback,
--              public.backup_20260809_stock_movements;
