-- Seed completo: ingredientes + fichas técnicas dos pratos, inferido da ementa.
-- Idempotente (só cria o que falta). Aplicar no SQL Editor. PONTO DE PARTIDA —
-- quantidades e composições inferidas dos nomes; rever no Admin (Stock/Produtos).

-- ── 1) Ingredientes (itens de stock) ──────────────────────────────────────
insert into public.stock_items (nome, categoria, subcategoria, unidade)
select v.nome, v.categoria, v.subcategoria, v.unidade
from (values
  ('Pão de forma','Pães',null,'fatia'),
  ('Broa','Pães',null,'fatia'),
  ('Croissant','Pães',null,'unidade'),
  ('Manteiga','Lacticínios',null,'porção'),
  ('Queijo','Lacticínios',null,'fatia'),
  ('Cheddar','Lacticínios',null,'porção'),
  ('Leite','Lacticínios',null,'litro'),
  ('Fiambre','Charcutaria',null,'fatia'),
  ('Bacon','Charcutaria',null,'porção'),
  ('Calabresa','Charcutaria',null,'porção'),
  ('Café moído','Café & Chá',null,'dose'),
  ('Saqueta de chá','Café & Chá',null,'unidade'),
  ('Ovos','Básicos',null,'unidade'),
  ('Açúcar','Básicos',null,'pacote'),
  ('Laranja','Frutas',null,'unidade'),
  ('Abacaxi','Frutas',null,'porção'),
  ('Polpa manga/maracujá','Frutas',null,'dose'),
  ('Fruta variada','Frutas',null,'porção'),
  ('Batata','Legumes',null,'kg'),
  ('Cebola','Legumes',null,'unidade'),
  ('Moelas estufadas','Semi-prontos',null,'porção'),
  ('Coxinha de frango','Semi-prontos',null,'unidade'),
  ('Rissol de gambas','Semi-prontos',null,'unidade'),
  ('Pastel de bacalhau','Semi-prontos',null,'unidade'),
  ('Pastel de vento','Semi-prontos',null,'unidade'),
  ('Bolinha de feijoada','Semi-prontos',null,'unidade'),
  ('Bolinha de mandioca','Semi-prontos',null,'unidade'),
  ('Pão de queijo','Semi-prontos',null,'unidade')
) as v(nome, categoria, subcategoria, unidade)
where not exists (select 1 from public.stock_items s where s.nome = v.nome);

-- ── 2) Fichas técnicas (produto → ingrediente × quantidade) ────────────────
insert into public.stock_receitas (product_id, stock_item_id, quantidade)
select p.id, s.id, r.qtd::numeric
from (values
  -- Pequeno almoço
  ('Tosta Mista','Pão de forma',2),
  ('Tosta Mista','Manteiga',1),
  ('Tosta Mista','Queijo',1),
  ('Tosta Mista','Fiambre',1),
  ('Tosta Simples','Pão de forma',2),
  ('Tosta Simples','Manteiga',1),
  ('Torrada de Broa','Broa',2),
  ('Torrada de Broa','Manteiga',1),
  ('Croissant Misto','Croissant',1),
  ('Croissant Misto','Queijo',1),
  ('Croissant Misto','Fiambre',1),
  ('Croissant Simples','Croissant',1),
  ('Ovos Mexidos','Ovos',2),
  ('Ovos Mexidos','Manteiga',1),
  ('Pão de Queijo (unidade)','Pão de queijo',1),
  ('Pão de Queijo (trio)','Pão de queijo',3),
  ('Café Expresso','Café moído',1),
  ('Café Machiato','Café moído',1),
  ('Café Machiato','Leite',0.03),
  ('Café Coado (Brasileiro)','Café moído',1),
  ('Americano','Café moído',1),
  ('Cappuccino','Café moído',1),
  ('Cappuccino','Leite',0.1),
  ('Galão','Café moído',1),
  ('Galão','Leite',0.15),
  ('Meia de Leite','Café moído',1),
  ('Meia de Leite','Leite',0.15),
  ('Chá','Saqueta de chá',1),
  ('Sumo de Laranja Natural (200ml)','Laranja',3),
  ('Sumo de Manga/Maracujá Natural','Polpa manga/maracujá',1),
  ('Abacaxi com Hortelã','Abacaxi',1),
  ('Fruta Fresca da Época','Fruta variada',1),
  -- Petiscos (semi-prontos + acompanhamentos)
  ('Coxinha de Frango','Coxinha de frango',1),
  ('Rissóis de Gambas','Rissol de gambas',3),
  ('Pastéis de Bacalhau','Pastel de bacalhau',2),
  ('Pastéis de Vento (Sortidos)','Pastel de vento',4),
  ('Bolinhas de Feijoada','Bolinha de feijoada',6),
  ('Bolinhas de Mandioca com Carne e Queijo','Bolinha de mandioca',6),
  ('Moelas Estufadas','Moelas estufadas',1),
  ('Batatas Fritas com Cheddar e Bacon','Batata',0.25),
  ('Batatas Fritas com Cheddar e Bacon','Cheddar',1),
  ('Batatas Fritas com Cheddar e Bacon','Bacon',1),
  ('Calabresa Acebolada','Calabresa',1),
  ('Calabresa Acebolada','Cebola',1)
) as r(produto, ingrediente, qtd)
join public.products p on p.nome = r.produto
join public.stock_items s on s.nome = r.ingrediente
where not exists (
  select 1 from public.stock_receitas x
  where x.product_id = p.id and x.stock_item_id = s.id
);
