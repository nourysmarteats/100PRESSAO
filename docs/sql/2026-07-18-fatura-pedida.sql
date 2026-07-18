-- Registo do pedido de fatura (jul 2026). Independente da emissão Vendus:
-- no ato da entrega, o staff marca se o cliente quer fatura (+ NIF); o Admin
-- lista quem pediu e quem não. A emissão automática via Vendus fica para
-- quando a conta Vendus estiver ligada à Autoridade Tributária.
-- Aplicar no SQL Editor do Supabase. Idempotente.

alter table public.orders
  add column if not exists fatura_pedida boolean not null default false;

alter table public.orders
  add column if not exists fatura_nif text;
