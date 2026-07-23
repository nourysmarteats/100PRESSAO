-- =============================================================================
-- 2026-07-23 — Escrita na ementa e no storage passa a ser só de admin
-- Autor: Daniel Cunha (TI). Aplicado em produção como migração
-- `rls_escrita_ementa_so_admin` via MCP.
--
-- Contexto: as políticas de 2026-07-20 separaram equipa/admin, mas deixaram
-- INSERT/UPDATE da ementa (e todo o CRUD do bucket `produtos`) abertos a
-- qualquer conta `e_equipa()`. Nenhuma página de staff escreve nestas tabelas
-- (verificado: só src/pages/equipa/admin/* o faz), portanto restringir a
-- admin não altera nenhum fluxo existente.
--
-- Motivo de fazer isto AGORA: ainda só existem contas admin. Assim que
-- existirem contas staff para a equipa de sala, esta janela fecha-se.
--
-- Reversão: 2026-07-23-rls-escrita-admin-REVERSAO.sql
-- =============================================================================

-- ---------- products ----------
drop policy "produtos cria equipa" on public.products;
drop policy "produtos edita equipa" on public.products;

create policy "produtos cria admin"
  on public.products for insert to authenticated
  with check ((select e_admin()));

create policy "produtos edita admin"
  on public.products for update to authenticated
  using ((select e_admin())) with check ((select e_admin()));

-- ---------- categories ----------
drop policy "categorias cria equipa" on public.categories;
drop policy "categorias edita equipa" on public.categories;

create policy "categorias cria admin"
  on public.categories for insert to authenticated
  with check ((select e_admin()));

create policy "categorias edita admin"
  on public.categories for update to authenticated
  using ((select e_admin())) with check ((select e_admin()));

-- ---------- combos ----------
drop policy "combos cria equipa" on public.combos;
drop policy "combos edita equipa" on public.combos;

create policy "combos cria admin"
  on public.combos for insert to authenticated
  with check ((select e_admin()));

create policy "combos edita admin"
  on public.combos for update to authenticated
  using ((select e_admin())) with check ((select e_admin()));

-- ---------- combo_items (o DELETE era de equipa; passa também a admin) ----------
drop policy "combo_items cria equipa" on public.combo_items;
drop policy "combo_items edita equipa" on public.combo_items;
drop policy "combo_items apaga equipa" on public.combo_items;

create policy "combo_items cria admin"
  on public.combo_items for insert to authenticated
  with check ((select e_admin()));

create policy "combo_items edita admin"
  on public.combo_items for update to authenticated
  using ((select e_admin())) with check ((select e_admin()));

create policy "combo_items apaga admin"
  on public.combo_items for delete to authenticated
  using ((select e_admin()));

-- ---------- product_variants ----------
drop policy "variantes cria equipa" on public.product_variants;
drop policy "variantes edita equipa" on public.product_variants;

create policy "variantes cria admin"
  on public.product_variants for insert to authenticated
  with check ((select e_admin()));

create policy "variantes edita admin"
  on public.product_variants for update to authenticated
  using ((select e_admin())) with check ((select e_admin()));

-- ---------- storage: bucket produtos ----------
-- As políticas antigas só validavam o bucket — qualquer autenticado podia
-- fazer upload/substituir/apagar imagens. Passa a exigir admin.
drop policy "produtos upload equipa" on storage.objects;
drop policy "produtos gestao equipa" on storage.objects;
drop policy "produtos remocao equipa" on storage.objects;

create policy "produtos upload admin"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and (select e_admin()));

create policy "produtos gestao admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and (select e_admin()));

create policy "produtos remocao admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (select e_admin()));
