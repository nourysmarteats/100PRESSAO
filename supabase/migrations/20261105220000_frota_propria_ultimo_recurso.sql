-- Frota própria como último recurso (ata de 12/10/2026, confirmada pelo Leandro a 5/11).
--
-- Ordem do despacho, desde que o pagamento entra:
--   1. Estafeta parceiro mais próximo (escalada de 60 s em 60 s, já existente).
--   2. Passados `despacho_externo_min` (3) sem aceitação — ou logo, se não houver
--      parceiro disponível —, oferta a todos os estafetas da frota própria.
--   3. Se ninguém da frota aceitar em `despacho_espera_min` (5): sem_estafeta
--      (alerta no Staff, já existente). "Entregamos nós" no Staff está sempre lá.
--
-- Frota própria = empresa interna (Sintonia dos Temperos), `frota_propria = true`:
-- só pessoas da casa (sócios-gerentes ou trabalhadores com contrato), custo 0 €,
-- sem fatura. Não depende do modo de teste nem de acordo art. 28.º (não há
-- subcontratante: são a própria empresa).
--
-- Substitui o "3 minutos para a equipa assumir" da migração 20261105210000.

alter table public.empresas_entrega add column if not exists frota_propria boolean not null default false;
create unique index if not exists empresas_entrega_uma_frota_propria
  on public.empresas_entrega (frota_propria) where frota_propria;

insert into public.empresas_entrega (
  nome_legal, nome_comercial, nipc, tarifa_proposta_base, tarifa_proposta_km,
  tarifa_base, tarifa_km, estado, decidido_em, termos_versao, aviso_versao,
  aceitou_termos_em, simulacao, frota_propria, motivo_decisao
)
select 'Sintonia dos Temperos, Lda.', '100PRESSÃO — frota própria', '519521463', 0, 0,
       0, 0, 'aprovada', now(), 'interno', 'interno', now(), false, true,
       'Frota própria (ata 12/10/2026): último recurso, só pessoas da casa.'
 where not exists (select 1 from public.empresas_entrega where frota_propria);

update public.definicoes
   set valor = (valor - 'despacho_restaurante_min') || '{"despacho_modo": "proximidade", "despacho_externo_min": 3}'::jsonb
 where chave = 'entrega';

-- Núcleo do despacho. p_grupo: 'parceiros' (empresas externas, respeitando o
-- modo de teste e o acordo art. 28.º) ou 'frota' (frota própria).
-- Sem parceiros disponíveis, passa logo à frota.
drop function if exists public.despachar_entrega(uuid, text);
create or replace function public.despachar_entrega(p_order uuid, p_modo text, p_grupo text default 'parceiros')
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

  if p_grupo = 'frota' then
    -- As ofertas aos parceiros ficam abertas: se um aceitar entretanto, fica com ela.
    insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
    select p_order, s.id, o.distancia_km
      from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado
       and e.estado = 'aprovada' and e.frota_propria
       and not exists (select 1 from public.entregas_ofertas f
                        where f.order_id = p_order and f.estafeta_id = s.id and f.estado = 'oferecida');
    get diagnostics v_n = row_count;
    update public.orders set entrega_estado = case when v_n > 0 then 'a_chamar' else 'sem_estafeta' end,
           entrega_chamada_em = now(), entrega_modo = 'propria' where id = p_order;
    return v_n;
  end if;

  -- Parceiros: uma chamada nova recomeça a ronda.
  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = p_order and estado = 'oferecida';
  delete from public.entregas_ofertas where order_id = p_order and estado <> 'aceite';

  if v_modo = 'proximidade' then
    insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
    select p_order, s.id, o.distancia_km
      from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
       and not e.frota_propria
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
       and not e.frota_propria
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end);
    get diagnostics v_n = row_count;
  end if;

  if v_n = 0 then
    return public.despachar_entrega(p_order, 'todos', 'frota');
  end if;

  update public.orders set entrega_estado = 'a_chamar', entrega_chamada_em = now(), entrega_modo = v_modo
   where id = p_order;
  return v_n;
end; $function$;
revoke all on function public.despachar_entrega(uuid, text, text) from public, anon, authenticated;

create or replace function public.chamar_estafeta(p_order uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.e_equipa() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return public.despachar_entrega(p_order,
    coalesce((select valor->>'despacho_modo' from public.definicoes where chave = 'entrega'), 'todos'), 'parceiros');
end; $function$;

-- pg_cron (30 s): chama parceiros logo que o pagamento entra; passa à frota
-- própria quando os parceiros não aceitam a tempo.
create or replace function public.despacho_automatico()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare o record; v_ext int; v_total int := 0;
begin
  v_ext := coalesce((select (valor->>'despacho_externo_min')::int from public.definicoes where chave = 'entrega'), 3);

  for o in
    select id from public.orders
     where canal = 'online' and tipo_entrega = 'entrega'
       and estado not in ('entregue', 'cancelado')
       and estado_pagamento in ('pago', 'na_entrega')
       and entrega_estado is null
       and coalesce(pago_em, criado_em) > now() - interval '3 hours'
     for update skip locked
  loop
    v_total := v_total + public.despachar_entrega(o.id, 'proximidade', 'parceiros');
  end loop;

  for o in
    select id from public.orders
     where canal = 'online' and tipo_entrega = 'entrega'
       and estado not in ('entregue', 'cancelado')
       and entrega_estado = 'a_chamar' and entrega_modo in ('proximidade', 'todos')
       and entrega_chamada_em < now() - make_interval(mins => v_ext)
     for update skip locked
  loop
    v_total := v_total + public.despachar_entrega(o.id, 'todos', 'frota');
  end loop;

  return v_total;
end; $function$;
revoke all on function public.despacho_automatico() from public, anon, authenticated;

-- A escalada por proximidade é só entre parceiros: a frota própria entra no fim.
create or replace function public.escalar_ofertas_proximidade()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
       and not e.frota_propria
       and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
       and s.posicao_em > now() - interval '5 minutes'
       and not exists (select 1 from public.entregas_ofertas f where f.order_id = o.id and f.estafeta_id = s.id)
     order by public.distancia_km(s.posicao_lat, s.posicao_lng, (cfg->>'loja_lat')::numeric, (cfg->>'loja_lng')::numeric)
     limit 1;
    get diagnostics v_n = row_count;

    if v_n = 0 then
      -- Sem mais ninguém com posição: oferta aos parceiros que faltam, e acaba o escalonamento.
      insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
      select o.id, s.id, o.distancia_km
        from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
       where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
         and not e.frota_propria
         and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
         and not exists (select 1 from public.entregas_ofertas f where f.order_id = o.id and f.estafeta_id = s.id);
      get diagnostics v_n = row_count;
      update public.orders set entrega_modo = 'todos' where id = o.id;
    end if;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end; $function$;
