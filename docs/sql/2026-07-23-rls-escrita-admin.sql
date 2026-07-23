-- Endurecer a escrita nas tabelas de gestão da ementa (jul 2026).
--
-- PROBLEMA: as tabelas de gestão (categories, products, combos, combo_items,
-- product_variants, definicoes) tinham a política de escrita
--   for all to authenticated using (true) with check (true)
-- ou seja, QUALQUER conta autenticada — mesmo staff — podia inserir, alterar
-- ou APAGAR toda a ementa via API PostgREST. A distinção admin/staff só existia
-- no React (guarda de interface, não de segurança).
--
-- CORREÇÃO: a leitura mantém-se pública (o site precisa dela); a escrita passa
-- a exigir conta admin ativa, ao nível da base de dados. Não afeta os painéis
-- Staff/Operacional — esses só escrevem em `orders`/`order_items`, não na ementa.
--
-- Aplicar no SQL Editor do Supabase. Idempotente. Reversão no ficheiro
-- 2026-07-23-rls-escrita-admin-REVERSAO.sql.
--
-- NOTA: escrito de forma defensiva (remove as políticas de escrita atuais seja
-- qual for o nome) porque a política da tabela `products` foi criada no
-- dashboard e não tem nome versionado. Rever antes de aplicar.

begin;

-- ── Helper: e_admin() — true se a conta autenticada é admin e está ativa ──
-- security definer + search_path fixo: lê `perfis` sem depender do RLS da
-- própria tabela (evita recursão de políticas).
create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.papel = 'admin' and p.ativo
  );
$$;
revoke all on function public.e_admin() from public;
grant execute on function public.e_admin() to authenticated;

-- ── Por cada tabela de gestão: leitura pública + escrita só-admin ──
-- Remove TODAS as políticas existentes na tabela (apanha nomes desconhecidos,
-- ex.: a de `products` criada no dashboard) e recria o par correto.
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
    -- garante RLS ligado
    execute format('alter table public.%I enable row level security;', t);

    -- remove todas as políticas atuais desta tabela
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I;', p.policyname, t);
    end loop;

    -- leitura pública (mantém o cardápio a funcionar para clientes anónimos)
    execute format(
      'create policy %I on public.%I for select using (true);',
      t || ' leitura publica', t
    );

    -- escrita reservada a admin ativo (insert/update/delete)
    execute format(
      'create policy %I on public.%I for all to authenticated ' ||
      'using (public.e_admin()) with check (public.e_admin());',
      t || ' escrita admin', t
    );
  end loop;
end $$;

-- ── Imagens de produto (bucket storage 'produtos'): mesma lógica ──
-- Leitura pública mantém-se; upload/alteração/remoção passam a exigir admin.
drop policy if exists "produtos upload equipa" on storage.objects;
create policy "produtos upload admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and public.e_admin());

drop policy if exists "produtos gestao equipa" on storage.objects;
create policy "produtos gestao admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and public.e_admin());

drop policy if exists "produtos remocao equipa" on storage.objects;
create policy "produtos remocao admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and public.e_admin());

commit;
