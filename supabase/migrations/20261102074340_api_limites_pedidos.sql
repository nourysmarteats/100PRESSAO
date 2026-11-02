-- Limites de pedidos das APIs públicas (Bea, 2 Nov 2026). Só o servidor usa.
-- A chave é sempre um HMAC (IP ou telemóvel) ou o UUID da encomenda; conservação máx. 24 h.
create table if not exists public.api_limites (
  id bigint generated always as identity primary key,
  acao text not null,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index if not exists api_limites_acao_chave_em on public.api_limites (acao, chave, criado_em desc);
alter table public.api_limites enable row level security;
revoke all on public.api_limites from public, anon, authenticated;

create or replace function public.api_dentro_do_limite(p_acao text, p_chave text, p_limite integer, p_janela_seg integer)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_acao is null or p_chave is null or p_limite is null or p_limite < 1
     or p_janela_seg is null or p_janela_seg not between 1 and 86400 then
    raise exception 'Parâmetros de limite inválidos' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_acao || ':' || p_chave));
  if random() < 0.02 then
    delete from public.api_limites where criado_em < now() - interval '24 hours';
  end if;
  if (select count(*) from public.api_limites
      where acao = p_acao and chave = p_chave
        and criado_em > now() - make_interval(secs => p_janela_seg)) >= p_limite then
    return false;
  end if;
  insert into public.api_limites (acao, chave) values (p_acao, p_chave);
  return true;
end
$function$;
revoke all on function public.api_dentro_do_limite(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.api_dentro_do_limite(text, text, integer, integer) to service_role;
