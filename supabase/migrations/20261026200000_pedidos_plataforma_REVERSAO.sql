-- Reversão de 20261026200000_pedidos_plataforma.sql
-- ATENÇÃO: se já houver pedidos de plataforma lançados, a coluna plataforma_ref
-- leva consigo o n.º de cada um. Exportar antes:
--   select numero, canal, plataforma_ref, total, criado_em from public.orders
--    where plataforma_ref is not null;

drop function if exists public.criar_pedido_plataforma(text, text, jsonb);

drop index if exists public.orders_plataforma_ref_unico;
alter table public.orders drop constraint if exists orders_plataforma_ref_formato;
alter table public.orders drop constraint if exists orders_plataforma_ref_coerente;
alter table public.orders drop column if exists plataforma_ref;

alter table financeiro.receitas_externas drop constraint if exists receitas_externas_canal_check;
alter table financeiro.receitas_externas
  add constraint receitas_externas_canal_check
  check (canal in ('pos_externo', 'glovo', 'ubereats', 'boltfood', 'eventos', 'outro'));
