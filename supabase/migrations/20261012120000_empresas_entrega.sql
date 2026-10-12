-- Empresas de entrega (operadores de frota) — Fase 1: registo, aprovação, simulação.
--
-- Origem: ata de 2026-10-12 (vault 100PRESSÃO, Operações/Ata-Reuniao-Delivery-2026-10-12.md).
--   D3  o 100PRESSÃO nunca paga directamente a estafetas;
--   D4  as empresas registam-se elas próprias e o admin aprova; há uma empresa de simulação;
--   D6  o preço é negociado com a EMPRESA, nunca por estafeta.
--
-- Só acréscimos, com uma excepção deliberada: a leitura de `estafetas` deixa de estar
-- aberta a toda a equipa (achado repetido da Bea, 2026-09-28 e 2026-10-05).
-- Reversão: 20261012120000_empresas_entrega_REVERSAO.sql
--
-- Porque é que as empresas NÃO ganham linha em `perfis`: e_equipa() devolve true a
-- qualquer linha activa em `perfis`, e e_equipa() abre pedidos e clientes. Um acesso
-- externo nunca pode passar por ali. O portal da empresa (Fase 2) terá tabela própria.

begin;

-- 1. NIF/NIPC — o mesmo algoritmo de src/lib/nif.js, no servidor.
create or replace function public.nif_valido(p text)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  s int := 0;
  r int;
begin
  if p is null or p !~ '^[1-9][0-9]{8}$' then
    return false;
  end if;
  for i in 1..8 loop
    s := s + substr(p, i, 1)::int * (10 - i);
  end loop;
  r := s % 11;
  return substr(p, 9, 1)::int = case when r < 2 then 0 else 11 - r end;
end;
$$;

-- 2. Empresas
create table public.empresas_entrega (
  id                        uuid primary key default gen_random_uuid(),
  nome_legal                text not null check (char_length(nome_legal) between 2 and 160),
  nome_comercial            text check (nome_comercial is null or char_length(nome_comercial) <= 120),
  nipc                      text not null check (public.nif_valido(nipc)),
  -- Pessoa de contacto: dados pessoais. Ficam a null quando o prazo de conservação acaba.
  contacto_nome             text check (contacto_nome is null or char_length(contacto_nome) between 2 and 120),
  contacto_email            text check (contacto_email is null or contacto_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  contacto_telefone         text check (contacto_telefone is null or contacto_telefone ~ '^\+?[0-9]{9,15}$'),
  n_estafetas               int  check (n_estafetas is null or n_estafetas between 0 and 500),
  zona                      text check (zona is null or char_length(zona) <= 300),
  -- Preço: a empresa propõe no registo; o admin fixa o acordado na aprovação.
  tarifa_proposta_base      numeric(6,2) not null check (tarifa_proposta_base between 0 and 50),
  tarifa_proposta_km        numeric(6,2) not null check (tarifa_proposta_km between 0 and 10),
  tarifa_base               numeric(6,2) check (tarifa_base is null or tarifa_base between 0 and 50),
  tarifa_km                 numeric(6,2) check (tarifa_km is null or tarifa_km between 0 and 10),
  estado                    text not null default 'pendente'
                            check (estado in ('pendente','aprovada','rejeitada','suspensa','terminada')),
  motivo_decisao            text check (motivo_decisao is null or char_length(motivo_decisao) <= 500),
  decidido_em               timestamptz,
  decidido_por              uuid,
  -- Prova de aceitação: versões carimbadas pelo servidor, nunca vindas do cliente.
  termos_versao             text not null,
  aviso_versao              text not null,
  aceitou_termos_em         timestamptz not null,
  -- Contrato e acordo art. 28.º RGPD. Sem acordo assinado, nenhum dado de cliente
  -- segue para a empresa (regra aplicada no despacho, Fase 2).
  contrato_assinado_em      date,
  acordo_dados_assinado_em  date,
  simulacao                 boolean not null default false,
  ip_hash                   text,
  expira_em                 date,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  constraint empresa_aprovada_tem_tarifa
    check (estado <> 'aprovada' or (tarifa_base is not null and tarifa_km is not null))
);

-- Um NIPC só pode ter um registo vivo de cada vez.
create unique index empresas_entrega_nipc_vivo
  on public.empresas_entrega (nipc)
  where estado in ('pendente','aprovada','suspensa');

comment on table public.empresas_entrega is
  'Operadores de frota que fazem as entregas do restaurante online. Ata 2026-10-12.';

-- 3. Prazos de conservação (decididos pela Bea, 2026-10-12)
--    pendente sem decisão  → 6 meses após o registo, apaga-se
--    rejeitada             → 90 dias após a decisão, apaga-se
--    terminada             → 2 anos após a decisão, anonimiza-se a pessoa de contacto
--    aprovada / suspensa   → sem prazo enquanto a relação dura
--    simulação             → nunca expira
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

create trigger empresas_entrega_antes
  before insert or update on public.empresas_entrega
  for each row execute function public.empresa_entrega_antes();

create trigger empresas_entrega_touch
  before update on public.empresas_entrega
  for each row execute function public.touch_atualizado_em();

-- Auditoria de decisões e de mudanças de preço. Só identificadores e valores — nunca
-- o nome nem o contacto da pessoa (regra 5 do CLAUDE.md).
create or replace function public.empresa_entrega_auditar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
end;
$$;

create trigger empresas_entrega_auditar
  after update on public.empresas_entrega
  for each row execute function public.empresa_entrega_auditar();

-- 4. Acessos: só o admin. O registo público passa pela função abaixo.
alter table public.empresas_entrega enable row level security;
revoke all on public.empresas_entrega from anon;

create policy "empresas entrega admin"
  on public.empresas_entrega for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

-- 5. Limite de submissões por ligação
create table public.empresas_entrega_limites (
  id        bigint generated always as identity primary key,
  ip_hash   text not null,
  criado_em timestamptz not null default now()
);
create index on public.empresas_entrega_limites (ip_hash, criado_em);
alter table public.empresas_entrega_limites enable row level security;
revoke all on public.empresas_entrega_limites from anon, authenticated;

-- O segredo do HMAC vai para o Vault e não para `definicoes`: `definicoes` tem
-- leitura pública, e um segredo legível deixa reconstruir o IP a partir do hash.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'empresas_entrega_segredo_ip',
  'HMAC do IP no registo público de empresas de entrega');

