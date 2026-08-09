-- 2026-08-09 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- O cliente do restaurante online passa a poder pedir fatura com NIF.
--
-- O checkout pedia nome, telemóvel, email e morada, mas nunca o NIF: quem
-- encomendasse e quisesse fatura com contribuinte não tinha por onde o dar. As
-- colunas fatura_pedida e fatura_nif já existiam desde a migração de faturação
-- de julho — só nunca eram preenchidas neste canal.
--
-- CUIDADO COM A ASSINATURA
-- Acrescentar um parâmetro com CREATE OR REPLACE cria uma SEGUNDA função em vez
-- de substituir a primeira, e o PostgREST passa a ter duas candidatas para a
-- mesma chamada. Por isso apaga-se a antiga e cria-se a nova dentro do mesmo
-- bloco: ou acontecem as duas coisas, ou nenhuma.
do $$
declare
  def  text;
  novo text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'criar_pedido_online';

  if def is null then
    raise exception 'criar_pedido_online não encontrada';
  end if;

  novo := replace(def, 'p_itens jsonb)', 'p_itens jsonb, p_nif text DEFAULT NULL)');
  if novo = def then raise exception 'assinatura não encontrada'; end if;

  def := novo;
  novo := replace(def, '  v_email    text', '  v_nif      text;' || chr(10) || '  v_email    text');
  if novo = def then raise exception 'bloco declare não encontrado'; end if;

  def := novo;
  novo := replace(
    def,
    '  if v_tipo not in (''entrega'', ''levar'') then',
    '  v_nif := nullif(regexp_replace(coalesce(p_nif, ''''), ''\D'', '''', ''g''), '''');' || chr(10) ||
    '  if v_nif is not null and v_nif !~ ''^\d{9}$'' then' || chr(10) ||
    '    raise exception ''NIF inválido (9 dígitos)'' using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10) || chr(10) ||
    '  if v_tipo not in (''entrega'', ''levar'') then'
  );
  if novo = def then raise exception 'validação do tipo não encontrada'; end if;

  def := novo;
  novo := replace(
    def,
    'morada, distancia_km, portes, idade_confirmada, aceitou_condicoes_em',
    'morada, distancia_km, portes, idade_confirmada, aceitou_condicoes_em, fatura_pedida, fatura_nif'
  );
  if novo = def then raise exception 'lista de colunas não encontrada'; end if;

  def := novo;
  novo := replace(
    def,
    'v_morada, v_dist, v_portes, true, now()',
    'v_morada, v_dist, v_portes, true, now(), v_nif is not null, v_nif'
  );
  if novo = def then raise exception 'valores do insert não encontrados'; end if;

  drop function public.criar_pedido_online(text, text, text, text, text, numeric, text, boolean, boolean, jsonb);
  execute novo;
end $$;

-- Verificado ao aplicar: existe UMA só versão da função, com p_nif no fim, e
-- continuam intactas as validações de mínimo, distância, raio e dinheiro.
