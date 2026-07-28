-- Seed de ingredientes de stock, inferido da ementa (jul 2026).
-- Cria itens de stock com quantidade 0, sem custo (a preencher) e organizados
-- por categoria/subcategoria. É um PONTO DE PARTIDA — rever, apagar o que não
-- se usa, e definir custos/quantidades no Admin → Stock.
-- Idempotente: só insere nomes que ainda não existam. Aplicar no SQL Editor.

insert into public.stock_items (nome, categoria, subcategoria, unidade)
select v.nome, v.categoria, v.subcategoria, v.unidade
from (values
  -- Pães
  ('Pão de forma',        'Pães', null, 'fatia'),
  ('Broa',                'Pães', null, 'fatia'),
  ('Croissant',           'Pães', null, 'unidade'),
  -- Lacticínios
  ('Manteiga',            'Lacticínios', null, 'porção'),
  ('Queijo',              'Lacticínios', null, 'fatia'),
  ('Cheddar',             'Lacticínios', null, 'porção'),
  ('Leite',               'Lacticínios', null, 'litro'),
  -- Charcutaria
  ('Fiambre',             'Charcutaria', null, 'fatia'),
  ('Bacon',               'Charcutaria', null, 'porção'),
  ('Calabresa',           'Charcutaria', null, 'porção'),
  -- Café & Chá
  ('Café moído',          'Café & Chá', null, 'dose'),
  ('Saqueta de chá',      'Café & Chá', null, 'unidade'),
  -- Básicos
  ('Ovos',                'Básicos', null, 'unidade'),
  ('Açúcar',              'Básicos', null, 'pacote'),
  -- Frutas
  ('Laranja',             'Frutas', null, 'unidade'),
  ('Abacaxi',             'Frutas', null, 'porção'),
  ('Polpa manga/maracujá','Frutas', null, 'dose'),
  ('Fruta variada',       'Frutas', null, 'porção'),
  -- Legumes
  ('Batata',              'Legumes', null, 'kg'),
  ('Cebola',              'Legumes', null, 'unidade'),
  -- Semi-prontos (contam-se à porção/unidade; ligam-se 1:1 ao produto)
  ('Moelas estufadas',    'Semi-prontos', null, 'porção'),
  ('Coxinha de frango',   'Semi-prontos', null, 'unidade'),
  ('Rissol de gambas',    'Semi-prontos', null, 'unidade'),
  ('Pastel de bacalhau',  'Semi-prontos', null, 'unidade'),
  ('Pastel de vento',     'Semi-prontos', null, 'unidade'),
  ('Bolinha de feijoada', 'Semi-prontos', null, 'unidade'),
  ('Bolinha de mandioca', 'Semi-prontos', null, 'unidade'),
  ('Pão de queijo',       'Semi-prontos', null, 'unidade')
) as v(nome, categoria, subcategoria, unidade)
where not exists (select 1 from public.stock_items s where s.nome = v.nome);
