-- Preços por canal na ementa (jul 2026).
--
-- Mesmo item da ementa, preços diferentes conforme o canal de atendimento:
--   • preco            → LOCAL (mesa/balcão). NÃO muda; é o preço atual.
--   • preco_online     → Restaurante online (site).
--   • preco_plataforma → Referência do preço nas plataformas (Uber/Glovo).
--                        Só para comparação no site; as plataformas cobram
--                        do lado delas.
--
-- As duas colunas novas são nullable: quando não estão definidas, a app faz
-- fallback ao preco local (coalesce(preco_online, preco)). Assim nada quebra
-- antes de os preços online serem preenchidos no Admin.
--
-- Aplicar no SQL Editor do Supabase. Idempotente, não-destrutiva.

alter table public.products
  add column if not exists preco_online     numeric(10,2),
  add column if not exists preco_plataforma numeric(10,2);

alter table public.product_variants
  add column if not exists preco_online     numeric(10,2),
  add column if not exists preco_plataforma numeric(10,2);

alter table public.combos
  add column if not exists preco_online     numeric(10,2),
  add column if not exists preco_plataforma numeric(10,2);
