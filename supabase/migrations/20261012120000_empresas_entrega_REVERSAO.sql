-- Reverte 20261012120000_empresas_entrega.sql.
-- ATENÇÃO: apaga todos os registos de empresas de entrega. Exportar antes, fora da BD.
begin;
select cron.unschedule('expurgar-empresas-entrega');
create policy "estafetas leitura equipa" on public.estafetas for select to authenticated
  using ((select public.e_equipa()));
alter table public.estafetas drop column if exists empresa_id;
drop function if exists public.registar_empresa_entrega(text,text,text,text,text,text,int,text,numeric,numeric,boolean,boolean);
drop function if exists public.expurgar_empresas_entrega();
drop table if exists public.empresas_entrega_limites;
drop table if exists public.empresas_entrega;
drop function if exists public.empresa_entrega_antes();
drop function if exists public.empresa_entrega_auditar();
drop function if exists public.nif_valido(text);
delete from public.definicoes where chave = 'empresas_entrega';
delete from vault.secrets where name = 'empresas_entrega_segredo_ip';
commit;
