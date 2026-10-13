-- Despacho de entregas — Fase 2B: proximidade (GPS), acompanhamento pelo cliente.
-- Ata de 2026-10-12 + decisões de 13/10/2026 (aprovadas pelo Leandro):
--   · GPS só com a app aberta; sem posição recente, a oferta vai para todos;
--   · o cliente acompanha pela página de confirmação e pelo email (sem SMS);
-- Condições da Bea (obrigatórias):
--   · só existe a posição ACTUAL — nunca histórico; apaga-se quando o estafeta fica
--     indisponível (salvo se estiver a meio de uma entrega) e quando fica velha (15 min);
--   · o cliente só vê a posição entre "Recolhido" e "Entregue"; o link deixa de
--     responder 2 horas depois da entrega.
-- Regra fixa (art. 12.º-A): a posição serve para OFERECER entregas, nunca para avaliar
-- ou controlar o estafeta. Nenhuma função lê posições passadas — não existem.

begin;

-- 1. Distância em linha recta (haversine), em km
create or replace function public.distancia_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric language sql immutable as $$
  select (6371 * 2 * asin(sqrt(
           power(sin(radians((lat2 - lat1) / 2)), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lng2 - lng1) / 2)), 2))))::numeric;
$$;

-- 2. Modo usado em cada chamada (para o escalonamento saber o que fazer)
alter table public.orders add column if not exists entrega_modo text
  check (entrega_modo is null or entrega_modo in ('todos','proximidade'));

