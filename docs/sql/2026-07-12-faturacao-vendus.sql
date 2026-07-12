-- Migração para faturação via Vendus (jul 2026, opção 2 do CTO): botão
-- "Emitir Fatura" sob pedido no ecrã de Staff, quando o cliente paga na
-- entrega e quer fatura. Aplicar no SQL Editor do Supabase ANTES de usar.
-- Idempotente: pode correr mais do que uma vez.

alter table public.orders
  add column if not exists fatura_pedida boolean not null default false;
alter table public.orders
  add column if not exists fatura_nif text;
alter table public.orders
  add column if not exists fatura_documento_id text;
alter table public.orders
  add column if not exists fatura_documento_numero text;
alter table public.orders
  add column if not exists fatura_url text;
alter table public.orders
  add column if not exists fatura_erro text;
alter table public.orders
  add column if not exists fatura_criado_em timestamptz;
