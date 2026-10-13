-- Reverte 20261013170000_parceiro_entregas_v2.sql: volta à função de 12 parâmetros
-- (repor a partir de 20261012120000_empresas_entrega.sql, secção 7) e às versões v1.
begin;
drop function if exists public.registar_empresa_entrega(text,text,text,text,text,text,text,int,text,text,numeric,numeric,numeric,numeric,text,boolean,boolean,boolean,boolean);
update public.definicoes set valor = valor || '{"termos_versao":"2026-10-12.v1","aviso_versao":"2026-10-12.v1"}'::jsonb where chave = 'empresas_entrega';
-- As colunas novas ficam (podem já ter dados de registos v2).
commit;
