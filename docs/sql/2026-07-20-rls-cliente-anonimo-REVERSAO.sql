-- =====================================================================
-- REVERSÃO de 2026-07-20-rls-cliente-anonimo.sql
--
-- Repõe o estado anterior à migração. Usar apenas se a aplicação partir
-- e não houver tempo para diagnosticar durante o serviço.
--
-- ⚠️ AVISO: reverter reabre a exposição de dados pessoais (nome, NIF,
-- valores) e devolve ao browser o controlo do preço. É um recuo
-- temporário, nunca um estado final. Se for preciso usar isto, o
-- cardápio deve ser desligado até haver correcção.
--
-- Requer reverter TAMBÉM o frontend (git revert do commit do patch),
-- ou o cardápio continua a chamar funções que deixaram de existir.
-- =====================================================================

begin;

-- 1. Remover as políticas de leitura da equipa introduzidas pela migração
drop policy if exists "equipa le sessoes" on public.sessions;
drop policy if exists "equipa le pedidos" on public.orders;
drop policy if exists "equipa le itens"   on public.order_items;

-- 2. Repor as políticas anónimas originais
--    (reprodução exacta do estado observado em 2026-07-20)

create policy "anon le" on public.sessions
  for select to public using (true);
create policy "anon insere" on public.sessions
  for insert to public with check (true);

create policy "anon le" on public.orders
  for select to public using (true);
create policy "anon insere" on public.orders
  for insert to public with check (true);

create policy "anon le" on public.order_items
  for select to public using (true);
create policy "anon insere" on public.order_items
  for insert to public with check (true);

-- 3. Remover as funções
drop function if exists public.criar_pedido(uuid, text, jsonb);
drop function if exists public.criar_sessao(text, text);

commit;

-- ---------------------------------------------------------------------
-- VERIFICAÇÃO
--
--   select tablename, policyname, cmd, roles::text
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('sessions','orders','order_items')
--   order by tablename, cmd;
--
-- Deve mostrar de novo `anon le` e `anon insere` com roles={public}.
-- ---------------------------------------------------------------------
