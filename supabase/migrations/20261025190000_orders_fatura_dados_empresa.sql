-- Faturas a empresas: a Vendus (e o art. 36.º do CIVA) exigem nome e morada
-- do adquirente quando o NIF é de pessoa coletiva. Até aqui só se guardava o NIF.
-- Aplicada em produção a 2026-10-25 (encomenda nº 40).
alter table public.orders
  add column if not exists fatura_nome text,
  add column if not exists fatura_morada text,
  add column if not exists fatura_codigo_postal text,
  add column if not exists fatura_localidade text;

comment on column public.orders.fatura_nome is 'Nome/denominação do adquirente na fatura (obrigatório para NIF de empresa).';
comment on column public.orders.fatura_morada is 'Morada fiscal do adquirente na fatura (obrigatória para NIF de empresa).';
comment on column public.orders.fatura_codigo_postal is 'Código postal do adquirente na fatura.';
comment on column public.orders.fatura_localidade is 'Localidade do adquirente na fatura.';
