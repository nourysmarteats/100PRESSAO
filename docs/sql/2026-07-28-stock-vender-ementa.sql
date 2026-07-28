-- Inventário v1.3 — "Vender na ementa" (jul 2026).
--
-- Permite marcar um item de stock como vendável: passa a existir como produto
-- na ementa e no restaurante online, com preço e categoria próprios, desconta o
-- stock a cada venda (receita 1:1, criada aqui) e AUTO-ESGOTA quando o stock
-- chega a 0 (volta quando se repõe). Ideal para itens de venda direta (bebidas).
--
-- Depende de 2026-07-27-stock-inventario.sql (stock_items) e de e_admin().
-- Aplicar no SQL Editor do Supabase. Idempotente, não-destrutiva.

begin;

alter table public.stock_items
  add column if not exists vender_ementa      boolean not null default false,
  add column if not exists product_id         uuid references public.products(id) on delete set null,
  add column if not exists preco_venda         numeric(10,2),
  add column if not exists preco_venda_online  numeric(10,2),
  add column if not exists categoria_ementa    uuid references public.categories(id) on delete set null;

-- Sincroniza a disponibilidade do produto ligado com o stock: 0 → sai da
-- ementa; >0 → volta. Corre a cada alteração da quantidade do item.
create or replace function public.sync_produto_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.product_id is not null and new.vender_ementa then
    update public.products
       set disponivel = (new.quantidade > 0)
     where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_produto_stock on public.stock_items;
create trigger trg_sync_produto_stock
  after update of quantidade on public.stock_items
  for each row execute function public.sync_produto_stock();

-- Liga/desliga a venda na ementa de um item de stock, de forma atómica:
-- cria (ou atualiza) o produto correspondente e a receita 1:1.
create or replace function public.definir_venda_ementa(
  p_item          uuid,
  p_vender        boolean,
  p_preco         numeric default null,
  p_preco_online  numeric default null,
  p_categoria     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.stock_items;
  v_pid  uuid;
begin
  if not public.e_admin() then
    raise exception 'Ação reservada a admin' using errcode = '42501';
  end if;
  select * into v_item from public.stock_items where id = p_item;
  if v_item.id is null then
    raise exception 'Item de stock inexistente' using errcode = '22023';
  end if;

  if p_vender then
    if p_preco is null or p_preco < 0 then
      raise exception 'Preço de venda inválido' using errcode = '22023';
    end if;
    if p_categoria is null then
      raise exception 'Categoria da ementa em falta' using errcode = '22023';
    end if;

    v_pid := v_item.product_id;
    if v_pid is null then
      insert into public.products (nome, category_id, preco, preco_online, disponivel, ordem)
      values (v_item.nome, p_categoria, p_preco, p_preco_online, v_item.quantidade > 0, 999)
      returning id into v_pid;

      insert into public.stock_receitas (stock_item_id, product_id, quantidade)
      values (p_item, v_pid, 1);
    else
      update public.products
         set nome = v_item.nome,
             category_id = p_categoria,
             preco = p_preco,
             preco_online = p_preco_online,
             disponivel = (v_item.quantidade > 0)
       where id = v_pid;
    end if;

    update public.stock_items
       set vender_ementa = true,
           product_id = v_pid,
           preco_venda = p_preco,
           preco_venda_online = p_preco_online,
           categoria_ementa = p_categoria,
           atualizado_em = now()
     where id = p_item;
  else
    if v_item.product_id is not null then
      update public.products set disponivel = false where id = v_item.product_id;
    end if;
    update public.stock_items
       set vender_ementa = false, atualizado_em = now()
     where id = p_item;
  end if;
end;
$$;
revoke all on function public.definir_venda_ementa(uuid, boolean, numeric, numeric, uuid) from public;
grant execute on function public.definir_venda_ementa(uuid, boolean, numeric, numeric, uuid) to authenticated;

commit;
