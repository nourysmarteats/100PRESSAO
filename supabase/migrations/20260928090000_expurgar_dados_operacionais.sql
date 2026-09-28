-- Cumpre os prazos da Política de Privacidade (27/09/2026):
--   pedidos à mesa sem fatura: dados pessoais até 12 meses (anonimiza, mantém a venda para as contas)
--   feedback: até 2 anos (apaga)
-- Encomendas online e pedidos com fatura ficam 10 anos (obrigação fiscal) e não são tocados.
-- Aplicada em produção a 28/09/2026. Corre todos os dias às 03:45 (pg_cron).
create or replace function public.expurgar_dados_operacionais()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sessoes int;
  v_pedidos int;
  v_feedback int;
begin
  with alvo as (
    select s.id from public.sessions s
     where s.criado_em < now() - interval '12 months'
       and s.nome_cliente <> '(anonimizado)'
       and not exists (
         select 1 from public.orders o
          where o.session_id = s.id
            and (o.fatura_documento_id is not null or o.canal = 'online'))
  ), upd as (
    update public.sessions s set nome_cliente = '(anonimizado)'
      from alvo where s.id = alvo.id
    returning 1
  )
  select count(*) into v_sessoes from upd;

  with upd as (
    update public.orders o
       set cliente_nome = null, cliente_telefone = null, cliente_email = null
     where o.criado_em < now() - interval '12 months'
       and coalesce(o.canal, '') <> 'online'
       and o.fatura_documento_id is null
       and (o.cliente_nome is not null or o.cliente_telefone is not null or o.cliente_email is not null)
    returning 1
  )
  select count(*) into v_pedidos from upd;

  with del as (
    delete from public.feedback where criado_em < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_feedback from del;

  if v_sessoes + v_pedidos + v_feedback > 0 then
    insert into public.audit_log (acao, detalhe)
    values ('dados_operacionais_expurgados',
            jsonb_build_object('sessoes_anonimizadas', v_sessoes, 'pedidos_anonimizados', v_pedidos, 'feedback_apagado', v_feedback));
  end if;

  return jsonb_build_object('sessoes', v_sessoes, 'pedidos', v_pedidos, 'feedback', v_feedback);
end;
$$;

revoke all on function public.expurgar_dados_operacionais() from public, anon, authenticated;

select cron.schedule('expurgar-dados-operacionais', '45 3 * * *', 'select public.expurgar_dados_operacionais()');
