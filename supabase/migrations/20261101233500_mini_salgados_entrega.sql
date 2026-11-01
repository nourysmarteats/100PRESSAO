-- Mini Salgados passam a ir para entrega em todos os canais (Leandro, 2026-11-01).
-- Substitui a regra "só recolha" de 20260927140000_so_recolha_mini_salgados.sql:
-- com a fritadeira no ponto de recolha (29 Set) deixam de chegar moles.
-- Entram também na Uber Eats, Glovo e Bolt Food a 7,90 € (10 un.) e 14,90 € (20 un.).

update public.products
   set so_recolha = false
 where id = 'dabe9d28-498c-4150-9a38-fc321ec4c420';

-- Variante duplicada "20 unidades" (sem preço de plataforma, sem vendas) ao lado
-- de "20 unidades para partilhar": desliga-se em vez de apagar.
update public.product_variants
   set disponivel = false
 where id = 'f523c984-c5a1-4c85-9a9a-620545a335ea'
   and nome = '20 unidades';
