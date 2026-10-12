-- Despacho de entregas — Fase 2A. Ata de 2026-10-12 (D5–D14).
-- RASCUNHO: não aplicar antes da aprovação do Leandro e da validação da Bea.
--
-- Opção B (decisão do Leandro, 12/10/2026, validada pela Bea): "Allow new users to sign up" e
-- "Allow anonymous sign-ins" ficam DESLIGADOS. Só o servidor (api/entregas-acesso.js, com a
-- service_role) cria contas, e só em dois momentos: o admin aprova uma empresa (convite por email)
-- ou um estafeta abre um convite válido da sua empresa.
--
-- Três tipos de utilizador, três portas que nunca se cruzam:
--   equipa   → linha em `perfis`               (e_equipa / e_admin, como hoje)
--   empresa  → linha em `empresa_utilizadores`  (minha_empresa())
--   estafeta → estafetas.user_id               (meu_estafeta())
-- Empresas e estafetas NUNCA ganham linha em `perfis`: e_equipa() abriria pedidos e clientes.
--
-- Regras fixas (art. 12.º-A CT) que este esquema impõe por construção:
--   · a oferta não mostra valor ao estafeta (o preço é com a empresa);
--   · recusar não deixa marca que pese em ofertas futuras (nenhuma função lê recusas);
--   · não há histórico de posições (só a actual, e só na Fase 2B);
--   · ninguém da equipa escolhe o estafeta: chama-se, e quem aceita primeiro leva.

begin;

-- 0. Fechar o que estava aberto a QUALQUER sessão autenticada (qual = true).
--    Até hoje só a equipa tinha sessão; a partir desta fase, empresas e estafetas também têm,
--    e não podem ler fichas técnicas, stock nem produtos fora da ementa pública.
drop policy if exists "leitura equipa total" on public.products;
create policy "produtos leitura autenticados" on public.products for select to authenticated
  using ((select public.e_equipa()) or exclusiva_beta = false);
drop policy if exists "stock_items leitura equipa" on public.stock_items;
create policy "stock_items leitura equipa" on public.stock_items for select to authenticated using ((select public.e_equipa()));
drop policy if exists "stock_mov leitura equipa" on public.stock_movements;
create policy "stock_mov leitura equipa" on public.stock_movements for select to authenticated using ((select public.e_equipa()));
drop policy if exists "stock_receitas leitura equipa" on public.stock_receitas;
create policy "stock_receitas leitura equipa" on public.stock_receitas for select to authenticated using ((select public.e_equipa()));

-- 1. Acesso da empresa ao portal (login por link de email)
create table public.empresa_utilizadores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas_entrega(id) on delete cascade,
  criado_em  timestamptz not null default now()
);
alter table public.empresa_utilizadores enable row level security;
revoke all on public.empresa_utilizadores from anon;
create policy "empresa utilizadores admin" on public.empresa_utilizadores for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));
create policy "empresa utilizadores proprio" on public.empresa_utilizadores for select to authenticated
  using (user_id = auth.uid());

create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select u.empresa_id from public.empresa_utilizadores u
    join public.empresas_entrega e on e.id = u.empresa_id
   where u.user_id = auth.uid() and e.estado in ('aprovada','suspensa');
$$;

-- A associação conta ↔ empresa é feita pelo servidor (service_role) quando o admin
-- carrega em "Convidar para o portal". Não há função pública para isto.

