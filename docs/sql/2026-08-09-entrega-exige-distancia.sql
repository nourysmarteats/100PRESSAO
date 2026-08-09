-- 2026-08-09 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Uma entrega passa a exigir distância calculada.
--
-- O QUE CORREU MAL
-- Encomenda #51: entrega para Algés, distancia_km = 0.00, portes = 0.00,
-- total 20,25 €. O cálculo do Google falhou e nada impediu o avanço, pelo que
-- a encomenda foi aceite com entrega grátis para um sítio que devia custar
-- cerca de 4,30 €. Pior: com distância 0 a validação do raio máximo também
-- passa, por isso o sistema aceitaria uma entrega a 30 km.
--
-- A CAUSA DA FALHA DO CÁLCULO (não é do código)
-- A API do Google responde REQUEST_DENIED com a mensagem "You must enable
-- Billing on the Google Cloud Project". A chave existe e está no Vercel; o que
-- falta é a faturação estar activa no projeto Google Cloud.
--
-- O que esta migração corrige é o silêncio: mesmo com o Google a funcionar, um
-- pedido feito fora do browser podia entrar sem distância.
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
    $q$    if v_dist > v_raio then
      raise exception 'Fora da área de entrega' using errcode = '22023';
    end if;$q$,
    $q$    if v_dist <= 0 then
      raise exception 'Distância da entrega por calcular' using errcode = '22023';
    end if;
    if v_dist > v_raio then
      raise exception 'Fora da área de entrega' using errcode = '22023';
    end if;$q$
  );

  if novo = def then
    raise exception 'padrão da validação do raio não encontrado — nada alterado';
  end if;

  execute novo;
end $$;

-- Verificado ao aplicar (todos true): exige_distancia, raio_intacto,
-- minimo_intacto, metodos_intactos, interruptor_intacto,
-- estado_pagamento_intacto.

-- Acompanha, no código:
--   · o checkout deixa de permitir finalizar uma entrega sem distância;
--   · api/distancia distingue "morada não encontrada" (400, culpa da morada)
--     de "serviço indisponível" (503, culpa nossa) — dizer ao cliente que a
--     morada está errada quando o problema é a nossa chave manda-o corrigir
--     uma coisa que está certa.
