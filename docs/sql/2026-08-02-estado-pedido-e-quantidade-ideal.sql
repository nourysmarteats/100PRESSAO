-- 2026-08-02 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
-- Guardado aqui para o histórico ficar completo, como as restantes migrações.
--
-- Duas alterações, ambas aditivas: nada é apagado, nenhuma política existente
-- é alterada, nenhuma linha é tocada.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. estado_pedido() — desbloqueia o acompanhamento do pedido pelo cliente
-- ─────────────────────────────────────────────────────────────────────────
-- O ecrã do /cardapio mostrava sempre "Recebido", mesmo depois de a equipa
-- passar o pedido a "Em preparação" ou "Entregue".
--
-- Causa: o Cardapio.jsx subscrevia Realtime a public.orders, mas o Realtime do
-- Supabase aplica RLS. Desde a correção da exposição de dados (2026-07-20) a
-- leitura de orders exige conta de equipa, pelo que o cliente anónimo deixou
-- de receber os eventos de UPDATE. A subscrição estava correta; simplesmente
-- nunca disparava.
--
-- Reabrir a leitura de orders ao anónimo recriaria exatamente a exposição que
-- foi corrigida (nome, NIF, morada, totais de todos os clientes). Em vez disso,
-- esta função devolve APENAS o estado, e só do pedido cujo UUID o cliente já
-- possui — não é enumerável e não expõe dados pessoais.
create or replace function public.estado_pedido(p_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select estado from public.orders where id = p_id;
$$;

revoke all on function public.estado_pedido(uuid) from public;
grant execute on function public.estado_pedido(uuid) to anon, authenticated;

comment on function public.estado_pedido(uuid) is
  'Estado de um pedido, para o ecrã de acompanhamento do cliente. Só o estado; o UUID do pedido serve de credencial.';

-- Verificação (o que se confirmou ao aplicar):
--   set local role anon;
--   select public.estado_pedido('<uuid de um pedido>');  -- devolve o estado
--   select count(*) from public.orders;                  -- devolve 0

-- ─────────────────────────────────────────────────────────────────────────
-- 2. stock_items.quantidade_ideal — alvo da lista de compras
-- ─────────────────────────────────────────────────────────────────────────
-- Quanto se quer ter em casa DEPOIS de repor. A lista de compras dos
-- Relatórios calcula: comprar = quantidade_ideal − quantidade.
-- Enquanto estiver nula, a lista usa o dobro do alerta_minimo como alvo
-- sugerido, para ser útil antes de os 28 itens estarem preenchidos.
alter table public.stock_items
  add column if not exists quantidade_ideal numeric;

comment on column public.stock_items.quantidade_ideal is
  'Alvo de reposição: quanto se quer ter em casa depois de comprar. Nulo = usar o dobro do alerta_minimo como sugestão.';

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO (se alguma vez for preciso)
-- ─────────────────────────────────────────────────────────────────────────
-- drop function if exists public.estado_pedido(uuid);
-- alter table public.stock_items drop column if exists quantidade_ideal;
