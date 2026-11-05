-- Encomenda mínima só nas entregas com portes grátis (Leandro, 5 Nov 2026).
--
-- Até km_gratis (2 km) a entrega é grátis e mantém-se o mínimo (min_encomenda,
-- 15 €). Acima disso o cliente já paga portes e não há mínimo.
--
-- Altera uma única linha da criar_pedido_online() (versão da migração
-- 20261105130000). Feito por substituição para não reescrever 250 linhas à mão;
-- falha em vez de aplicar meia alteração se a linha não for encontrada.
do $$
declare
  v_def  text;
  v_novo text;
  v_de   text := 'if v_tipo = ''entrega'' and v_total < v_min then';
  v_para text := 'if v_tipo = ''entrega'' and v_dist <= v_kmg and v_total < v_min then';
begin
  select pg_get_functiondef('public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid,text,jsonb,uuid)'::regprocedure)
    into v_def;
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'criar_pedido_online: linha do mínimo não encontrada (ou repetida) — nada alterado';
  end if;
  v_novo := replace(v_def, v_de, v_para);
  execute v_novo;
end $$;
