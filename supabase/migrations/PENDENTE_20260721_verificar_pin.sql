-- 100PRESSÃO — Fechar a exposição de pin_hash
-- Autor: Daniel Cunha  |  Validação pendente: Bea Salgado
-- Estado: NÃO APLICADO. Requer o patch de src/pages/equipa/EquipaLayout.jsx
--         (docs/og/../pin/PENDENTE-pingate.patch) no MESMO deploy.
--
-- ORDEM DE APLICAÇÃO OBRIGATÓRIA
--   1. Aplicar esta migração (cria a RPC; ainda não fecha nada).
--   2. Fazer deploy do patch do PinGate.
--   3. Confirmar que o PIN funciona em produção com os dois perfis activos.
--   4. Só então correr a secção FINAL, no fundo deste ficheiro, que fecha
--      a leitura de perfis e revoga o pin_hash.
--   Inverter esta ordem tranca a equipa fora do balcão.
--
-- NOTA SOBRE O ESQUEMA DE HASH
--   O hash actual é sha256('<user_id>:<pin>'), sem sal e sem KDF — ver
--   api/equipa.js:8. Esta migração MANTÉM esse esquema de propósito, para
--   não obrigar a redefinir os PINs de toda a equipa no mesmo dia. O ganho
--   aqui é o hash deixar de sair da base de dados. Endurecer o esquema
--   (bcrypt via pgcrypto crypt()/gen_salt) fica para uma segunda fase, e
--   nessa altura os PINs têm de ser redefinidos um a um.

begin;

-- ---------------------------------------------------------------------------
-- 1. Travão de força bruta
-- ---------------------------------------------------------------------------
-- Um PIN de 4 dígitos são 10 000 combinações. Sem travão, qualquer conta
-- autenticada percorre o espaço todo pela RPC em minutos.

create table if not exists public.pin_tentativas (
  id          bigserial primary key,
  auth_uid    uuid,
  sucesso     boolean not null,
  criado_em   timestamptz not null default now()
);

create index if not exists pin_tentativas_uid_tempo
  on public.pin_tentativas (auth_uid, criado_em desc);

alter table public.pin_tentativas enable row level security;
-- Sem políticas: ninguém lê nem escreve pela API. Só a RPC (SECURITY DEFINER)
-- lá toca.

-- ---------------------------------------------------------------------------
-- 2. RPC de verificação — o hash nunca sai da base de dados
-- ---------------------------------------------------------------------------

create or replace function public.verificar_pin(p_pin text)
returns table (id uuid, nome text, papel text)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_uid       uuid := auth.uid();
  v_falhas    int;
  v_encontrado record;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if p_pin is null or p_pin !~ '^\d{4}$' then
    raise exception 'PIN inválido' using errcode = '22023';
  end if;

  -- 10 tentativas falhadas em 15 minutos = bloqueio temporário
  select count(*) into v_falhas
    from public.pin_tentativas t
   where t.auth_uid = v_uid
     and not t.sucesso
     and t.criado_em > now() - interval '15 minutes';

  if v_falhas >= 10 then
    raise exception 'Demasiadas tentativas. Aguarda 15 minutos.'
      using errcode = '22023';
  end if;

  select p.id, p.nome, p.papel into v_encontrado
    from public.perfis p
   where p.ativo
     and p.pin_hash is not null
     and p.pin_hash = encode(digest(p.id::text || ':' || p_pin, 'sha256'), 'hex')
   limit 1;

  insert into public.pin_tentativas (auth_uid, sucesso)
  values (v_uid, v_encontrado.id is not null);

  if v_encontrado.id is null then
    return;  -- zero linhas: PIN errado (sem revelar se o utilizador existe)
  end if;

  return query select v_encontrado.id, v_encontrado.nome, v_encontrado.papel;
end;
$$;

revoke execute on function public.verificar_pin(text) from public;
grant  execute on function public.verificar_pin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Saber se há PINs definidos, sem expor os hashes
-- ---------------------------------------------------------------------------
-- O PinGate precisa disto para decidir se cai no PIN partilhado de arranque.

create or replace function public.existem_pins()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.perfis where ativo and pin_hash is not null);
$$;

revoke execute on function public.existem_pins() from public;
grant  execute on function public.existem_pins() to authenticated;

commit;


-- ===========================================================================
-- SECÇÃO FINAL — CORRER SÓ DEPOIS DO PASSO 3 DO CABEÇALHO
-- ===========================================================================
-- Descomentar e correr apenas com o patch do PinGate já em produção e o
-- login por PIN confirmado a funcionar.
--
-- begin;
--
-- drop policy if exists "perfis leitura autenticada" on public.perfis;
--
-- create policy "perfis le proprio ou admin" on public.perfis
--   for select to authenticated
--   using (id = auth.uid() or public.e_admin());
--
-- revoke select (pin_hash) on public.perfis from authenticated, anon;
--
-- commit;
--
-- REVERSÃO desta secção final:
--   drop policy if exists "perfis le proprio ou admin" on public.perfis;
--   create policy "perfis leitura autenticada" on public.perfis
--     for select to authenticated using (true);
--   grant select (pin_hash) on public.perfis to authenticated;
