-- 2026-08-07 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Pagamento em dinheiro no restaurante online (à entrega ou ao levantar),
-- como fazem as plataformas de entrega.
--
-- Duas diferenças em relação aos métodos eletrónicos:
--   1. Não há pagamento a preceder a encomenda — ela é confirmada logo.
--   2. Fica em estado_pagamento = 'na_entrega', e NÃO em 'pendente'.
--      Esta distinção não é cosmética:
--        · 'pendente' significa "checkout abandonado". É o que mantém essas
--          encomendas fora da cozinha (FILTRO_ONLINE_PAGO) e o que o painel de
--          conversão conta como falhada.
--        · uma encomenda para pagar na entrega é o oposto: está confirmada,
--          tem de chegar à cozinha e não é uma conversão perdida.
--      Sem estado próprio, o dinheiro nunca chegaria à cozinha e apareceria
--      eternamente a 0% de conversão.
--
-- Fica atrás de um interruptor próprio (definicoes → entrega → dinheiro_ativo),
-- validado NO SERVIDOR: o dinheiro é o único método sem valor garantido à
-- partida, e tem de poder desligar-se sem depender do frontend.
do $$
declare
  def text;
  novo text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'criar_pedido_online';

  if def is null then
    raise exception 'criar_pedido_online não encontrada';
  end if;

  novo := replace(
    def,
    $q$  if p_metodo not in ('mbway', 'multibanco', 'cartao', 'pix') then
    raise exception 'Método de pagamento inválido' using errcode = '22023';
  end if;$q$,
    $q$  if p_metodo not in ('mbway', 'multibanco', 'cartao', 'pix', 'dinheiro') then
    raise exception 'Método de pagamento inválido' using errcode = '22023';
  end if;

  if p_metodo = 'dinheiro'
     and coalesce((v_cfg->>'dinheiro_ativo')::boolean, false) is not true then
    raise exception 'Pagamento em dinheiro indisponível de momento' using errcode = '22023';
  end if;$q$
  );
  if novo = def then
    raise exception 'padrão da validação de método não encontrado — nada alterado';
  end if;

  def := novo;
  novo := replace(
    def,
    $q$    v_session, 'recebido', p_metodo, 'pendente', 0,$q$,
    $q$    v_session, 'recebido', p_metodo,
    case when p_metodo = 'dinheiro' then 'na_entrega' else 'pendente' end, 0,$q$
  );
  if novo = def then
    raise exception 'padrão do insert não encontrado — nada alterado';
  end if;

  execute novo;
end $$;

-- Verificado ao aplicar (todos true): aceita_dinheiro, exige_interruptor,
-- estado_proprio, minimo_intacto, raio_intacto, idade_intacta,
-- condicoes_intactas.

-- Alterações que acompanham, no código:
--   · FILTRO_ONLINE_PAGO passa a incluir 'na_entrega' (senão a cozinha nunca vê)
--   · /api/pagamento ganha ramo 'dinheiro' que envia o email de confirmação —
--     sem callback, era o único método que ficaria sem confirmação escrita,
--     exigida pelas Condições de Venda
--   · painel de conversão conta 'na_entrega' como convertida
--   · o Staff, ao confirmar entrega, já marcava estado_pagamento = 'pago'

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
-- Mesmo bloco com os argumentos do replace trocados. Antes disso, tratar as
-- encomendas que estejam em 'na_entrega':
--   select numero, total from public.orders where estado_pagamento = 'na_entrega';
