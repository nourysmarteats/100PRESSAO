-- Pedidos das plataformas de entrega lançados no caixa (2026-10-26, Leandro + Daniel).
--
-- Problema: os pedidos da Uber Eats, Glovo e Bolt Food chegavam aos tablets das
-- plataformas e nunca entravam na app, por isso não apareciam no Financeiro, no
-- Arranque nem na Rentabilidade.
--
-- Decisão: cada pedido de plataforma é lançado no caixa, pedido a pedido.
--   - canal = 'ubereats' | 'glovo' | 'boltfood' (o mesmo vocabulário do Arranque
--     e das receitas externas)
--   - preço = preco_plataforma de cada artigo (o que o cliente pagou na plataforma)
--   - metodo_pagamento = 'plataforma': o dinheiro é cobrado pela plataforma, que
--     transfere o líquido e fatura a comissão à parte
--   - plataforma_ref = n.º do pedido na plataforma, obrigatório e único por
--     plataforma: o mesmo pedido não entra duas vezes
--   - nasce pago e entregue: a cozinha trabalha pelo tablet da plataforma, por
--     isso não entra na fila do Staff
--   - sem desconto Cliente Beta (decisão de 25 Set 2026: não vale nas plataformas)
--
-- Contrapartida no Financeiro (regra confirmada pelo Leandro a 26 Out 2026):
--   - a venda entra aqui, pelo valor bruto
--   - a comissão entra como despesa, a partir da fatura da plataforma
--   - a transferência que chega ao Revolut NÃO é receita (a Joana só a usa para
--     conferir). Por isso os canais das plataformas deixam de ser aceites em
--     financeiro.receitas_externas: lançá-los lá duplicava a venda.

-- 1. Coluna e regras do pedido de plataforma -------------------------------

alter table public.orders
  add column if not exists plataforma_ref text;

comment on column public.orders.plataforma_ref is
  'N.º do pedido na Uber Eats/Glovo/Bolt Food. Obrigatório nesses canais e único por plataforma. Normalizado: maiúsculas, sem espaços nem # inicial.';

alter table public.orders
  drop constraint if exists orders_plataforma_ref_coerente;
alter table public.orders
  add constraint orders_plataforma_ref_coerente check (
    (canal in ('ubereats', 'glovo', 'boltfood')) = (plataforma_ref is not null)
  );

alter table public.orders
  drop constraint if exists orders_plataforma_ref_formato;
alter table public.orders
  add constraint orders_plataforma_ref_formato check (
    plataforma_ref is null or plataforma_ref ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'
  );

create unique index if not exists orders_plataforma_ref_unico
  on public.orders (canal, plataforma_ref)
  where plataforma_ref is not null;

-- 2. Função de lançamento --------------------------------------------------
-- Só a equipa (sessão com perfil activo) lança. Ao contrário de criar_pedido,
-- não é pública: um pedido de plataforma nasce pago, e isso não pode estar ao
-- alcance da chave anon.
--
-- Não se exige disponivel nem servido_hoje: o pedido já foi aceite e pago na
-- plataforma. Se o artigo estiver desligado na app, a venda aconteceu na mesma
-- e tem de ficar registada. Exige-se só que o artigo exista e tenha preço de
-- plataforma — sem preço, a venda entraria com um valor que não é o cobrado.

create or replace function public.criar_pedido_plataforma(
  p_canal text,
  p_ref text,
  p_itens jsonb
)
returns table (id uuid, numero bigint, total numeric)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ref text;
  v_sessao uuid;
  v_order_id uuid;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_preco numeric(10,2);
  v_nome text;
  v_qtd int;
  v_n_itens int;
  v_existente bigint;
  v_rotulo text;
