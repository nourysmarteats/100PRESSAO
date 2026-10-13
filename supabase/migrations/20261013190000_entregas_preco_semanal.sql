-- Entregas: preço acordado com km incluídos e conferência SEMANAL (13/10/2026, pedido do Leandro).
--
-- Segue a v2 do registo (/parceiro-entregas): as empresas propõem recolha + entrega,
-- km incluídos e € por km adicional, e faturam semanalmente.
--   · preço acordado = tarifa_base (fixo por entrega = recolha + entrega)
--                    + tarifa_km × max(0, km − km_incluidos_acordados);
--   · empresas já aprovadas ficam com 0 km incluídos → o custo delas não muda;
--   · o portal da empresa passa a ver as entregas por semana (segunda a domingo, hora
--     de Lisboa), a mesma semana que vai na fatura. A função mensal fica, sem uso.
--
-- O custo de cada entrega continua congelado no momento em que o estafeta aceita.

begin;

-- 1. Km incluídos no preço acordado
alter table public.empresas_entrega
  add column if not exists km_incluidos_acordados numeric(5,2)
    check (km_incluidos_acordados is null or km_incluidos_acordados between 0 and 30);

comment on column public.empresas_entrega.tarifa_base is 'Acordado: valor fixo por entrega (recolha + entrega), sem IVA.';
comment on column public.empresas_entrega.tarifa_km is 'Acordado: valor por km além dos km incluídos, sem IVA.';
comment on column public.empresas_entrega.km_incluidos_acordados is 'Acordado: km incluídos no valor fixo.';

update public.empresas_entrega set km_incluidos_acordados = 0
 where tarifa_base is not null and km_incluidos_acordados is null;

-- 2. Aprovar sem mexer no preço = aceitar o proposto (agora também os km incluídos)
create or replace function public.empresa_entrega_antes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.decidido_em  := now();
    new.decidido_por := auth.uid();
    -- Aprovar sem fixar preço = aceitar o proposto.
    if new.estado = 'aprovada' then
      new.tarifa_base := coalesce(new.tarifa_base, new.tarifa_proposta_base);
      new.tarifa_km   := coalesce(new.tarifa_km,   new.tarifa_proposta_km);
      new.km_incluidos_acordados := coalesce(new.km_incluidos_acordados, new.km_incluidos, 0);
    end if;
  end if;

  new.expira_em := case
    when new.simulacao then null
    when new.estado = 'pendente'  then (coalesce(new.criado_em, now()) + interval '6 months')::date
    when new.estado = 'rejeitada' then (coalesce(new.decidido_em, now()) + interval '90 days')::date
    when new.estado = 'terminada' then (coalesce(new.decidido_em, now()) + interval '2 years')::date
    else null
  end;
  return new;
end;
$$;

-- 3. Auditoria também dos km incluídos
create or replace function public.empresa_entrega_auditar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado
     or new.tarifa_base is distinct from old.tarifa_base
     or new.tarifa_km   is distinct from old.tarifa_km
     or new.km_incluidos_acordados is distinct from old.km_incluidos_acordados then
    insert into public.audit_log (user_id, acao, detalhe)
    values (auth.uid(), 'empresa_entrega_' || new.estado,
            jsonb_build_object('id', new.id, 'de', old.estado, 'para', new.estado,
                               'tarifa_base', new.tarifa_base, 'tarifa_km', new.tarifa_km,
                               'km_incluidos', new.km_incluidos_acordados,
                               'simulacao', new.simulacao));
  end if;
  return new;
end;
$$;

-- 4. Custo congelado ao aceitar: fixo + km além dos incluídos
create or replace function public.aceitar_oferta(p_oferta uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := public.meu_estafeta(); f record; e record;
begin
  if v is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into f from public.entregas_ofertas where id = p_oferta and estafeta_id = v for update;
  if f.id is null or f.estado <> 'oferecida' then return false; end if;
  perform 1 from public.orders where id = f.order_id and entrega_estado = 'a_chamar' for update;
  if not found then
    update public.entregas_ofertas set estado = 'expirada', respondido_em = now() where id = p_oferta;
    return false;
  end if;
  select em.* into e from public.estafetas s join public.empresas_entrega em on em.id = s.empresa_id where s.id = v;
  update public.orders set entrega_estado = 'aceite', estafeta_id = v, empresa_entrega_id = e.id,
         custo_entrega = round(e.tarifa_base
           + e.tarifa_km * greatest(0, coalesce(distancia_km, 0) - coalesce(e.km_incluidos_acordados, 0)), 2)
   where id = f.order_id;
  update public.entregas_ofertas set estado = 'aceite', respondido_em = now() where id = p_oferta;
  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = f.order_id and id <> p_oferta and estado = 'oferecida';
  return true;
end; $$;

-- 5. O que a empresa sabe de si própria: + km incluídos
drop function if exists public.minha_empresa_info();
create function public.minha_empresa_info()
returns table (nome text, estado text, tarifa_base numeric, tarifa_km numeric, km_incluidos numeric, acordo_dados boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(e.nome_comercial, e.nome_legal), e.estado, e.tarifa_base, e.tarifa_km,
         coalesce(e.km_incluidos_acordados, 0), e.acordo_dados_assinado_em is not null
    from public.empresas_entrega e where e.id = public.minha_empresa();
$$;
revoke all on function public.minha_empresa_info() from public, anon;
grant execute on function public.minha_empresa_info() to authenticated;

-- 6. Entregas da empresa por semana (segunda a domingo, hora de Lisboa) — a semana da fatura
create or replace function public.entregas_da_minha_empresa_semana(p_semana date)
returns table (numero bigint, data timestamptz, estafeta text, distancia_km numeric, custo numeric, estado text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.numero, o.criado_em, s.nome, o.distancia_km, o.custo_entrega, o.entrega_estado
    from public.orders o left join public.estafetas s on s.id = o.estafeta_id
   where o.empresa_entrega_id = public.minha_empresa()
     and (o.criado_em at time zone 'Europe/Lisbon') >= date_trunc('week', p_semana::timestamp)
     and (o.criado_em at time zone 'Europe/Lisbon') <  date_trunc('week', p_semana::timestamp) + interval '7 days'
   order by o.criado_em;
$$;
revoke all on function public.entregas_da_minha_empresa_semana(date) from public, anon;
grant execute on function public.entregas_da_minha_empresa_semana(date) to authenticated;

commit;
