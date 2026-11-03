-- Caixa: dois métodos novos de pagamento ao balcão, TPA Revolut e TPA Teya.
-- criar_pedido recusava tudo o que não estivesse na lista. Só se alarga a lista;
-- o resto da função fica igual. Aplicar antes de publicar o frontend.
-- Nos TPA o operador indica débito ou crédito: define o tipo na fatura da Vendus.
alter table public.orders
  add column if not exists tipo_cartao text
  check (tipo_cartao in ('debito', 'credito'));

do $$
declare
  antigo text := $t$p_metodo not in ('dinheiro','multibanco','mbway','cartao')$t$;
  novo   text := $t$p_metodo not in ('dinheiro','multibanco','mbway','cartao','tpa_revolut','tpa_teya')$t$;
  def    text := pg_get_functiondef('public.criar_pedido(uuid,text,jsonb)'::regprocedure);
begin
  if position(antigo in def) = 0 then
    raise exception 'criar_pedido: lista de métodos não encontrada';
  end if;
  execute replace(def, antigo, novo);
end $$;