begin
  if not public.e_equipa() then
    raise exception 'Só a equipa pode lançar pedidos de plataforma.' using errcode = '42501';
  end if;

  v_rotulo := case p_canal
    when 'ubereats' then 'Uber Eats'
    when 'glovo' then 'Glovo'
    when 'boltfood' then 'Bolt Food'
  end;
  if v_rotulo is null then
    raise exception 'Plataforma inválida.' using errcode = '22023';
  end if;

  v_ref := upper(regexp_replace(regexp_replace(coalesce(p_ref, ''), '\s+', '', 'g'), '^#+', ''));
  if v_ref = '' then
    raise exception 'Falta o n.º do pedido na %.', v_rotulo using errcode = '22023';
  end if;
  if v_ref !~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$' then
    raise exception 'N.º do pedido inválido: só letras, números e - . / _ (até 40).' using errcode = '22023';
  end if;

  select o.numero into v_existente
    from public.orders o
   where o.canal = p_canal and o.plataforma_ref = v_ref;
  if v_existente is not null then
    raise exception 'O pedido % da % já foi lançado (venda n.º %).', v_ref, v_rotulo, v_existente
      using errcode = '23505';
  end if;

  v_n_itens := coalesce(jsonb_array_length(p_itens), 0);
  if v_n_itens = 0 then raise exception 'Pedido sem itens.' using errcode = '22023'; end if;
  if v_n_itens > 50 then raise exception 'Pedido demasiado grande.' using errcode = '22023'; end if;

  insert into public.sessions (nome_cliente, posicao_mesa)
  values (v_rotulo, 'PLATAFORMA')
  returning sessions.id into v_sessao;

  insert into public.orders (
    session_id, canal, plataforma_ref, estado, metodo_pagamento,
    estado_pagamento, pago_em, total
  )
  values (
    v_sessao, p_canal, v_ref, 'recebido', 'plataforma',
    'pago', now(), 0
  )
  returning orders.id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := coalesce((v_item->>'quantidade')::int, 0);
    if v_qtd < 1 or v_qtd > 99 then raise exception 'Quantidade inválida.' using errcode = '22023'; end if;

    v_preco := null;
    v_nome := null;
    if v_item->>'combo_id' is not null then
      select c.preco_plataforma, c.nome into v_preco, v_nome
        from public.combos c where c.id = (v_item->>'combo_id')::uuid;
    elsif v_item->>'variant_id' is not null then
      select pv.preco_plataforma, pv.nome into v_preco, v_nome
        from public.product_variants pv where pv.id = (v_item->>'variant_id')::uuid;
    elsif v_item->>'product_id' is not null then
      select p.preco_plataforma, p.nome into v_preco, v_nome
        from public.products p where p.id = (v_item->>'product_id')::uuid;
    end if;

    if v_nome is null then
      raise exception 'Artigo inexistente.' using errcode = '22023';
    end if;
    if v_preco is null then
      raise exception '"%" não tem preço de plataforma definido. Define-o na Ementa antes de lançar.', v_nome
        using errcode = '22023';
    end if;

    insert into public.order_items (order_id, product_id, variant_id, combo_id, quantidade, preco_unitario)
    values (
      v_order_id,
      nullif(v_item->>'product_id', '')::uuid,
      nullif(v_item->>'variant_id', '')::uuid,
      nullif(v_item->>'combo_id', '')::uuid,
      v_qtd, v_preco
    );

    v_total := v_total + (v_preco * v_qtd);
  end loop;

  -- Entregue logo: fica fora da fila do Staff (a cozinha usa o tablet).
  update public.orders o set total = v_total, estado = 'entregue' where o.id = v_order_id;

  return query
    select o.id, o.numero, o.total from public.orders o where o.id = v_order_id;
end;
$function$;

revoke all on function public.criar_pedido_plataforma(text, text, jsonb) from public, anon;
grant execute on function public.criar_pedido_plataforma(text, text, jsonb) to authenticated;

comment on function public.criar_pedido_plataforma(text, text, jsonb) is
  'Lança no caixa um pedido da Uber Eats/Glovo/Bolt Food ao preco_plataforma. Só equipa. Nasce pago e entregue; n.º da plataforma único.';

-- 3. Receitas externas deixam de aceitar as plataformas --------------------
-- Até hoje não há nenhuma linha destes canais (verificado a 2026-10-26), por isso
-- apertar a regra não mexe em dados.

alter table financeiro.receitas_externas
  drop constraint if exists receitas_externas_canal_check;
alter table financeiro.receitas_externas
  add constraint receitas_externas_canal_check
  check (canal in ('pos_externo', 'eventos', 'outro'));

comment on table financeiro.receitas_externas is
  'So receita que NAO passa pela app. A receita da app (incluindo Uber Eats, Glovo e Bolt Food, lancadas no caixa desde 2026-10-26) deriva de public.orders — nunca se lanca aqui, sob pena de duplicar.';
