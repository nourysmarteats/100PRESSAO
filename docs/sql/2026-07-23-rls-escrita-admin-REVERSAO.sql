-- REVERSÃO de 2026-07-23-rls-escrita-admin.sql
-- Volta a escrita das tabelas de gestão ao estado anterior: leitura pública +
-- escrita para qualquer conta autenticada (using true). Restaura o storage e
-- remove o helper e_admin(). Só usar se a restrição a admin causar problemas.
-- Aplicar no SQL Editor do Supabase. Idempotente.

begin;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'categories', 'products', 'combos', 'combo_items',
    'product_variants', 'definicoes'
  ]
  loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I;', p.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for select using (true);',
      t || ' leitura publica', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated ' ||
      'using (true) with check (true);',
      t || ' escrita equipa', t
    );
  end loop;
end $$;

-- Storage de volta a "equipa" (qualquer autenticado)
drop policy if exists "produtos upload admin" on storage.objects;
create policy "produtos upload equipa" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos');

drop policy if exists "produtos gestao admin" on storage.objects;
create policy "produtos gestao equipa" on storage.objects
  for update to authenticated using (bucket_id = 'produtos');

drop policy if exists "produtos remocao admin" on storage.objects;
create policy "produtos remocao equipa" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos');

commit;

-- fora da transação: remover o helper (só depois de as políticas deixarem de o usar)
drop function if exists public.e_admin();
