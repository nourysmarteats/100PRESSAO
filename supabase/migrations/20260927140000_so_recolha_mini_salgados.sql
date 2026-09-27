-- Artigos só para levantar (27/09/2026).
-- Os mini salgados, reaquecidos e fechados na caixa, chegam moles: a Ementa
-- Online Outono/Inverno aprovada pelo Leandro vende-os só em recolha até haver
-- forno ventilado/airfryer e caixa ventilada. A regra vive no servidor para
-- valer também para quem chame a RPC directamente; o site só a espelha.

alter table public.products
  add column if not exists so_recolha boolean not null default false;

comment on column public.products.so_recolha is
  'Só se vende para levantar no restaurante online: criar_pedido_online recusa-o em entrega.';

-- Mini Salgados: só recolha, em duas opções (10 e 20 unidades), preços da ementa aprovada.
-- preco = base de mesa (online / 1,10, regra de src/lib/precos.js); sem preço de plataforma.
update public.products
   set so_recolha = true, disponivel = true, preco = 8.09, preco_online = 8.90, preco_plataforma = null
 where id = 'dabe9d28-498c-4150-9a38-fc321ec4c420';

insert into public.product_variants (product_id, nome, preco, preco_online, preco_plataforma, disponivel, ordem)
select 'dabe9d28-498c-4150-9a38-fc321ec4c420', v.nome, v.preco, v.preco_online, null, true, v.ordem
  from (values ('10 unidades', 8.09, 8.90, 1), ('20 unidades', 14.45, 15.90, 2)) as v(nome, preco, preco_online, ordem)
 where not exists (select 1 from public.product_variants pv
                    where pv.product_id = 'dabe9d28-498c-4150-9a38-fc321ec4c420' and pv.nome = v.nome);

-- Guaraná: a base de mesa estava a 2,50 € (o preço de plataforma), acima do
-- online aprovado de 2,20 €. Pela regra base + 10% = online, a base é 2,00 €.
update public.products set preco = 2.00
 where id = '545783aa-5723-439f-ba07-dca327717ea8' and preco_online = 2.20;

-- criar_pedido_online: recusa entrega quando há artigos só para levantar
-- (directos, por variante ou dentro de um combo). Acrescenta a verificação a
-- seguir à validação de cada item, sem reescrever o resto da função.
do $mig$
declare
  v_def   text;
  v_anc   text := $a$raise exception 'Item indisponível ou inexistente' using errcode = '22023';
    end if;$a$;
  v_chk   text := $c$

    if v_tipo = 'entrega' and (
         (v_item->>'variant_id' is not null and exists (
            select 1 from public.product_variants pv join public.products pp on pp.id = pv.product_id
             where pv.id = (v_item->>'variant_id')::uuid and pp.so_recolha))
      or (v_item->>'variant_id' is null and v_item->>'product_id' is not null and exists (
            select 1 from public.products pp
             where pp.id = (v_item->>'product_id')::uuid and pp.so_recolha))
      or (v_item->>'combo_id' is not null and exists (
            select 1 from public.combo_items ci join public.products pp on pp.id = ci.product_id
             where ci.combo_id = (v_item->>'combo_id')::uuid and pp.so_recolha))
    ) then
      raise exception 'Há artigos só para levantar: escolha levantamento' using errcode = '22023';
    end if;$c$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'criar_pedido_online';
  if position('so_recolha' in v_def) > 0 then
    return; -- já aplicado
  end if;
  if position(v_anc in v_def) = 0 then
    raise exception 'criar_pedido_online mudou: âncora não encontrada';
  end if;
  execute replace(v_def, v_anc, v_anc || v_chk);
end
$mig$;
