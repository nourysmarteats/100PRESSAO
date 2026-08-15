-- 2026-08-15 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Rotação por dia da semana — Almoço PF.
--
-- PORQUÊ
-- O PF tem cinco pratos a rodar de segunda a sexta, dois por dia (ver
-- docs/ementas/PF-rotacao-semanal.md, Rita Falcão, 12/08/2026). O único
-- controlo existente era o interruptor `disponivel`, que alguém teria de mexer
-- cinco vezes todas as manhãs.
--
-- O custo de esquecer não é simétrico. Um prato que fica ligado num dia em que
-- não se cozinha faz um cliente encomendar — e pagar — um Bife Acebolado numa
-- terça-feira. Ao balcão corrige-se com uma frase; online já foi cobrado, e há
-- uma devolução e um cliente perdido. Automatizar isto vale mais do que
-- documentar a rotina matinal.
--
-- NULL ou vazio = servido todos os dias. É o que mantém a ementa inteira a
-- funcionar sem tocar em nada: só os pratos que rodam levam dias marcados.

alter table public.product_variants add column if not exists dias_semana int[];
alter table public.products        add column if not exists dias_semana int[];

-- 1 = segunda … 7 = domingo (ISO-8601, igual ao isodow do Postgres e ao que
-- src/lib/dias.js usa no browser).
comment on column public.product_variants.dias_semana is
  'Dias em que é servido (1=segunda … 7=domingo). NULL/vazio = todos os dias.';
comment on column public.products.dias_semana is
  'Dias em que é servido (1=segunda … 7=domingo). NULL/vazio = todos os dias.';

-- Fuso explícito. O servidor está em UTC e, na madrugada portuguesa, a data UTC
-- já é a do dia seguinte: às 23h30 de domingo em Lisboa (00h30 UTC de segunda),
-- sem isto, a ementa de segunda entrava em vigor uma hora e meia mais cedo.
create or replace function public.servido_hoje(p_dias int[])
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_dias is null
      or cardinality(p_dias) = 0
      or extract(isodow from (now() at time zone 'Europe/Lisbon'))::int = any (p_dias);
$$;

-- Validação dos dias. Um 0 ou um 8 escrito por engano deixaria o prato
-- invisível para sempre, sem erro visível em lado nenhum. Vive numa função
-- porque o Postgres não aceita subconsultas dentro de um CHECK.
create or replace function public.dias_semana_validos(p_dias int[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_dias is null
      or (cardinality(p_dias) between 1 and 7
          and (select bool_and(d between 1 and 7) from unnest(p_dias) d));
$$;

alter table public.product_variants drop constraint if exists variantes_dias_validos;
alter table public.product_variants add constraint variantes_dias_validos
  check (public.dias_semana_validos(dias_semana));

alter table public.products drop constraint if exists produtos_dias_validos;
alter table public.products add constraint produtos_dias_validos
  check (public.dias_semana_validos(dias_semana));

-- Rotação inicial, da grelha da Rita:
update public.product_variants v set dias_semana = x.dias
from (values
  ('Bife Acebolado',       array[1,4]),
  ('Frango Grelhado',      array[1,3]),
  ('Porco à Moda do Chef', array[2,4]),
  ('Bacalhau à Brás',      array[2,5])
) as x(nome, dias)
where v.nome = x.nome
  and v.product_id in (select id from public.products where nome = 'Almoço PF');

-- ─────────────────────────────────────────────────────────────────────────
-- VALIDAÇÃO NO SERVIDOR (migração seguinte, mesma data)
-- ─────────────────────────────────────────────────────────────────────────
-- criar_pedido e criar_pedido_online passaram a exigir servido_hoje() além do
-- `disponivel`, por alteração cirúrgica (ler a definição, substituir só o
-- pedaço conhecido, abortar se o padrão não aparecer o número esperado de
-- vezes).
--
-- Sem isso o filtro vivia só no browser, e um separador aberto desde ontem
-- encomendava o prato de ontem. O filtro no cliente serve para o cliente não
-- ver o que não pode pedir; o do servidor serve para não poder pedir.

-- ─────────────────────────────────────────────────────────────────────────
-- ESTADO CONHECIDO AO APLICAR
-- ─────────────────────────────────────────────────────────────────────────
--   Seg: Bife Acebolado · Frango Grelhado
--   Ter: Porco à Moda do Chef · Bacalhau à Brás
--   Qua: Frango Grelhado                      ← falta a Carne de Sol
--   Qui: Bife Acebolado · Porco à Moda do Chef
--   Sex: Bacalhau à Brás                      ← falta a Carne de Sol
--   Sáb/Dom: sem PF (o Bitoque não tem dias marcados, logo serve-se sempre)
--
-- Por cadastrar: Carne de Sol com Mandioca (qua+sex) e Peixe do Dia, cujo preço
-- muda diariamente.

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
--   Reverter as RPCs implica remover as chamadas a servido_hoje() da definição
--   de cada uma; depois:
--     alter table public.product_variants drop constraint variantes_dias_validos;
--     alter table public.products drop constraint produtos_dias_validos;
--     alter table public.product_variants drop column dias_semana;
--     alter table public.products drop column dias_semana;
--     drop function public.servido_hoje(int[]);
--     drop function public.dias_semana_validos(int[]);
