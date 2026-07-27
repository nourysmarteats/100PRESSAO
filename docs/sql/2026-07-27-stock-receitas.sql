-- Inventário v1.1 — receitas (consumo de stock por item vendido) + desconto
-- automático na venda (jul 2026). Complementa 2026-07-27-stock-inventario.sql.
--
-- stock_receitas liga um item de stock a um produto / variante / combo, com a
-- quantidade consumida por cada unidade vendida (ex.: 1 "Tosta Mista" consome
-- 2 "Pão de forma"). Um gatilho em order_items desconta o stock a cada venda
-- (mesa agora; restaurante online quando passar de simulação a real) e regista
-- um movimento 'venda'. Precedência de correspondência: combo > variante > produto.
--
-- Nota: o desconto acontece na CRIAÇÃO do pedido. Permite stock negativo de
-- propósito (mostra que se vendeu abaixo de zero / é preciso repor) em vez de
-- bloquear a venda.
--
-- Escrita das receitas reservada a admin (e_admin). Aplicar no SQL Editor.
-- Idempotente, não-destrutiva.

begin;

create table if not exists public.stock_receitas (
  id            uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  product_id    uuid references public.products(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete cascade,
  combo_id      uuid references public.combos(id) on delete cascade,
  quantidade    numeric(10,2) not null default 1,
  criado_em     timestamptz not null default now(),
  constraint stock_receitas_um_alvo
    check (num_nonnulls(product_id, variant_id, combo_id) = 1)
);
create index if not exists idx_stock_receitas_item on public.stock_receitas (stock_item_id);
create index if not exists idx_stock_receitas_prod on public.stock_receitas (product_id);
create index if not exists idx_stock_receitas_var  on public.stock_receitas (variant_id);
create index if not exists idx_stock_receitas_comb on public.stock_receitas (combo_id);

alter table public.stock_receitas enable row level security;
drop policy if exists "stock_receitas leitura equipa" on public.stock_receitas;
create policy "stock_receitas leitura equipa" on public.stock_receitas
  for select to authenticated using (true);
drop policy if exists "stock_receitas escrita admin" on public.stock_receitas;
create policy "stock_receitas escrita admin" on public.stock_receitas
  for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- Gatilho: a cada linha de pedido inserida, desconta o stock ligado e regista
-- o movimento de venda. security definer para escrever apesar da RLS.
create or replace function public.baixar_stock_venda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.stock_items si
     set quantidade = si.quantidade - (r.quantidade * new.quantidade),
         atualizado_em = now()
    from public.stock_receitas r
   where r.stock_item_id = si.id
     and (
       (new.combo_id is not null and r.combo_id = new.combo_id)
       or (new.combo_id is null and new.variant_id is not null and r.variant_id = new.variant_id)
       or (new.combo_id is null and new.variant_id is null and new.product_id is not null
           and r.product_id = new.product_id and r.variant_id is null and r.combo_id is null)
     );

  insert into public.stock_movements (stock_item_id, tipo, quantidade, motivo)
  select r.stock_item_id, 'venda', r.quantidade * new.quantidade, 'venda (pedido)'
    from public.stock_receitas r
   where (new.combo_id is not null and r.combo_id = new.combo_id)
      or (new.combo_id is null and new.variant_id is not null and r.variant_id = new.variant_id)
      or (new.combo_id is null and new.variant_id is null and new.product_id is not null
          and r.product_id = new.product_id and r.variant_id is null and r.combo_id is null);

  return new;
end;
$$;

drop trigger if exists trg_baixar_stock on public.order_items;
create trigger trg_baixar_stock
  after insert on public.order_items
  for each row execute function public.baixar_stock_venda();

commit;