-- 6. Configuração
insert into public.definicoes (chave, valor) values ('empresas_entrega', jsonb_build_object(
  'registo_aberto', true,
  'tecto_diario',   20,
  'limite_ip_hora', 3,
  'termos_versao',  '2026-10-12.v1',
  'aviso_versao',   '2026-10-12.v1'
));

-- 7. Registo público
create or replace function public.registar_empresa_entrega(
  p_nome_legal        text,
  p_nome_comercial    text,
  p_nipc              text,
  p_contacto_nome     text,
  p_contacto_email    text,
  p_contacto_telefone text,
  p_n_estafetas       int,
  p_zona              text,
  p_tarifa_base       numeric,
  p_tarifa_km         numeric,
  p_aceita_termos     boolean,
  p_aviso_lido        boolean
)
returns table (id uuid, estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg   jsonb;
  h     jsonb;
  ip    text;
  seg   text;
  marca text;
  v_nipc text := regexp_replace(coalesce(p_nipc, ''), '\D', '', 'g');
  v_tel  text := regexp_replace(coalesce(p_contacto_telefone, ''), '[^0-9+]', '', 'g');
  v_id   uuid;
begin
  select valor into cfg from public.definicoes where chave = 'empresas_entrega';
  if cfg is null or not coalesce((cfg->>'registo_aberto')::boolean, false) then
    raise exception 'O registo de empresas de entrega está fechado.' using errcode = '22023';
  end if;
  if not coalesce(p_aceita_termos, false) or not coalesce(p_aviso_lido, false) then
    raise exception 'É preciso aceitar as condições e confirmar a leitura do aviso de privacidade.' using errcode = '22023';
  end if;
  if not public.nif_valido(v_nipc) then
    raise exception 'O NIPC não é válido.' using errcode = '22023';
  end if;
  if coalesce(trim(p_contacto_nome), '') = '' or coalesce(trim(p_contacto_email), '') = '' or v_tel = '' then
    raise exception 'Faltam os dados da pessoa de contacto.' using errcode = '22023';
  end if;
  if exists (select 1 from public.empresas_entrega e
              where e.nipc = v_nipc and e.estado in ('pendente','aprovada','suspensa')) then
    raise exception 'Já existe um registo activo para este NIPC.' using errcode = '23505';
  end if;

  -- IP vindo do gateway; nunca aceite do cliente.
  h  := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  ip := coalesce(nullif(split_part(h->>'x-forwarded-for', ',', 1), ''), nullif(h->>'x-real-ip', ''), 'sem-origem');
  select decrypted_secret into seg from vault.decrypted_secrets where name = 'empresas_entrega_segredo_ip';
  marca := encode(extensions.hmac(ip, seg, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(821942);
  if (select count(*) from public.empresas_entrega_limites l
       where l.ip_hash = marca and l.criado_em > clock_timestamp() - interval '1 hour')
     >= coalesce((cfg->>'limite_ip_hora')::int, 3) then
    raise exception 'Recebemos vários registos desta ligação há pouco. Tenta mais tarde.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.empresas_entrega_limites l
       where l.criado_em > clock_timestamp() - interval '24 hours')
     >= coalesce((cfg->>'tecto_diario')::int, 20) then
    raise exception 'O registo atingiu o limite diário. Tenta amanhã.' using errcode = 'P0001';
  end if;
  insert into public.empresas_entrega_limites (ip_hash) values (marca);

  insert into public.empresas_entrega (
    nome_legal, nome_comercial, nipc,
    contacto_nome, contacto_email, contacto_telefone,
    n_estafetas, zona, tarifa_proposta_base, tarifa_proposta_km,
    termos_versao, aviso_versao, aceitou_termos_em, ip_hash)
  values (
    trim(p_nome_legal), nullif(trim(p_nome_comercial), ''), v_nipc,
    trim(p_contacto_nome), lower(trim(p_contacto_email)), v_tel,
    p_n_estafetas, nullif(trim(p_zona), ''), round(p_tarifa_base, 2), round(p_tarifa_km, 2),
    cfg->>'termos_versao', cfg->>'aviso_versao', now(), marca)
  returning empresas_entrega.id into v_id;

  insert into public.audit_log (acao, detalhe)
  values ('empresa_entrega_registada', jsonb_build_object('id', v_id));

  return query select v_id, 'pendente'::text;
end;
$$;

revoke all on function public.registar_empresa_entrega(text,text,text,text,text,text,int,text,numeric,numeric,boolean,boolean) from public;
grant execute on function public.registar_empresa_entrega(text,text,text,text,text,text,int,text,numeric,numeric,boolean,boolean) to anon, authenticated;

-- 8. Expurgo
create or replace function public.expurgar_empresas_entrega()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_apagadas int;
  v_anonim   int;
begin
  with a as (
    delete from public.empresas_entrega
     where expira_em < current_date and estado in ('pendente','rejeitada') and not simulacao
    returning 1)
  select count(*) into v_apagadas from a;

  with b as (
    update public.empresas_entrega
       set contacto_nome = null, contacto_email = null, contacto_telefone = null,
           ip_hash = null, expira_em = null
     where expira_em < current_date and estado = 'terminada' and not simulacao
    returning 1)
  select count(*) into v_anonim from b;

  delete from public.empresas_entrega_limites where criado_em < now() - interval '2 days';

  if v_apagadas + v_anonim > 0 then
    insert into public.audit_log (acao, detalhe)
    values ('empresas_entrega_expurgadas',
            jsonb_build_object('apagadas', v_apagadas, 'anonimizadas', v_anonim));
  end if;
  return v_apagadas + v_anonim;
end;
$$;

revoke all on function public.expurgar_empresas_entrega() from public, anon, authenticated;

select cron.schedule('expurgar-empresas-entrega', '5 4 * * *', 'select public.expurgar_empresas_entrega()');

-- 9. Estafetas passam a pertencer a uma empresa
alter table public.estafetas
  add column empresa_id uuid references public.empresas_entrega(id) on delete restrict;
create index on public.estafetas (empresa_id);

-- Achado da Bea: NIF, telefone, email e posição de estafetas legíveis por toda a equipa.
drop policy if exists "estafetas leitura equipa" on public.estafetas;

-- 10. Empresa de simulação (D4). NIPC fictício com dígito de controlo válido.
insert into public.empresas_entrega (
  nome_legal, nome_comercial, nipc,
  contacto_nome, contacto_email, contacto_telefone,
  n_estafetas, zona,
  tarifa_proposta_base, tarifa_proposta_km, tarifa_base, tarifa_km,
  estado, motivo_decisao,
  termos_versao, aviso_versao, aceitou_termos_em,
  simulacao)
values (
  'Empresa de Simulação de Entregas (TESTE)', 'Simulação', '599999993',
  'Equipa 100PRESSÃO', 'equipa@100pressao.pt', null,
  2, 'Carnaxide, Algés, Linda-a-Velha (simulação)',
  2.00, 0.40, 2.00, 0.40,
  'aprovada', 'Empresa de simulação para testes (ata 2026-10-12, D4).',
  'simulacao', 'simulacao', now(),
  true);

commit;
