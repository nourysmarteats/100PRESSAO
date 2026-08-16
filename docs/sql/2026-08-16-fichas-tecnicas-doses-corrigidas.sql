-- ═══════════════════════════════════════════════════════════════════════════
-- Correcção das fichas técnicas: alinhar stock_receitas com as doses reais
-- da ementa v2.
--
-- Rita Falcão, Chef Executiva · 16/08/2026
--
-- PROBLEMA
-- O seed 2026-07-28-seed-fichas-tecnicas.sql ficou com quantidades que não
-- batem com as doses servidas. Consequência: o stock desconta a menos em cada
-- venda, o inventário nunca fecha, e o food cost calculado pelo sistema é
-- ficção. A Coxinha é o caso extremo — desconta 1 unidade quando saem 5.
--
--   Prato                    ficha actual   dose servida (v2)
--   Coxinha de Frango              1 un          5 un
--   Rissóis de Gambas              3 un          5 un   (dose reduzida de 6 → 5)
--   Pastéis de Bacalhau            2 un          6 un
--   Pastéis de Vento               4 un          6 un   (dose reduzida de 9 → 6)
--   Bolinhas de Feijoada           6 un          5 un   (dose reduzida de 8 → 5)
--   Bolinhas de Mandioca           6 un          5 un   (dose reduzida de 8 → 5)
--
-- NÃO APLICAR sem confirmar antes a folha "Divergências BD" da ementa v2:
-- os preços em products também não batem com a ementa, e faz pouco sentido
-- corrigir o stock enquanto os preços estiverem errados.
--
-- Idempotente. Reversão no fim do ficheiro.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1) Alinhar as quantidades das fichas técnicas ──────────────────────────
update public.stock_receitas r
set    quantidade = v.qtd
from  (values
        ('Coxinha de Frango',                        'Coxinha de frango',   5),
        ('Rissóis de Gambas',                        'Rissol de gambas',    5),
        ('Pastéis de Bacalhau',                      'Pastel de bacalhau',  6),
        ('Pastéis de Vento (Sortidos)',              'Pastel de vento',     6),
        ('Bolinhas de Feijoada',                     'Bolinha de feijoada', 5),
        ('Bolinhas de Mandioca com Carne e Queijo',  'Bolinha de mandioca', 5)
      ) as v(produto, ingrediente, qtd)
join   public.products    p on p.nome = v.produto
join   public.stock_items s on s.nome = v.ingrediente
where  r.product_id    = p.id
  and  r.stock_item_id = s.id
  and  r.quantidade   is distinct from v.qtd::numeric;

-- ── 2) Conferência: mostra as fichas dos petiscos depois da correcção ──────
select p.nome as prato, s.nome as ingrediente, r.quantidade, s.custo,
       round(r.quantidade * s.custo, 2) as custo_dose,
       p.preco as pvp,
       round(r.quantidade * s.custo / nullif(p.preco,0) * 100, 1) as food_cost_pct
from   public.stock_receitas r
join   public.products    p on p.id = r.product_id
join   public.stock_items s on s.id = r.stock_item_id
where  s.categoria = 'Semi-prontos'
order  by p.nome;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- REVERSÃO (repõe as quantidades do seed original de 28/07/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- begin;
-- update public.stock_receitas r
-- set    quantidade = v.qtd
-- from  (values
--         ('Coxinha de Frango',                       'Coxinha de frango',   1),
--         ('Rissóis de Gambas',                       'Rissol de gambas',    3),
--         ('Pastéis de Bacalhau',                     'Pastel de bacalhau',  2),
--         ('Pastéis de Vento (Sortidos)',             'Pastel de vento',     4),
--         ('Bolinhas de Feijoada',                    'Bolinha de feijoada', 6),
--         ('Bolinhas de Mandioca com Carne e Queijo', 'Bolinha de mandioca', 6)
--       ) as v(produto, ingrediente, qtd)
-- join   public.products    p on p.nome = v.produto
-- join   public.stock_items s on s.nome = v.ingrediente
-- where  r.product_id = p.id and r.stock_item_id = s.id;
-- commit;
