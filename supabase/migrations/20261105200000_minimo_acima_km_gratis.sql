-- Mínimo próprio para entregas com portes pagos (Leandro, 5 Nov 2026).
--
-- Até km_gratis: portes grátis e mínimo min_encomenda (15 €).
-- Acima de km_gratis: portes pagos e mínimo min_encomenda_portes (8 €), para
-- que carrinhos muito pequenos perto dos 2 km não deem prejuízo no estafeta.
-- Substitui a linha alterada na migração 20261105193000.

update public.definicoes
   set valor = valor || '{"min_encomenda_portes": 8}'::jsonb
 where chave = 'entrega' and not (valor ? 'min_encomenda_portes');

do $$
declare
  v_def  text;
  v_de   text := 'if v_tipo = ''entrega'' and v_dist <= v_kmg and v_total < v_min then';
  v_para text := 'if v_tipo = ''entrega'' and v_total < (case when v_dist <= v_kmg then v_min else coalesce((v_cfg->>''min_encomenda_portes'')::numeric, 0) end) then';
begin
  select pg_get_functiondef('public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid,text,jsonb,uuid)'::regprocedure)
    into v_def;
  if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
    raise exception 'criar_pedido_online: linha do mínimo não encontrada (ou repetida) — nada alterado';
  end if;
  execute replace(v_def, v_de, v_para);
end $$;
