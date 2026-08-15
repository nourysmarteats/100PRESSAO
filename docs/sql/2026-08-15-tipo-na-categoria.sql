-- 2026-08-15 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Tipo da categoria — decide que campos aparecem no cadastro de produtos.
--
-- PORQUÊ
-- O formulário de produtos mostrava todos os campos a todos os produtos: um
-- café expresso pedia estilo e teor alcoólico. O Leandro assinalou-o, e os
-- dados mostraram que a divisão não é a que parecia à primeira vista:
--
--   Categoria         Produtos  Estilo  ABV  Origem  Alergénios
--   Cervejas/Imperial     2        2     2      0        1
--   Petiscos             11        0     0     11       11
--   Pequeno Almoço       18        0     0      1        8
--   Entrada               2        0     0      2        0
--
-- Estilo e ABV são mesmo só de cerveja (2 produtos em 37). Mas a origem é de
-- comida — alimenta o sub-filtro português/brasileiro do /cardapio — e os
-- alergénios são dos dois: uma cerveja com trigo tem de os declarar tanto como
-- um petisco. Agrupar tudo como "campos de cerveja" teria escondido dos
-- petiscos dois campos que todos eles usam.
--
-- Fica na categoria, e não numa lista fixa no código, para que criar a
-- categoria "Vinhos" se resolva no painel em vez de exigir um programador.

alter table public.categories
  add column if not exists tipo text not null default 'outro';

-- Restringir aos tipos conhecidos: um valor escrito à mão que não corresponda a
-- nada faria o formulário esconder tudo, sem explicação visível.
alter table public.categories drop constraint if exists categories_tipo_valido;
alter table public.categories
  add constraint categories_tipo_valido
  check (tipo in ('cerveja', 'comida', 'bebida', 'outro'));

comment on column public.categories.tipo is
  'Decide os campos do formulário de produtos: cerveja = estilo + ABV; '
  'comida = origem; alergénios em ambos. Ver src/lib/categorias.js.';

-- Semear a partir do que os produtos já têm, para não obrigar a configurar oito
-- categorias à mão. Tudo editável depois em Admin → Categorias.
update public.categories set tipo = 'cerveja' where nome in ('Cervejas', 'Imperial');
update public.categories set tipo = 'comida'
  where nome in ('Petiscos', 'Almoço PF', 'Entrada', 'Pequeno Almoço');
update public.categories set tipo = 'bebida' where nome in ('Bebidas');
-- 'Ingredientes' é matéria-prima de stock e nem aparece na ementa: fica 'outro'.

-- ─────────────────────────────────────────────────────────────────────────
-- A REGRA QUE TORNA ISTO SEGURO, NO CÓDIGO
-- ─────────────────────────────────────────────────────────────────────────
-- src/lib/categorias.js — mostraCampo(tipo, campo, valor):
--   um campo aparece quando o tipo o prevê OU quando já tem valor.
--
-- A segunda metade não é zelo. Um campo escondido com valor lá dentro
-- continuaria a aparecer ao cliente no /cardapio e no /restaurante, sem ninguém
-- o poder corrigir pelo painel — trocava-se um incómodo por um problema. Assim
-- o formulário limpa-se e nada se perde em silêncio: o campo fora do tipo
-- aparece destacado, com uma nota a convidar a apagá-lo.
--
-- Mudar o tipo de uma categoria não escreve nada nos produtos. Só muda o que o
-- formulário mostra.

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
--   alter table public.categories drop constraint if exists categories_tipo_valido;
--   alter table public.categories drop column if exists tipo;
-- O formulário volta a mostrar todos os campos (mostraCampo cai no default).
