-- Reversão de 20261013190000_entregas_preco_semanal.sql — repõe as versões de 12–13/10/2026.
-- Atenção: o custo das entregas já aceites não é recalculado (fica o que foi congelado).

begin;

drop function if exists public.entregas_da_minha_empresa_semana(date);

drop function if exists public.minha_empresa_info();
create function public.minha_empresa_info()
returns table (nome text, estado text, tarifa_base numeric, tarifa_km numeric, acordo_dados boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(e.nome_comercial, e.nome_legal), e.estado, e.tarifa_base, e.tarifa_km,
         e.acordo_dados_assinado_em is not null
    from public.empresas_entrega e where e.id = public.minha_empresa();
$$;
revoke all on function public.minha_empresa_info() from public, anon;
grant execute on function public.minha_empresa_info() to authenticated;

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
         custo_entrega = round(e.tarifa_base + e.tarifa_km * coalesce(distancia_km, 0), 2)
   where id = f.order_id;
  update public.entregas_ofertas set estado = 'aceite', respondido_em = now() where id = p_oferta;
  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = f.order_id and id <> p_oferta and estado = 'oferecida';
  return true;
end; $$;

create or replace function public.empresa_entrega_auditar()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.estado is distinct from old.estado
     or new.tarifa_base is distinct from old.tarifa_base
     or new.tarifa_km   is distinct from old.tarifa_km then
    insert into public.audit_log (user_id, acao, detalhe)
    values (auth.uid(), 'empresa_entrega_' || new.estado,
            jsonb_build_object('id', new.id, 'de', old.estado, 'para', new.estado,
                               'tarifa_base', new.tarifa_base, 'tarifa_km', new.tarifa_km,
                               'simulacao', new.simulacao));
  end if;
  return new;
end; $$;

create or replace function public.empresa_entrega_antes()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.decidido_em  := now();
    new.decidido_por := auth.uid();
    if new.estado = 'aprovada' then
      new.tarifa_base := coalesce(new.tarifa_base, new.tarifa_proposta_base);
      new.tarifa_km   := coalesce(new.tarifa_km,   new.tarifa_proposta_km);
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
end; $$;

alter table public.empresas_entrega drop column if exists km_incluidos_acordados;

commit;
