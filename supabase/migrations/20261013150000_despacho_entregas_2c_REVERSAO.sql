-- Reverte 20261013150000_despacho_entregas_2c.sql. Repor depois chamar_estafeta e
-- escalar_ofertas_proximidade a partir de 20261013120000_despacho_entregas_2b.sql.
begin;
select cron.unschedule('expurgar-convites-equipa');
drop function if exists public.minhas_entregas(int), public.expurgar_convites_equipa(),
  public.ligar_estafeta_equipa(text, uuid, text, text), public.validar_convite_equipa(text),
  public.empresa_aprovar_estafeta(uuid), public.cancelar_convite_equipa(uuid), public.convidar_equipa(int, int);
drop table if exists public.estafeta_convites_equipa;
alter table public.estafetas drop column if exists aprovado;
commit;
