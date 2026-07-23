-- 100PRESSÃO — Correcção de RLS: ementa, perfis e audit_log
-- Autor: Daniel Cunha (Direcção de TI)  |  Validação: Bea Salgado (Segurança)
-- Data: 2026-07-20
--
-- PROBLEMA
--   1. Tabelas da ementa (categories, products, combos, combo_items,
--      product_variants, definicoes) tinham políticas com USING (true) /
--      WITH CHECK (true) para authenticated. Qualquer conta da equipa
--      podia apagar a ementa inteira.
--   2. orders/order_items aceitavam UPDATE de qualquer autenticado.
--   3. audit_log aceitava INSERT sem qualquer verificação.
--   4. public.perfis expõe pin_hash — ADIADO, ver secção 5.
--
-- PRINCÍPIO APLICADO
--   Leitura da ementa: pública (necessário para o menu QR).
--   Criar/editar ementa: equipa activa (staff + admin).
--   APAGAR ementa: apenas admin activo (excepto combo_items, ver secção 3).
--   Definições (horário/avisos): apenas admin.

begin;

-- ---------------------------------------------------------------------------
-- 1. Funções auxiliares (SECURITY DEFINER para evitar recursão de RLS
--    ao consultar perfis dentro de políticas sobre perfis)
-- ---------------------------------------------------------------------------

create or replace function public.e_equipa()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo
  );
$$;

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.papel = 'admin'
  );
$$;

revoke execute on function public.e_equipa() from anon;
revoke execute on function public.e_admin() from anon;

-- ---------------------------------------------------------------------------
-- 2. Ementa — remover políticas permissivas
-- ---------------------------------------------------------------------------

drop policy if exists "categorias escrita equipa"    on public.categories;
drop policy if exists "staff cria categorias"        on public.categories;
drop policy if exists "staff edita categorias"       on public.categories;
drop policy if exists "staff apaga categorias"       on public.categories;

drop policy if exists "staff cria produtos"          on public.products;
drop policy if exists "staff edita produtos"         on public.products;
drop policy if exists "staff apaga produtos"         on public.products;

drop policy if exists "combos escrita equipa"        on public.combos;
drop policy if exists "combo_items escrita equipa"   on public.combo_items;
drop policy if exists "variantes escrita equipa"     on public.product_variants;
drop policy if exists "definicoes escrita equipa"    on public.definicoes;

-- ---------------------------------------------------------------------------
-- 3. Ementa — políticas novas (escrita = equipa, apagar = admin)
-- ---------------------------------------------------------------------------

-- categories
create policy "categorias cria equipa"  on public.categories
  for insert to authenticated with check (public.e_equipa());
create policy "categorias edita equipa" on public.categories
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());
create policy "categorias apaga admin"  on public.categories
  for delete to authenticated using (public.e_admin());

-- products
create policy "produtos cria equipa"    on public.products
  for insert to authenticated with check (public.e_equipa());
create policy "produtos edita equipa"   on public.products
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());
create policy "produtos apaga admin"    on public.products
  for delete to authenticated using (public.e_admin());

-- combos
create policy "combos cria equipa"      on public.combos
  for insert to authenticated with check (public.e_equipa());
create policy "combos edita equipa"     on public.combos
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());
create policy "combos apaga admin"      on public.combos
  for delete to authenticated using (public.e_admin());

-- combo_items
create policy "combo_items cria equipa"  on public.combo_items
  for insert to authenticated with check (public.e_equipa());
create policy "combo_items edita equipa" on public.combo_items
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());
-- NOTA: combo_items é tabela-filha reescrita a cada gravação de combo
-- (Combos.jsx:117 faz delete+insert no fluxo normal de edição). O DELETE
-- fica ao nível da equipa, senão editar um combo falha em silêncio e
-- duplica itens. A protecção que interessa está na tabela `combos`.
create policy "combo_items apaga equipa" on public.combo_items
  for delete to authenticated using (public.e_equipa());

-- product_variants
create policy "variantes cria equipa"   on public.product_variants
  for insert to authenticated with check (public.e_equipa());
create policy "variantes edita equipa"  on public.product_variants
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());
create policy "variantes apaga admin"   on public.product_variants
  for delete to authenticated using (public.e_admin());

-- definicoes (horário, avisos, métodos de pagamento — só admin escreve)
create policy "definicoes edita admin"  on public.definicoes
  for update to authenticated using (public.e_admin()) with check (public.e_admin());
create policy "definicoes cria admin"   on public.definicoes
  for insert to authenticated with check (public.e_admin());
create policy "definicoes apaga admin"  on public.definicoes
  for delete to authenticated using (public.e_admin());

-- ---------------------------------------------------------------------------
-- 4. Pedidos — restringir UPDATE a equipa activa (estava USING (true))
-- ---------------------------------------------------------------------------

drop policy if exists "staff atualiza pedidos" on public.orders;
create policy "pedidos atualiza equipa" on public.orders
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());

drop policy if exists "staff atualiza itens" on public.order_items;
create policy "itens atualiza equipa" on public.order_items
  for update to authenticated using (public.e_equipa()) with check (public.e_equipa());

-- ---------------------------------------------------------------------------
-- 5. perfis — ADIADO (NÃO APLICAR AINDA)
-- ---------------------------------------------------------------------------
-- A política `perfis leitura autenticada` (USING true) expõe o pin_hash de
-- todas as contas a qualquer utilizador autenticado. NÃO pode ser fechada
-- nesta migração porque o PinGate em src/pages/equipa/EquipaLayout.jsx
-- descarrega os pin_hash de todos os perfis activos e compara-os no browser
-- (linhas ~124-136). Fechar a leitura tranca a equipa fora do balcão.
--
-- CORRECÇÃO CORRECTA (requer alteração de código, janela própria):
--   1. Criar RPC public.verificar_pin(p_pin text) SECURITY DEFINER que
--      devolve apenas {id, nome, papel} ou nulo — o hash nunca sai da BD.
--   2. Alterar o PinGate para chamar a RPC em vez de comparar no cliente.
--   3. Só então aplicar:
--        drop policy "perfis leitura autenticada" on public.perfis;
--        create policy "perfis le proprio ou admin" on public.perfis
--          for select to authenticated using (id = auth.uid() or public.e_admin());
--        revoke select (pin_hash) on public.perfis from authenticated, anon;
--
-- RISCO ENTRETANTO: PIN de 4 dígitos com hash exposto ao cliente = 10 000
-- combinações verificáveis offline. Qualquer conta da equipa consegue o PIN
-- de admin. Tratar com prioridade. — DC, 2026-07-20

-- ---------------------------------------------------------------------------
-- 6. audit_log — só equipa activa escreve
-- ---------------------------------------------------------------------------

drop policy if exists "audit escrita autenticada" on public.audit_log;
create policy "audit escreve equipa" on public.audit_log
  for insert to authenticated with check (public.e_equipa());

-- ---------------------------------------------------------------------------
-- 7. touch_atualizado_em — fixar search_path (aviso do linter)
-- ---------------------------------------------------------------------------

alter function public.touch_atualizado_em() set search_path to 'public', 'pg_temp';

commit;
