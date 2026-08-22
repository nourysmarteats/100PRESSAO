-- 2026-08-21 — APLICADA em 2026-08-21.
-- Migrações: `agendar_expurgo_candidaturas` e `triggers_search_path_fixo`.
--
-- Fase F, primeira metade. Um prazo de conservação que depende de alguém se
-- lembrar não é um prazo — é uma frase numa política. Isto corre todos os
-- dias às 03:15 UTC, apaga candidaturas expiradas (registo e ficheiros) e
-- deixa o número no audit_log.

create extension if not exists pg_cron;

select cron.unschedule('expurgar-candidaturas')
 where exists (select 1 from cron.job where jobname = 'expurgar-candidaturas');

select cron.schedule(
  'expurgar-candidaturas',
  '15 3 * * *',
  $$select public.expurgar_candidaturas()$$
);

-- ── search_path fixo nas funções de trigger ───────────────────────────────
-- O linter de segurança do Supabase apanhou-as. Numa função de trigger o
-- search_path mutável é um vector real: quem puder criar um esquema à frente
-- pode fazer resolver outro objecto com o mesmo nome.

create or replace function public.colaborador_sincroniza_ativo()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.ativo := (new.estado = 'activo');
  return new;
end;
$$;

create or replace function public.candidatura_calcula_expiracao()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.expira_em := (coalesce(new.criado_em, now())
                    + case when new.consentimento_reserva
                           then interval '12 months' else interval '6 months' end)::date;
  return new;
end;
$$;
