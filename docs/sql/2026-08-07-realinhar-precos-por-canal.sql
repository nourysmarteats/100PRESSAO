-- 2026-08-07 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Realinhar os três canais à regra do Leandro:
--   preco             = in loco, no restaurante — é a BASE
--   preco_online      = base + 10%
--   preco_plataforma  = base + 30%
--
-- ─────────────────────────────────────────────────────────────────────────
-- PORQUÊ
-- ─────────────────────────────────────────────────────────────────────────
-- Nenhuma das duas colunas derivadas seguia a regra:
--
--   preco_plataforma estava a ×1,176 uniforme em quase toda a tabela — uma
--   margem de ~15% aplicada em bloco (÷0,85), não os +30% pretendidos.
--
--   preco_online não seguia regra nenhuma: +11% no Café Expresso, +14% no
--   Bitoque, +300% no Café Coado, +442% no Americano. Nos pratos principais
--   andava perto do pretendido; nas bebidas e petiscos disparava.
--
-- Consequência prática antes desta correção: o canal online chegava a ser mais
-- caro do que as plataformas de entrega (Tosta Mista a 3,30 € no site contra
-- 1,20 € na plataforma), o que inviabilizava qualquer campanha a convidar o
-- cliente a encomendar direto por ser mais barato.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O QUE ISTO NÃO RESOLVE
-- ─────────────────────────────────────────────────────────────────────────
-- Realinha a PROPORÇÃO entre canais; não valida a base. O `preco` continua a
-- parecer custo e não preço de ementa — no piloto, a Heineken tem preco 1,26 €
-- e foi cobrada a 3,50 €; a Tábua da Casa tem 11,00 € e foi cobrada a 17,90 €.
--
-- O Leandro confirmou (2026-08-07) que esta fase é toda simulação, com vendas
-- feitas a si próprio e a conhecidos, e que afina os valores reais pelo painel
-- Admin quando o negócio passar a real. O que fica garantido aqui é que, ao
-- mexer na base, os outros dois canais passam a acompanhar corretamente.
--
-- ─────────────────────────────────────────────────────────────────────────
-- CÓPIA DE SEGURANÇA
-- ─────────────────────────────────────────────────────────────────────────
-- Antes de escrever, os 52 registos (41 produtos, 4 variantes, 7 combos)
-- ficaram em public.precos_backup_20260807, para a reversão poder repor valor
-- a valor em vez de recalcular a partir de uma base entretanto alterada.

create table if not exists public.precos_backup_20260807 (
  tabela            text not null,
  id                uuid not null,
  nome              text,
  preco             numeric,
  preco_online      numeric,
  preco_plataforma  numeric,
  guardado_em       timestamptz not null default now(),
  primary key (tabela, id)
);

insert into public.precos_backup_20260807 (tabela, id, nome, preco, preco_online, preco_plataforma)
select 'products', id, nome, preco, preco_online, preco_plataforma from public.products
union all
select 'product_variants', id, nome, preco, preco_online, preco_plataforma from public.product_variants
union all
select 'combos', id, nome, preco, preco_online, preco_plataforma from public.combos
on conflict (tabela, id) do nothing;

alter table public.precos_backup_20260807 enable row level security;
create policy "backup precos leitura equipa" on public.precos_backup_20260807
  for select to authenticated using ((select e_equipa()));

-- ─────────────────────────────────────────────────────────────────────────
-- REALINHAMENTO
-- ─────────────────────────────────────────────────────────────────────────
-- Só onde há base: preco nulo ou <= 0 fica intocado, para não inventar preços.

update public.products
set preco_online     = round(preco * 1.10, 2),
    preco_plataforma = round(preco * 1.30, 2)
where preco is not null and preco > 0;

update public.product_variants
set preco_online     = round(preco * 1.10, 2),
    preco_plataforma = round(preco * 1.30, 2)
where preco is not null and preco > 0;

update public.combos
set preco_online     = round(preco * 1.10, 2),
    preco_plataforma = round(preco * 1.30, 2)
where preco is not null and preco > 0;

-- Itens de stock vendidos diretamente na ementa só têm venda e venda online.
update public.stock_items
set preco_venda_online = round(preco_venda * 1.10, 2)
where vender_ementa and preco_venda is not null and preco_venda > 0;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FEITA AO APLICAR
-- ─────────────────────────────────────────────────────────────────────────
-- Rácios a 1,10 e 1,30 em todas as linhas. Cinco produtos aparecem fora de uma
-- tolerância de 0,6%, todos com preço abaixo de 0,60 € (Chá 0,16 €, Americano
-- 0,24 €, Meia de Leite, Galão, Tosta Simples): o valor gravado é exatamente o
-- esperado, e o desvio é só o arredondamento aos cêntimos — 0,16 × 1,10 = 0,176,
-- que não cabe em dois decimais.

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
-- update public.products p set preco = b.preco, preco_online = b.preco_online,
--        preco_plataforma = b.preco_plataforma
--   from public.precos_backup_20260807 b
--  where b.tabela = 'products' and b.id = p.id;
-- (idem para product_variants e combos)
