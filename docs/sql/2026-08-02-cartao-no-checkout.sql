-- 2026-08-02 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Permitir 'cartao' como método de pagamento em criar_pedido_online.
-- Até aqui a função rejeitava qualquer método fora de ('mbway','multibanco'),
-- pelo que o cartão estava bloqueado na própria base de dados.
--
-- A função é longa e valida mínimo, raio de entrega, idade e aceitação das
-- Condições de Venda. Reescrevê-la por inteiro arriscava alterar algo por
-- transcrição, por isso lê-se a definição atual e substitui-se exatamente a
-- linha da validação. Se o padrão não aparecer, aborta sem tocar em nada.
do $$
declare
  def text;
  novo text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'criar_pedido_online';

  if def is null then
    raise exception 'criar_pedido_online não encontrada';
  end if;

  novo := replace(
    def,
    $q$p_metodo not in ('mbway', 'multibanco')$q$,
    $q$p_metodo not in ('mbway', 'multibanco', 'cartao')$q$
  );

  if novo = def then
    raise exception 'padrão da validação de método não encontrado — nada alterado';
  end if;

  execute novo;
end $$;

-- Verificação feita ao aplicar (todas true):
--   aceita_cartao, tipos_intactos, minimo_intacto, raio_intacto, condicoes_intactas

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
-- Mesmo bloco, trocando a ordem dos argumentos do replace:
--   $q$p_metodo not in ('mbway', 'multibanco', 'cartao')$q$  →
--   $q$p_metodo not in ('mbway', 'multibanco')$q$
