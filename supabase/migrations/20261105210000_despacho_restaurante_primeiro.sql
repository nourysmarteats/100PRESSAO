-- Despacho: o restaurante tem prioridade, depois o estafeta mais próximo
-- (Leandro, 5 Nov 2026).
--
-- 1. Quando o pagamento de uma encomenda online com entrega entra, a equipa tem
--    `despacho_restaurante_min` minutos (3) para carregar em "Entregamos nós".
-- 2. Se ninguém assumir, o pg_cron chama sozinho o estafeta mais próximo
--    (modo proximidade); a escalada para o seguinte já existia
--    (escalar_ofertas_proximidade, a cada 60 s) e o alerta sem_estafeta também
--    (expirar_chamadas_entrega, despacho_espera_min).
-- 3. O modo de teste continua a mandar: com despacho_teste ligado, as ofertas só
--    vão para empresas de simulação — tal como no botão manual.

-- Frota própria passa a ser um modo de entrega a sério.
alter table public.orders drop constraint if exists orders_entrega_modo_check;
alter table public.orders add constraint orders_entrega_modo_check
  check (entrega_modo is null or entrega_modo in ('todos', 'proximidade', 'propria'));

update public.definicoes
   set valor = valor || '{"despacho_modo": "proximidade", "despacho_restaurante_min": 3}'::jsonb
 where chave = 'entrega';

-- Núcleo da chamada, sem verificação de permissões: só o servidor o usa
-- (chamar_estafeta para a equipa, despacho_automatico para o pg_cron).
create or replace function public.despachar_entrega(p_order uuid, p_modo text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare o record; cfg jsonb; v_teste boolean; v_modo text := coalesce(p_modo, 'todos'); v_n int := 0;
begin
  select valor into cfg from public.definicoes where chave = 'entrega';
  v_teste := coalesce((cfg->>'despacho_teste')::boolean, true);
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.tipo_entrega <> 'entrega' then raise exception 'Encomenda sem entrega.' using errcode = '22023'; end if;
  if o.entrega_estado in ('aceite','recolhido','entregue') then raise exception 'Esta entrega já tem estafeta.' using errcode = '22023'; end if;

  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = p_order and estado = 'oferecida';
  -- Uma chamada nova recomeça a ronda: as ofertas antigas desta encomenda saem do caminho.
  delete from public.entregas_ofertas where order_id = p_order and estado <> 'aceite';

  if v_modo = 'proximidade' then
    insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
    select p_order, s.id, o.distancia_km
      from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
       and s.posicao_em > now() - interval '5 minutes'
     order by public.distancia_km(s.posicao_lat, s.posicao_lng, (cfg->>'loja_lat')::numeric, (cfg->>'loja_lng')::numeric)
     limit 1;
    get diagnostics v_n = row_count;
    if v_n = 0 then v_modo := 'todos'; end if;
  end if;

  if v_modo = 'todos' then
    insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
    select p_order, s.id, o.distancia_km
      from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end);
    get diagnostics v_n = row_count;
  end if;

  update public.orders set entrega_estado = case when v_n > 0 then 'a_chamar' else 'sem_estafeta' end,
         entrega_chamada_em = now(), entrega_modo = v_modo where id = p_order;
  return v_n;
end; $function$;
revoke all on function public.despachar_entrega(uuid, text) from public, anon, authenticated;

-- Botão "Chamar estafeta" do Staff: mesma regra de sempre, agora sobre o núcleo.
create or replace function public.chamar_estafeta(p_order uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.e_equipa() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return public.despachar_entrega(p_order,
    coalesce((select valor->>'despacho_modo' from public.definicoes where chave = 'entrega'), 'todos'));
end; $function$;

-- "Entregamos nós": a equipa fica com a entrega e o despacho automático não a toca.
create or replace function public.entrega_pela_equipa(p_order uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare o record;
begin
  if not public.e_equipa() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.tipo_entrega <> 'entrega' then raise exception 'Encomenda sem entrega.' using errcode = '22023'; end if;
  if o.estado in ('entregue', 'cancelado') then raise exception 'Encomenda já fechada.' using errcode = '22023'; end if;
  if o.entrega_estado in ('aceite','recolhido','entregue') then
    raise exception 'Esta entrega já está entregue a alguém.' using errcode = '22023';
  end if;
  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = p_order and estado = 'oferecida';
  update public.orders
     set entrega_modo = 'propria', entrega_estado = 'aceite', entrega_chamada_em = coalesce(entrega_chamada_em, now()),
         estafeta_id = null, empresa_entrega_id = null, custo_entrega = null
   where id = p_order;
  insert into public.audit_log (user_id, acao, detalhe)
  values (auth.uid(), 'entrega_pela_equipa', jsonb_build_object('order_id', p_order));
end; $function$;
revoke all on function public.entrega_pela_equipa(uuid) from public, anon;
grant execute on function public.entrega_pela_equipa(uuid) to authenticated;

-- pg_cron: passado o prazo da equipa, chama o estafeta mais próximo.
-- Só encomendas pagas nas últimas 3 horas (nunca acorda encomendas antigas).
create or replace function public.despacho_automatico()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare o record; v_min int; v_total int := 0;
begin
  v_min := coalesce((select (valor->>'despacho_restaurante_min')::int from public.definicoes where chave = 'entrega'), 3);
  for o in
    select id from public.orders
     where canal = 'online' and tipo_entrega = 'entrega'
       and estado not in ('entregue', 'cancelado')
       and estado_pagamento in ('pago', 'na_entrega')
       and entrega_estado is null
       and coalesce(pago_em, criado_em) < now() - make_interval(mins => v_min)
       and coalesce(pago_em, criado_em) > now() - interval '3 hours'
     for update skip locked
  loop
    v_total := v_total + public.despachar_entrega(o.id, 'proximidade');
  end loop;
  return v_total;
end; $function$;
revoke all on function public.despacho_automatico() from public, anon, authenticated;

select cron.unschedule('despacho-automatico')
 where exists (select 1 from cron.job where jobname = 'despacho-automatico');
select cron.schedule('despacho-automatico', '30 seconds', 'select public.despacho_automatico()');
