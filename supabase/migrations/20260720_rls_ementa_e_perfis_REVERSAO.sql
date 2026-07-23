-- REVERSÃO de 20260720_rls_ementa_e_perfis.sql
-- Repõe exactamente o estado anterior a 2026-07-20.
--
-- ATENÇÃO: esta reversão reintroduz o buraco de segurança original
-- (qualquer conta autenticada apaga a ementa; pin_hash exposto).
-- Usar apenas se a migração partir a operação e for preciso repor
-- serviço de imediato. Avisar a Bea Salgado se for executada.

begin;

-- 1. Ementa — repor políticas originais
drop policy if exists "categorias cria equipa"   on public.categories;
drop policy if exists "categorias edita equipa"  on public.categories;
drop policy if exists "categorias apaga admin"   on public.categories;
create policy "categorias escrita equipa" on public.categories
  for all to authenticated using (true) with check (true);
create policy "staff cria categorias"  on public.categories
  for insert to authenticated with check (true);
create policy "staff edita categorias" on public.categories
  for update to authenticated using (true) with check (true);
create policy "staff apaga categorias" on public.categories
  for delete to authenticated using (true);

drop policy if exists "produtos cria equipa"  on public.products;
drop policy if exists "produtos edita equipa" on public.products;
drop policy if exists "produtos apaga admin"  on public.products;
create policy "staff cria produtos"  on public.products
  for insert to authenticated with check (true);
create policy "staff edita produtos" on public.products
  for update to authenticated using (true) with check (true);
create policy "staff apaga produtos" on public.products
  for delete to authenticated using (true);

drop policy if exists "combos cria equipa"  on public.combos;
drop policy if exists "combos edita equipa" on public.combos;
drop policy if exists "combos apaga admin"  on public.combos;
create policy "combos escrita equipa" on public.combos
  for all to authenticated using (true) with check (true);

drop policy if exists "combo_items cria equipa"  on public.combo_items;
drop policy if exists "combo_items edita equipa" on public.combo_items;
drop policy if exists "combo_items apaga equipa" on public.combo_items;
create policy "combo_items escrita equipa" on public.combo_items
  for all to authenticated using (true) with check (true);

drop policy if exists "variantes cria equipa"  on public.product_variants;
drop policy if exists "variantes edita equipa" on public.product_variants;
drop policy if exists "variantes apaga admin"  on public.product_variants;
create policy "variantes escrita equipa" on public.product_variants
  for all to authenticated using (true) with check (true);

drop policy if exists "definicoes cria admin"  on public.definicoes;
drop policy if exists "definicoes edita admin" on public.definicoes;
drop policy if exists "definicoes apaga admin" on public.definicoes;
create policy "definicoes escrita equipa" on public.definicoes
  for all to authenticated using (true) with check (true);

-- 2. Pedidos
drop policy if exists "pedidos atualiza equipa" on public.orders;
create policy "staff atualiza pedidos" on public.orders
  for update to authenticated using (true) with check (true);

drop policy if exists "itens atualiza equipa" on public.order_items;
create policy "staff atualiza itens" on public.order_items
  for update to authenticated using (true) with check (true);

-- 3. perfis — nada a reverter (secção adiada, não foi aplicada)

-- 4. audit_log
drop policy if exists "audit escreve equipa" on public.audit_log;
create policy "audit escrita autenticada" on public.audit_log
  for insert to authenticated with check (true);

-- 5. Funções auxiliares
drop function if exists public.e_admin();
drop function if exists public.e_equipa();

commit;
