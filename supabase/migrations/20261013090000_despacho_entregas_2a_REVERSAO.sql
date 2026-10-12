-- Reverte 20261013090000_despacho_entregas_2a.sql. Apaga ofertas, convites e acessos de empresas.
-- As contas em auth.users de empresas/estafetas apagam-se à parte (Authentication → Users).
begin;
select cron.unschedule('expirar-chamadas-entrega');
select cron.unschedule('expurgar-despacho');
alter publication supabase_realtime drop table public.entregas_ofertas;
drop function if exists public.expurgar_despacho(), public.entregas_da_minha_empresa(date), public.empresa_desativar_estafeta(uuid),
  public.expirar_chamadas_entrega(), public.avancar_entrega(uuid), public.minha_entrega(), public.recusar_oferta(uuid),
  public.aceitar_oferta(uuid), public.chamar_estafeta(uuid), public.estafeta_disponivel(boolean),
  public.ligar_estafeta(text, uuid, text), public.admin_convidar_estafeta(uuid, text), public.validar_convite_estafeta(text), public.convidar_estafeta(text);
drop table if exists public.push_subscricoes, public.entregas_ofertas, public.estafeta_convites;
alter table public.orders drop column if exists entrega_chamada_em, drop column if exists entrega_estado,
  drop column if exists custo_entrega, drop column if exists empresa_entrega_id;
drop policy if exists "estafetas da minha empresa" on public.estafetas;
drop policy if exists "estafeta proprio" on public.estafetas;
drop function if exists public.meu_estafeta();
alter table public.estafetas drop column if exists disponivel_desde, drop column if exists disponivel, drop column if exists user_id;
drop table if exists public.empresa_utilizadores;
drop function if exists public.minha_empresa_info(), public.minha_empresa();
update public.definicoes set valor = valor - 'despacho_modo' - 'despacho_teste' - 'despacho_espera_min' where chave = 'entrega';
-- Repor as leituras antigas (abertas a qualquer sessão) só se for mesmo preciso:
drop policy if exists "produtos leitura autenticados" on public.products;
create policy "leitura equipa total" on public.products for select to authenticated using (true);
commit;
