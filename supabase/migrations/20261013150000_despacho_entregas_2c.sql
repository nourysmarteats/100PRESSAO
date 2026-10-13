-- Despacho de entregas — Fase 2C (13/10/2026, aprovado pelo Leandro):
--   1. convite de EQUIPA, ao lado do individual: um link para vários estafetas, com limite
--      de usos e validade definidos pela empresa, cancelável; quem entra por ele fica
--      "à espera de aprovação" e só recebe ofertas depois de a empresa o ativar;
--   2. "As minhas entregas" na app do estafeta, por semana: data, n.º e km das suas
--      entregas concluídas. Sem clientes, sem valores, sem recusas, sem tempos, sem
--      comparações (art. 12.º-A CT: nada que funcione como avaliação de desempenho).

begin;

-- 1. Aprovação de estafetas (os de convite individual nascem aprovados)
alter table public.estafetas add column if not exists aprovado boolean not null default true;

create table public.estafeta_convites_equipa (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas_entrega(id) on delete cascade,
  token_hash   text not null unique,
  limite       int not null check (limite between 1 and 50),
  usos         int not null default 0,
  expira_em    timestamptz not null,
  cancelado_em timestamptz,
  criado_por   uuid,
  criado_em    timestamptz not null default now()
);
alter table public.estafeta_convites_equipa enable row level security;
revoke all on public.estafeta_convites_equipa from anon;
create policy "convites equipa admin" on public.estafeta_convites_equipa for select to authenticated using ((select public.e_admin()));
create policy "convites equipa da minha empresa" on public.estafeta_convites_equipa for select to authenticated
  using (empresa_id = (select public.minha_empresa()));

create or replace function public.convidar_equipa(p_limite int, p_dias int) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_empresa uuid := public.minha_empresa(); v_token text;
begin
  if v_empresa is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if (select estado from public.empresas_entrega where id = v_empresa) <> 'aprovada' then
    raise exception 'A empresa não está aprovada.' using errcode = '42501';
  end if;
  if p_limite not between 1 and 50 or p_dias not between 1 and 30 then
    raise exception 'Limite entre 1 e 50 pessoas e validade entre 1 e 30 dias.' using errcode = '22023';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.estafeta_convites_equipa (empresa_id, token_hash, limite, expira_em, criado_por)
  values (v_empresa, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_limite, now() + make_interval(days => p_dias), auth.uid());
  return v_token;
end; $$;

create or replace function public.cancelar_convite_equipa(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.estafeta_convites_equipa set cancelado_em = now()
   where id = p_id and empresa_id = public.minha_empresa() and cancelado_em is null;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
end; $$;

-- A empresa ativa (ou recusa) quem entrou pelo link de equipa.
create or replace function public.empresa_aprovar_estafeta(p_estafeta uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.estafetas set aprovado = true
   where id = p_estafeta and empresa_id = public.minha_empresa() and ativo;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  insert into public.audit_log (user_id, acao, detalhe) values (auth.uid(), 'estafeta_aprovado', jsonb_build_object('estafeta', p_estafeta));
end; $$;

revoke all on function public.convidar_equipa(int, int), public.cancelar_convite_equipa(uuid), public.empresa_aprovar_estafeta(uuid) from public, anon;
grant execute on function public.convidar_equipa(int, int), public.cancelar_convite_equipa(uuid), public.empresa_aprovar_estafeta(uuid) to authenticated;

-- Só o servidor valida e usa o link de equipa (cria a conta e liga-a).
create or replace function public.validar_convite_equipa(p_token text)
returns table (convite_id uuid, empresa text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, coalesce(e.nome_comercial, e.nome_legal)
    from public.estafeta_convites_equipa c join public.empresas_entrega e on e.id = c.empresa_id
   where c.token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
     and c.cancelado_em is null and c.expira_em > now() and c.usos < c.limite and e.estado = 'aprovada';
$$;

create or replace function public.ligar_estafeta_equipa(p_token text, p_user uuid, p_nome text, p_telefone text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare c record; v_estafeta uuid; v_tel text := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
begin
  if char_length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Indica o teu nome.' using errcode = '22023'; end if;
  if v_tel !~ '^\+?[0-9]{9,15}$' then raise exception 'Telefone inválido.' using errcode = '22023'; end if;
  select * into c from public.estafeta_convites_equipa
   where token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex') for update;
  if c.id is null or c.cancelado_em is not null or c.expira_em < now() or c.usos >= c.limite then
    raise exception 'Este link já não está ativo. Pede outro à tua empresa.' using errcode = '22023';
  end if;
  insert into public.estafetas (nome, telefone, empresa_id, user_id, ativo, aprovado)
  values (trim(p_nome), v_tel, c.empresa_id, p_user, true, false)
  returning id into v_estafeta;
  update public.estafeta_convites_equipa set usos = usos + 1 where id = c.id;
  insert into public.audit_log (user_id, acao, detalhe) values (p_user, 'estafeta_convite_equipa_aceite',
    jsonb_build_object('estafeta', v_estafeta, 'empresa', c.empresa_id));
  return v_estafeta;
end; $$;
revoke all on function public.validar_convite_equipa(text), public.ligar_estafeta_equipa(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.validar_convite_equipa(text), public.ligar_estafeta_equipa(text, uuid, text, text) to service_role;

-- Ofertas só para estafetas aprovados (mesmas funções da 2B, com essa condição a mais)
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
end; $$;


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
     where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
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
       where s.ativo and s.disponivel and s.user_id is not null and s.aprovado and e.estado = 'aprovada'
         and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
         and not exists (select 1 from public.entregas_ofertas f where f.order_id = o.id and f.estafeta_id = s.id);
      get diagnostics v_n = row_count;
      update public.orders set entrega_modo = 'todos' where id = o.id;
    end if;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end; $$;

-- Expurgo: links de equipa caducados ou cancelados apagam-se ao fim de 30 dias
create or replace function public.expurgar_convites_equipa() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v int;
begin
  delete from public.estafeta_convites_equipa where coalesce(cancelado_em, expira_em) < now() - interval '30 days';
  get diagnostics v = row_count;
  return v;
end; $$;
revoke all on function public.expurgar_convites_equipa() from public, anon, authenticated;
select cron.schedule('expurgar-convites-equipa', '25 4 * * *', 'select public.expurgar_convites_equipa()');

-- 2. "As minhas entregas" — só as do próprio estafeta, concluídas, das últimas N semanas.
create or replace function public.minhas_entregas(p_semanas int default 8)
returns table (numero bigint, data timestamptz, distancia_km numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.numero, o.atualizado_em, o.distancia_km
    from public.orders o
   where o.estafeta_id = public.meu_estafeta()
     and o.entrega_estado = 'entregue'
     and o.atualizado_em >= date_trunc('week', now()) - make_interval(weeks => least(greatest(p_semanas, 1), 26) - 1)
   order by o.atualizado_em desc;
$$;
revoke all on function public.minhas_entregas(int) from public, anon;
grant execute on function public.minhas_entregas(int) to authenticated;

commit;
