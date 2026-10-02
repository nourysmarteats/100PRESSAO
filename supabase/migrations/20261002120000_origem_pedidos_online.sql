-- Origem das encomendas do restaurante online (2 Out 2026).
--
-- Objectivo (Marta, campanha de lançamento): saber de que canal vem cada venda
-- SEM depender de cookies. O link de cada colocação leva ?via=<codigo> (ou ?o=,
-- herança da campanha beta); o frontend guarda o código em memória durante a
-- visita (nada é escrito no dispositivo) e envia-o em p_origem.
--
-- Mesmas regras que as inscrições beta (src/lib/beta.js → origemDoUrl):
--   vazio/ausente → 'directo' · fora de ^[a-z0-9-]{1,40}$ → 'invalido'.
-- Não é dado pessoal: é o código da colocação, igual para todos os clientes.
--
-- Compatível com o frontend já publicado: p_origem tem DEFAULT NULL, por isso
-- a chamada antiga (12 parâmetros) continua a funcionar e grava 'directo'.
--
-- A função é reescrita a partir da definição em produção (pg_get_functiondef)
-- com substituições verificadas, para não reescrever à mão 10 mil caracteres.
-- Aplicada em produção a 2 Out 2026 (projecto upbwaweymbtcatfvjmdg) e testada
-- numa transacção revertida: 'Insta-Reel-A' → insta-reel-a, sem código → directo,
-- '<script>' → invalido.

alter table public.orders add column if not exists origem text;
alter table public.orders drop constraint if exists orders_origem_formato;
alter table public.orders add constraint orders_origem_formato
  check (origem is null or origem ~ '^[a-z0-9-]{1,40}$');
comment on column public.orders.origem is
  'Código de origem da campanha (?via= / ?o=) nas encomendas online; directo = sem código; invalido = código mal formado. NULL em canais que não o site (POS, plataformas).';

do $migr$
declare
  v_old regprocedure := 'public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid)'::regprocedure;
  d text;
  n text;
begin
  d := pg_get_functiondef(v_old);

  n := replace(d, 'p_beta_token uuid DEFAULT NULL::uuid)',
                  'p_beta_token uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text)');
  if n = d then raise exception 'origem: assinatura não encontrada'; end if; d := n;

  n := replace(d, E'  v_excl     boolean;\n',
                  E'  v_excl     boolean;\n  v_origem   text := lower(btrim(coalesce(p_origem, '''')));\n');
  if n = d then raise exception 'origem: declare não encontrado'; end if; d := n;

  n := replace(d, E'begin\n  select valor into v_cfg',
                  E'begin\n  if v_origem = '''' then v_origem := ''directo'';\n  elsif v_origem !~ ''^[a-z0-9-]{1,40}$'' then v_origem := ''invalido'';\n  end if;\n\n  select valor into v_cfg');
  if n = d then raise exception 'origem: início do corpo não encontrado'; end if; d := n;

  n := replace(d, E'    cliente_beta_id, numero_beta\n  )',
                  E'    cliente_beta_id, numero_beta, origem\n  )');
  if n = d then raise exception 'origem: lista de colunas não encontrada'; end if; d := n;

  n := replace(d, E'    v_cb_id, v_cb_num\n  )',
                  E'    v_cb_id, v_cb_num, v_origem\n  )');
  if n = d then raise exception 'origem: lista de valores não encontrada'; end if; d := n;

  -- A versão de 12 parâmetros sai do caminho (renomeada e sem execução) para
  -- o PostgREST não ficar com duas candidatas; remove-se numa limpeza posterior.
  alter function public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid)
    rename to criar_pedido_online_v20260930;
  revoke execute on function public.criar_pedido_online_v20260930(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid)
    from public, anon, authenticated;
  execute d;
end
$migr$;

grant execute on function public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid,text)
  to anon, authenticated, service_role;
notify pgrst, 'reload schema';