-- 3. O estafeta envia a posição (só com a app aberta). Aceite apenas quando está
--    disponível ou a meio de uma entrega — fora disso não há razão para a tratar.
create or replace function public.estafeta_posicao(p_lat numeric, p_lng numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := public.meu_estafeta();
begin
  if v is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Posição inválida.' using errcode = '22023';
  end if;
  update public.estafetas s set posicao_lat = round(p_lat, 5), posicao_lng = round(p_lng, 5), posicao_em = now()
   where s.id = v
     and (s.disponivel or exists (select 1 from public.orders o where o.estafeta_id = v and o.entrega_estado in ('aceite','recolhido')));
end; $$;
revoke all on function public.estafeta_posicao(numeric, numeric) from public, anon;
grant execute on function public.estafeta_posicao(numeric, numeric) to authenticated;

-- 4. Ficar indisponível apaga a posição (salvo a meio de uma entrega)
create or replace function public.estafeta_disponivel(p_disponivel boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := public.meu_estafeta();
begin
  if v is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.estafetas set disponivel = p_disponivel,
         disponivel_desde = case when p_disponivel then now() else null end
   where id = v;
  if not p_disponivel and not exists (select 1 from public.orders where estafeta_id = v and entrega_estado in ('aceite','recolhido')) then
    update public.estafetas set posicao_lat = null, posicao_lng = null, posicao_em = null where id = v;
  end if;
end; $$;

-- 5. Concluir a entrega apaga a posição de quem já não está disponível
create or replace function public.avancar_entrega(p_order uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare o record; v uuid := public.meu_estafeta();
begin
  select * into o from public.orders where id = p_order and estafeta_id = v for update;
  if o.id is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if o.entrega_estado = 'aceite' then
    update public.orders set entrega_estado = 'recolhido', estado = 'a_caminho' where id = p_order;
    return 'recolhido';
  elsif o.entrega_estado = 'recolhido' then
    update public.orders set entrega_estado = 'entregue', estado = 'entregue' where id = p_order;
    update public.estafetas set posicao_lat = null, posicao_lng = null, posicao_em = null
     where id = v and not disponivel;
    return 'entregue';
  end if;
  raise exception 'Estado inválido.' using errcode = '22023';
end; $$;

-- 6. Chamar: em modo proximidade oferece primeiro ao mais próximo da loja (com posição
--    dos últimos 5 min). Sem ninguém com posição recente, cai para "todos".
create or replace function public.chamar_estafeta(p_order uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare o record; cfg jsonb; v_teste boolean; v_modo text; v_n int;
begin
  if not public.e_equipa() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select valor into cfg from public.definicoes where chave = 'entrega';
  v_teste := coalesce((cfg->>'despacho_teste')::boolean, true);
  v_modo := coalesce(cfg->>'despacho_modo', 'todos');
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
     where s.ativo and s.disponivel and s.user_id is not null and e.estado = 'aprovada'
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
     where s.ativo and s.disponivel and s.user_id is not null and e.estado = 'aprovada'
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end);
    get diagnostics v_n = row_count;
  end if;

  update public.orders set entrega_estado = case when v_n > 0 then 'a_chamar' else 'sem_estafeta' end,
         entrega_chamada_em = now(), entrega_modo = v_modo where id = p_order;
  return v_n;
end; $$;

-- 7. Escalonamento: oferta por proximidade sem resposta em 60 s passa ao seguinte mais
--    próximo; esgotados os que têm posição, vai para todos os restantes.
create or replace function public.escalar_ofertas_proximidade() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare o record; cfg jsonb; v_teste boolean; v_n int; v_total int := 0;
begin
  select valor into cfg from public.definicoes where chave = 'entrega';
  v_teste := coalesce((cfg->>'despacho_teste')::boolean, true);
  for o in
    select * from public.orders
     where entrega_estado = 'a_chamar' and entrega_modo = 'proximidade'
       and not exists (select 1 from public.entregas_ofertas f where f.order_id = orders.id
                        and f.estado = 'oferecida' and f.criado_em > now() - interval '60 seconds')
     for update skip locked
  loop
    update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
     where order_id = o.id and estado = 'oferecida';

    insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
    select o.id, s.id, o.distancia_km
      from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
     where s.ativo and s.disponivel and s.user_id is not null and e.estado = 'aprovada'
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
       and s.posicao_em > now() - interval '5 minutes'
       and not exists (select 1 from public.entregas_ofertas f where f.order_id = o.id and f.estafeta_id = s.id)
     order by public.distancia_km(s.posicao_lat, s.posicao_lng, (cfg->>'loja_lat')::numeric, (cfg->>'loja_lng')::numeric)
     limit 1;
    get diagnostics v_n = row_count;

    if v_n = 0 then
      -- Sem mais ninguém com posição: oferta a todos os que faltam, e acaba o escalonamento.
      insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
      select o.id, s.id, o.distancia_km
        from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
       where s.ativo and s.disponivel and s.user_id is not null and e.estado = 'aprovada'
         and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
         and not exists (select 1 from public.entregas_ofertas f where f.order_id = o.id and f.estafeta_id = s.id);
      get diagnostics v_n = row_count;
      update public.orders set entrega_modo = 'todos' where id = o.id;
    end if;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end; $$;
revoke all on function public.escalar_ofertas_proximidade() from public, anon, authenticated;
select cron.schedule('escalar-ofertas-proximidade', '20 seconds', 'select public.escalar_ofertas_proximidade()');

-- 8. Posições velhas apagam-se sozinhas (app fechada, telemóvel sem rede)
create or replace function public.limpar_posicoes_estafetas() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v int;
begin
  update public.estafetas set posicao_lat = null, posicao_lng = null, posicao_em = null
   where posicao_em < now() - interval '15 minutes';
  get diagnostics v = row_count;
  return v;
end; $$;
revoke all on function public.limpar_posicoes_estafetas() from public, anon, authenticated;
select cron.schedule('limpar-posicoes-estafetas', '*/5 * * * *', 'select public.limpar_posicoes_estafetas()');

-- 9. Acompanhamento pelo cliente. O UUID da encomenda é a credencial (como em
--    estado_pedido). Posição só entre Recolhido e Entregue, e só se for recente.
--    Duas horas depois da entrega, o link deixa de devolver o que quer que seja.
create or replace function public.acompanhar_entrega(p_id uuid)
returns table (numero bigint, estado text, entrega_estado text, lat numeric, lng numeric, posicao_em timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.numero, o.estado::text, o.entrega_estado,
         case when o.entrega_estado = 'recolhido' and s.posicao_em > now() - interval '10 minutes' then s.posicao_lat end,
         case when o.entrega_estado = 'recolhido' and s.posicao_em > now() - interval '10 minutes' then s.posicao_lng end,
         case when o.entrega_estado = 'recolhido' and s.posicao_em > now() - interval '10 minutes' then s.posicao_em end
    from public.orders o left join public.estafetas s on s.id = o.estafeta_id
   where o.id = p_id and o.tipo_entrega = 'entrega'
     and not (o.estado = 'entregue' and o.atualizado_em < now() - interval '2 hours');
$$;
revoke all on function public.acompanhar_entrega(uuid) from public;
grant execute on function public.acompanhar_entrega(uuid) to anon, authenticated;

commit;