-- O que a empresa pode saber de si própria (a tabela empresas_entrega é só do admin).
create or replace function public.minha_empresa_info()
returns table (nome text, estado text, tarifa_base numeric, tarifa_km numeric, acordo_dados boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(e.nome_comercial, e.nome_legal), e.estado, e.tarifa_base, e.tarifa_km,
         e.acordo_dados_assinado_em is not null
    from public.empresas_entrega e where e.id = public.minha_empresa();
$$;
revoke all on function public.minha_empresa_info() from public, anon;
grant execute on function public.minha_empresa_info() to authenticated;

-- 2. Estafetas: conta própria (criada pelo servidor ao abrir o convite) e disponibilidade
alter table public.estafetas
  add column user_id uuid unique references auth.users(id) on delete set null,
  add column disponivel boolean not null default false,
  add column disponivel_desde timestamptz;

create or replace function public.meu_estafeta() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
   where s.user_id = auth.uid() and s.ativo and e.estado = 'aprovada';
$$;

-- A empresa vê e gere os seus estafetas; o estafeta vê-se a si próprio.
create policy "estafetas da minha empresa" on public.estafetas for select to authenticated
  using (empresa_id is not null and empresa_id = (select public.minha_empresa()));
create policy "estafeta proprio" on public.estafetas for select to authenticated
  using (user_id = auth.uid());

-- 3. Convites de estafeta (emitidos pela empresa; token mostrado uma vez, guardado em hash)
create table public.estafeta_convites (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas_entrega(id) on delete cascade,
  nome        text not null check (char_length(nome) between 2 and 120),
  token_hash  text not null unique,
  expira_em   timestamptz not null default now() + interval '72 hours',
  usado_em    timestamptz,
  estafeta_id uuid references public.estafetas(id) on delete set null,
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);
alter table public.estafeta_convites enable row level security;
revoke all on public.estafeta_convites from anon;
create policy "convites admin" on public.estafeta_convites for select to authenticated using ((select public.e_admin()));
create policy "convites da minha empresa" on public.estafeta_convites for select to authenticated
  using (empresa_id = (select public.minha_empresa()));

create or replace function public.convidar_estafeta(p_nome text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_empresa uuid := public.minha_empresa(); v_token text;
begin
  if v_empresa is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if (select estado from public.empresas_entrega where id = v_empresa) <> 'aprovada' then
    raise exception 'A empresa não está aprovada.' using errcode = '42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := translate(v_token, '+/=', '-_');
  insert into public.estafeta_convites (empresa_id, nome, token_hash, criado_por)
  values (v_empresa, trim(p_nome), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token; -- única vez que o token existe em claro
end; $$;
revoke all on function public.convidar_estafeta(text) from public, anon;
grant execute on function public.convidar_estafeta(text) to authenticated;

-- O admin também pode emitir convites: para a empresa de simulação (testes) e para
-- apoiar uma empresa que ainda não entrou no portal.
create or replace function public.admin_convidar_estafeta(p_empresa uuid, p_nome text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_token text;
begin
  if not public.e_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if (select estado from public.empresas_entrega where id = p_empresa) is distinct from 'aprovada' then
    raise exception 'A empresa não está aprovada.' using errcode = '22023';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.estafeta_convites (empresa_id, nome, token_hash, criado_por)
  values (p_empresa, trim(p_nome), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());
  insert into public.audit_log (user_id, acao, detalhe) values (auth.uid(), 'estafeta_convite_admin', jsonb_build_object('empresa', p_empresa));
  return v_token;
end; $$;
revoke all on function public.admin_convidar_estafeta(uuid, text) from public, anon;
grant execute on function public.admin_convidar_estafeta(uuid, text) to authenticated;

-- O estafeta abre o convite; o SERVIDOR valida, cria a conta e liga-a. Duas funções, ambas
-- executáveis só pela service_role (nunca por anon/authenticated).
create or replace function public.validar_convite_estafeta(p_token text)
returns table (convite_id uuid, nome text, empresa text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.nome, coalesce(e.nome_comercial, e.nome_legal)
    from public.estafeta_convites c join public.empresas_entrega e on e.id = c.empresa_id
   where c.token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
     and c.usado_em is null and c.expira_em > now() and e.estado = 'aprovada';
$$;

create or replace function public.ligar_estafeta(p_token text, p_user uuid, p_telefone text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare c record; v_estafeta uuid; v_tel text := regexp_replace(coalesce(p_telefone,''), '[^0-9+]', '', 'g');
begin
  if v_tel !~ '^\+?[0-9]{9,15}$' then raise exception 'Telefone inválido.' using errcode = '22023'; end if;
  select * into c from public.estafeta_convites
   where token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex') for update;
  if c.id is null or c.usado_em is not null or c.expira_em < now() then
    raise exception 'Convite inválido ou expirado. Peça um novo à sua empresa.' using errcode = '22023';
  end if;
  insert into public.estafetas (nome, telefone, empresa_id, user_id, ativo)
  values (c.nome, v_tel, c.empresa_id, p_user, true)
  returning id into v_estafeta;
  update public.estafeta_convites set usado_em = now(), estafeta_id = v_estafeta where id = c.id;
  insert into public.audit_log (user_id, acao, detalhe) values (p_user, 'estafeta_convite_aceite',
    jsonb_build_object('estafeta', v_estafeta, 'empresa', c.empresa_id));
  return v_estafeta;
end; $$;
revoke all on function public.validar_convite_estafeta(text), public.ligar_estafeta(text, uuid, text) from public, anon, authenticated;
grant execute on function public.validar_convite_estafeta(text), public.ligar_estafeta(text, uuid, text) to service_role;

create or replace function public.estafeta_disponivel(p_disponivel boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid := public.meu_estafeta();
begin
  if v is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.estafetas set disponivel = p_disponivel,
         disponivel_desde = case when p_disponivel then now() else null end
   where id = v;
end; $$;
revoke all on function public.estafeta_disponivel(boolean) from public, anon;
grant execute on function public.estafeta_disponivel(boolean) to authenticated;

-- 4. Estado da entrega e custo congelado na encomenda
alter table public.orders
  add column empresa_entrega_id  uuid references public.empresas_entrega(id),
  add column custo_entrega       numeric(8,2),
  add column entrega_estado      text check (entrega_estado in ('a_chamar','aceite','recolhido','entregue','sem_estafeta','cancelada')),
  add column entrega_chamada_em  timestamptz;

-- 5. Ofertas
create table public.entregas_ofertas (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  estafeta_id   uuid not null references public.estafetas(id) on delete cascade,
  estado        text not null default 'oferecida' check (estado in ('oferecida','aceite','recusada','expirada','cancelada')),
  distancia_km  numeric(6,2),
  criado_em     timestamptz not null default now(),
  respondido_em timestamptz,
  unique (order_id, estafeta_id)
);
create index on public.entregas_ofertas (estafeta_id, estado);
alter table public.entregas_ofertas enable row level security;
revoke all on public.entregas_ofertas from anon;
create policy "ofertas equipa" on public.entregas_ofertas for select to authenticated using ((select public.e_equipa()));
-- O estafeta lê as suas (é isto que o Realtime usa para o avisar).
create policy "ofertas proprias" on public.entregas_ofertas for select to authenticated
  using (estafeta_id = (select public.meu_estafeta()));

-- Modo de teste: com `despacho_teste` ligado, só os estafetas de empresas de SIMULAÇÃO
-- recebem ofertas; desligado, só os de empresas reais com acordo art. 28.º assinado.
-- Uma encomenda real nunca chega a uma empresa de simulação, e vice-versa.
update public.definicoes set valor = valor || '{"despacho_modo":"todos","despacho_teste":true,"despacho_espera_min":5}'::jsonb
 where chave = 'entrega';

create or replace function public.chamar_estafeta(p_order uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare o record; cfg jsonb; v_teste boolean; v_n int;
begin
  if not public.e_equipa() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select valor into cfg from public.definicoes where chave = 'entrega';
  v_teste := coalesce((cfg->>'despacho_teste')::boolean, true);
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.tipo_entrega <> 'entrega' then raise exception 'Encomenda sem entrega.' using errcode = '22023'; end if;
  if o.entrega_estado in ('aceite','recolhido','entregue') then raise exception 'Esta entrega já tem estafeta.' using errcode = '22023'; end if;

  update public.entregas_ofertas set estado = 'expirada', respondido_em = now()
   where order_id = p_order and estado = 'oferecida';

  insert into public.entregas_ofertas (order_id, estafeta_id, distancia_km)
  select p_order, s.id, o.distancia_km
    from public.estafetas s join public.empresas_entrega e on e.id = s.empresa_id
   where s.ativo and s.disponivel and s.user_id is not null and e.estado = 'aprovada'
     and (case when v_teste then e.simulacao else (not e.simulacao and e.acordo_dados_assinado_em is not null) end)
  on conflict (order_id, estafeta_id) do update set estado = 'oferecida', criado_em = now(), respondido_em = null;
  get diagnostics v_n = row_count;

  update public.orders set entrega_estado = case when v_n > 0 then 'a_chamar' else 'sem_estafeta' end,
         entrega_chamada_em = now() where id = p_order;
  return v_n;
end; $$;
revoke all on function public.chamar_estafeta(uuid) from public, anon;
grant execute on function public.chamar_estafeta(uuid) to authenticated;

-- Primeiro a aceitar fica com a entrega. O custo é congelado com o preço da empresa nesse momento.
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

create or replace function public.recusar_oferta(p_oferta uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.entregas_ofertas set estado = 'recusada', respondido_em = now()
   where id = p_oferta and estafeta_id = public.meu_estafeta() and estado = 'oferecida';
end; $$;

-- Dados mínimos da entrega, só para o estafeta que a aceitou e só até estar entregue.
create or replace function public.minha_entrega() returns table (
  order_id uuid, numero bigint, cliente_nome text, cliente_telefone text, morada text,
  distancia_km numeric, pago boolean, entrega_estado text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id, o.numero, o.cliente_nome, o.cliente_telefone, o.morada, o.distancia_km,
         o.estado_pagamento = 'pago', o.entrega_estado
    from public.orders o
   where o.estafeta_id = public.meu_estafeta() and o.entrega_estado in ('aceite','recolhido');
$$;

create or replace function public.avancar_entrega(p_order uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare o record;
begin
  select * into o from public.orders where id = p_order and estafeta_id = public.meu_estafeta() for update;
  if o.id is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if o.entrega_estado = 'aceite' then
    update public.orders set entrega_estado = 'recolhido', estado = 'a_caminho' where id = p_order;
    return 'recolhido';
  elsif o.entrega_estado = 'recolhido' then
    update public.orders set entrega_estado = 'entregue', estado = 'entregue' where id = p_order;
    return 'entregue';
  end if;
  raise exception 'Estado inválido.' using errcode = '22023';
end; $$;

revoke all on function public.aceitar_oferta(uuid), public.recusar_oferta(uuid), public.minha_entrega(), public.avancar_entrega(uuid) from public, anon;
grant execute on function public.aceitar_oferta(uuid), public.recusar_oferta(uuid), public.minha_entrega(), public.avancar_entrega(uuid) to authenticated;

-- 6. Ninguém aceitou em N minutos → sem_estafeta (o Staff mostra o alerta; push ao Leandro via API)
create or replace function public.expirar_chamadas_entrega() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int; v_min int := coalesce((select (valor->>'despacho_espera_min')::int from public.definicoes where chave='entrega'), 5);
begin
  with x as (
    update public.orders set entrega_estado = 'sem_estafeta'
     where entrega_estado = 'a_chamar' and entrega_chamada_em < now() - make_interval(mins => v_min)
    returning id)
  select count(*) into v_n from x;
  update public.entregas_ofertas f set estado = 'expirada', respondido_em = now()
    from public.orders o where o.id = f.order_id and o.entrega_estado = 'sem_estafeta' and f.estado = 'oferecida';
  return v_n;
end; $$;
revoke all on function public.expirar_chamadas_entrega() from public, anon, authenticated;
select cron.schedule('expirar-chamadas-entrega', '* * * * *', 'select public.expirar_chamadas_entrega()');

-- 7. Subscrições de notificações (Web Push)
create table public.push_subscricoes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  endpoint  text not null unique,
  p256dh    text not null,
  auth      text not null,
  criado_em timestamptz not null default now()
);
alter table public.push_subscricoes enable row level security;
revoke all on public.push_subscricoes from anon;
create policy "push proprias" on public.push_subscricoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7b. Empresa: desativar um estafeta (telemóvel perdido, saída). A conta é apagada pelo servidor.
create or replace function public.empresa_desativar_estafeta(p_estafeta uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  select user_id into v_user from public.estafetas
   where id = p_estafeta and empresa_id = public.minha_empresa() for update;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.estafetas set ativo = false, disponivel = false, disponivel_desde = null, user_id = null
   where id = p_estafeta;
  update public.entregas_ofertas set estado = 'cancelada', respondido_em = now()
   where estafeta_id = p_estafeta and estado = 'oferecida';
  insert into public.audit_log (user_id, acao, detalhe) values (auth.uid(), 'estafeta_desativado',
    jsonb_build_object('estafeta', p_estafeta));
  return v_user; -- o servidor usa isto para apagar a conta em auth.users
end; $$;
revoke all on function public.empresa_desativar_estafeta(uuid) from public, anon;
grant execute on function public.empresa_desativar_estafeta(uuid) to authenticated;

-- 7c. Empresa: as suas entregas de um mês, SEM dados de clientes (para conferir a fatura).
create or replace function public.entregas_da_minha_empresa(p_mes date)
returns table (numero bigint, data timestamptz, estafeta text, distancia_km numeric, custo numeric, estado text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.numero, o.criado_em, s.nome, o.distancia_km, o.custo_entrega, o.entrega_estado
    from public.orders o left join public.estafetas s on s.id = o.estafeta_id
   where o.empresa_entrega_id = public.minha_empresa()
     and o.criado_em >= date_trunc('month', p_mes) and o.criado_em < date_trunc('month', p_mes) + interval '1 month'
   order by o.criado_em;
$$;
revoke all on function public.entregas_da_minha_empresa(date) from public, anon;
grant execute on function public.entregas_da_minha_empresa(date) to authenticated;

-- 7d. Conservação (Bea): recusas e ofertas não aceites apagam-se ao fim de 7 dias — não pode
-- existir um histórico de recusas que alguém venha a usar para avaliar estafetas.
-- Convites usados ou caducados apagam-se ao fim de 30 dias.
create or replace function public.expurgar_despacho() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v1 int; v2 int;
begin
  with a as (delete from public.entregas_ofertas where estado <> 'aceite' and criado_em < now() - interval '7 days' returning 1)
  select count(*) into v1 from a;
  with b as (delete from public.estafeta_convites where coalesce(usado_em, expira_em) < now() - interval '30 days' returning 1)
  select count(*) into v2 from b;
  if v1 + v2 > 0 then
    insert into public.audit_log (acao, detalhe) values ('despacho_expurgado', jsonb_build_object('ofertas', v1, 'convites', v2));
  end if;
  return v1 + v2;
end; $$;
revoke all on function public.expurgar_despacho() from public, anon, authenticated;
select cron.schedule('expurgar-despacho', '15 4 * * *', 'select public.expurgar_despacho()');

-- 8. Realtime para o estafeta e para o Staff
alter publication supabase_realtime add table public.entregas_ofertas;

commit;
