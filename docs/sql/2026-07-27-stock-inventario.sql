-- Inventário / controlo de stock — v1 (jul 2026).
--
-- Itens de stock organizados por categoria/subcategoria (texto livre, ex.:
-- Bebidas › Refrigerantes, Pães, Semi-prontos), com quantidade atual, unidade,
-- alerta de stock baixo e custo opcional. Um registo de movimentos guarda cada
-- entrada/saída/ajuste (e, na v1.1, as vendas automáticas).
--
-- Escrita reservada a admin (usa o helper public.e_admin(), já em produção).
-- Leitura para a equipa autenticada (o stock não é público).
-- O desconto automático na venda (ligação produto→item de stock + gatilho)
-- entra na v1.1 — aqui os movimentos são manuais.
--
-- Aplicar no SQL Editor do Supabase. Idempotente, não-destrutiva.

begin;

create table if not exists public.stock_items (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  categoria     text,
  subcategoria  text,
  unidade       text not null default 'unidade',
  quantidade    numeric(10,2) not null default 0,
  alerta_minimo numeric(10,2) not null default 0,
  custo         numeric(10,2),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id            bigint generated always as identity primary key,
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  tipo          text not null check (tipo in ('entrada','saida','ajuste','venda')),
  quantidade    numeric(10,2) not null,
  motivo        text,
  user_id       uuid,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_stock_mov_item
  on public.stock_movements (stock_item_id, criado_em desc);

alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;

-- Leitura: equipa autenticada. Escrita: só admin.
drop policy if exists "stock_items leitura equipa" on public.stock_items;
create policy "stock_items leitura equipa" on public.stock_items
  for select to authenticated using (true);
drop policy if exists "stock_items escrita admin" on public.stock_items;
create policy "stock_items escrita admin" on public.stock_items
  for all to authenticated using (public.e_admin()) with check (public.e_admin());

drop policy if exists "stock_mov leitura equipa" on public.stock_movements;
create policy "stock_mov leitura equipa" on public.stock_movements
  for select to authenticated using (true);
drop policy if exists "stock_mov escrita admin" on public.stock_movements;
create policy "stock_mov escrita admin" on public.stock_movements
  for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- Movimento atómico: atualiza o saldo do item E regista o movimento, numa só
-- transação. entrada = +q; saida/venda = −q; ajuste = define o saldo em q.
create or replace function public.aplicar_movimento_stock(
  p_item       uuid,
  p_tipo       text,
  p_quantidade numeric,
  p_motivo     text default null
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_novo numeric(10,2);
begin
  if not public.e_admin() then
    raise exception 'Ação reservada a admin' using errcode = '42501';
  end if;
  if p_tipo not in ('entrada','saida','ajuste','venda') then
    raise exception 'Tipo de movimento inválido' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;

  update public.stock_items
     set quantidade = case
           when p_tipo = 'entrada'            then quantidade + p_quantidade
           when p_tipo in ('saida','venda')   then quantidade - p_quantidade
           when p_tipo = 'ajuste'             then p_quantidade
         end,
         atualizado_em = now()
   where id = p_item
  returning quantidade into v_novo;

  if v_novo is null then
    raise exception 'Item de stock inexistente' using errcode = '22023';
  end if;

  insert into public.stock_movements (stock_item_id, tipo, quantidade, motivo, user_id)
  values (p_item, p_tipo, p_quantidade, p_motivo, auth.uid());

  return v_novo;
end;
$$;
revoke all on function public.aplicar_movimento_stock(uuid, text, numeric, text) from public;
grant execute on function public.aplicar_movimento_stock(uuid, text, numeric, text) to authenticated;

commit;
