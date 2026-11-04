-- Cliente Beta no caixa (PDV) — 2026-11-04
--
-- Até aqui o caixa não tinha forma de aplicar os 10% de Cliente Beta: o
-- balcão confirmava o número em /equipa/beta-balcao e o desconto era para
-- aplicar "no Vendus" — o que deixou de ser possível desde que a fatura é
-- emitida pela app. Decisão do Leandro (25/10/2026): o benefício vale no
-- balcão e no takeaway. Nunca nas plataformas.
--
-- Duas funções, ambas só para a equipa autenticada (e_equipa()):
--
-- 1) consultar_cliente_beta_caixa(numero) — o operador vê o nome (para
--    cruzar com a pessoa à frente) e a percentagem em vigor. Ao contrário de
--    verificar_cliente_beta, respeita o interruptor `cliente_beta.ativo` e o
--    `expira_em`, tal como o checkout online.
--
-- 2) aplicar_cliente_beta_caixa(order_id, numero) — chamada logo a seguir a
--    criar_pedido e ANTES de marcar o pedido como pago. Aplica a percentagem
--    linha a linha (order_items.desconto_percentagem), com o mesmo
--    arredondamento por unidade do criar_pedido_online e da fatura, e regista
--    a utilização em cliente_beta_validacoes, para aparecer em Admin →
--    Utilizações Cliente Beta.
--
-- Guardas no servidor: só pedidos de balcão (canal 'mesa'), ainda por pagar,
-- sem fatura, sem desconto já aplicado.

create or replace function public.consultar_cliente_beta_caixa(p_numero integer)
returns table(numero integer, nome text, ativo boolean, unidade text, desconto_pct numeric)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare cfg jsonb; v_prog boolean;
begin
  if not public.e_equipa() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_numero is null or p_numero not between 100 and 999 then
    return;
  end if;
  select valor into cfg from public.definicoes where chave = 'cliente_beta';
  v_prog := coalesce((cfg->>'ativo')::boolean, false);

  return query
  select cb.numero, cb.nome,
         (v_prog and cb.estado = 'ativo' and (cb.expira_em is null or cb.expira_em >= current_date)),
         bc.unidade_nome,
         coalesce((cfg->>'desconto_pct')::numeric, 10)
    from public.clientes_beta cb
    join public.beta_campanhas bc on bc.id = cb.campanha_id
   where cb.numero = p_numero
   order by (cb.estado = 'ativo') desc
   limit 1;
end $function$;

create or replace function public.aplicar_cliente_beta_caixa(p_order_id uuid, p_numero integer)
returns table(total numeric, desconto numeric, desconto_pct numeric, nome text)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  cfg jsonb; v_pct numeric; v_cb uuid; v_nome text;
  v_ord public.orders%rowtype; v_desc numeric(10,2);
begin
  if not public.e_equipa() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select valor into cfg from public.definicoes where chave = 'cliente_beta';
  if coalesce((cfg->>'ativo')::boolean, false) is not true then
    raise exception 'Programa Cliente Beta desligado' using errcode = '22023';
  end if;
  v_pct := coalesce((cfg->>'desconto_pct')::numeric, 10);
  if v_pct <= 0 or v_pct >= 100 then
    raise exception 'Percentagem Cliente Beta inválida nas definições' using errcode = '22023';
  end if;

  select * into v_ord from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = '22023';
  end if;
  if v_ord.canal is distinct from 'mesa' then
    raise exception 'Desconto Cliente Beta só ao balcão (não em plataformas nem online)' using errcode = '22023';
  end if;
  if v_ord.estado_pagamento = 'pago' or v_ord.fatura_documento_id is not null then
    raise exception 'Pedido já pago ou faturado: o desconto tem de entrar antes' using errcode = '22023';
  end if;
  if v_ord.cliente_beta_id is not null or coalesce(v_ord.desconto_beta, 0) > 0 then
    raise exception 'Este pedido já tem desconto Cliente Beta' using errcode = '22023';
  end if;

  select cb.id, cb.nome into v_cb, v_nome
    from public.clientes_beta cb
   where cb.numero = p_numero and cb.estado = 'ativo'
     and (cb.expira_em is null or cb.expira_em >= current_date)
   limit 1;
  if v_cb is null then
    raise exception 'Não é Cliente Beta ativo' using errcode = '22023';
  end if;

  update public.order_items oi set desconto_percentagem = v_pct where oi.order_id = p_order_id;

  -- Mesma conta do criar_pedido_online e da fatura: desconto por unidade,
  -- arredondado ao cêntimo, vezes a quantidade.
  select coalesce(sum((oi.preco_unitario - round(oi.preco_unitario * (100 - v_pct) / 100, 2)) * oi.quantidade), 0)
    into v_desc
    from public.order_items oi where oi.order_id = p_order_id;

  update public.orders o
     set total = o.total - v_desc,
         desconto_beta = v_desc,
         cliente_beta_id = v_cb,
         numero_beta = p_numero
   where o.id = p_order_id;

  insert into public.cliente_beta_validacoes (numero, cliente_beta_id, resultado, order_id, usado_em, desconto)
  values (p_numero, v_cb, 'ok', p_order_id, now(), v_desc);

  return query select o.total, v_desc, v_pct, v_nome from public.orders o where o.id = p_order_id;
end $function$;

revoke all on function public.consultar_cliente_beta_caixa(integer) from public, anon;
revoke all on function public.aplicar_cliente_beta_caixa(uuid, integer) from public, anon;
grant execute on function public.consultar_cliente_beta_caixa(integer) to authenticated, service_role;
grant execute on function public.aplicar_cliente_beta_caixa(uuid, integer) to authenticated, service_role;
