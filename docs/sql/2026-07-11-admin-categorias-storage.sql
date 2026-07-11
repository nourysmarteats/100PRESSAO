-- Migração para os novos recursos do /admin (jul 2026)
-- Aplicar no SQL Editor do Supabase ANTES de usar:
--   · a gestão de categorias (visível/oculta)
--   · o upload de imagens de produtos
-- É idempotente: pode correr mais do que uma vez sem estragar nada.

-- ── 1. Categorias: coluna de visibilidade no cardápio ─────────────────
alter table public.categories
  add column if not exists visivel boolean not null default true;

-- ── 2. Categorias: escrita para a equipa autenticada ──────────────────
-- (o CRUD de produtos já funciona; isto garante o mesmo para categorias)
drop policy if exists "categorias escrita equipa" on public.categories;
create policy "categorias escrita equipa" on public.categories
  for all to authenticated using (true) with check (true);

-- ── 3. Storage: bucket público de imagens de produtos ─────────────────
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists "produtos leitura publica" on storage.objects;
create policy "produtos leitura publica" on storage.objects
  for select using (bucket_id = 'produtos');

drop policy if exists "produtos upload equipa" on storage.objects;
create policy "produtos upload equipa" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos');

drop policy if exists "produtos gestao equipa" on storage.objects;
create policy "produtos gestao equipa" on storage.objects
  for update to authenticated using (bucket_id = 'produtos');

drop policy if exists "produtos remocao equipa" on storage.objects;
create policy "produtos remocao equipa" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos');
