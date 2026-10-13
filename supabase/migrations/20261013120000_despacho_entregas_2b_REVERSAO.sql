-- Reverte 20261013120000_despacho_entregas_2b.sql (volta ao comportamento da 2A).
-- ATENÇÃO: as funções chamar_estafeta, estafeta_disponivel e avancar_entrega têm de ser
-- repostas a partir de 20261013090000_despacho_entregas_2a.sql (secções 2–5) depois disto.
begin;
select cron.unschedule('escalar-ofertas-proximidade');
select cron.unschedule('limpar-posicoes-estafetas');
drop function if exists public.acompanhar_entrega(uuid), public.limpar_posicoes_estafetas(),
  public.escalar_ofertas_proximidade(), public.estafeta_posicao(numeric, numeric), public.distancia_km(numeric, numeric, numeric, numeric);
update public.estafetas set posicao_lat = null, posicao_lng = null, posicao_em = null;
alter table public.orders drop column if exists entrega_modo;
update public.definicoes set valor = jsonb_set(valor, '{despacho_modo}', '"todos"') where chave = 'entrega';
commit;
