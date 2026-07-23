-- =============================================================================
-- REVERSÃO de 2026-07-23-rls-escrita-admin.sql
-- Repõe escrita de ementa e storage para qualquer conta e_equipa().
-- Só usar se a restrição a admin partir algum fluxo imprevisto.
-- =============================================================================

drop policy "produtos cria admin" on public.products;
drop policy "produtos edita admin" on public.products;
create policy "produtos cria equipa" on public.products for insert to authenticated with check ((select e_equipa()));
create policy "produtos edita equipa" on public.products for update to authenticated using ((select e_equipa())) with check ((select e_equipa()));

drop policy "categorias cria admin" on public.categories;
drop policy "categorias edita admin" on public.categories;
create policy "categorias cria equipa" on public.categories for insert to authenticated with check ((select e_equipa()));
create policy "categorias edita equipa" on public.categories for update to authenticated using ((select e_equipa())) with check ((select e_equipa()));

drop policy "combos cria admin" on public.combos;
drop policy "combos edita admin" on public.combos;
create policy "combos cria equipa" on public.combos for insert to authenticated with check ((select e_equipa()));
create policy "combos edita equipa" on public.combos for update to authenticated using ((select e_equipa())) with check ((select e_equipa()));

drop policy "combo_items cria admin" on public.combo_items;
drop policy "combo_items edita admin" on public.combo_items;
drop policy "combo_items apaga admin" on public.combo_items;
create policy "combo_items cria equipa" on public.combo_items for insert to authenticated with check ((select e_equipa()));
create policy "combo_items edita equipa" on public.combo_items for update to authenticated using ((select e_equipa())) with check ((select e_equipa()));
create policy "combo_items apaga equipa" on public.combo_items for delete to authenticated using ((select e_equipa()));

drop policy "variantes cria admin" on public.product_variants;
drop policy "variantes edita admin" on public.product_variants;
create policy "variantes cria equipa" on public.product_variants for insert to authenticated with check ((select e_equipa()));
create policy "variantes edita equipa" on public.product_variants for update to authenticated using ((select e_equipa())) with check ((select e_equipa()));

drop policy "produtos upload admin" on storage.objects;
drop policy "produtos gestao admin" on storage.objects;
drop policy "produtos remocao admin" on storage.objects;
create policy "produtos upload equipa" on storage.objects for insert to authenticated with check (bucket_id = 'produtos');
create policy "produtos gestao equipa" on storage.objects for update to authenticated using (bucket_id = 'produtos');
create policy "produtos remocao equipa" on storage.objects for delete to authenticated using (bucket_id = 'produtos');
