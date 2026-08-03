-- 2026-08-03 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Permitir 'pix' como método de pagamento em criar_pedido_online.
-- Mesma técnica das migrações anteriores: substituição cirúrgica da linha da
-- validação, abortando se o padrão não existir.
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
    $q$p_metodo not in ('mbway', 'multibanco', 'cartao')$q$,
    $q$p_metodo not in ('mbway', 'multibanco', 'cartao', 'pix')$q$
  );

  if novo = def then
    raise exception 'padrão da validação de método não encontrado — nada alterado';
  end if;

  execute novo;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- NOTA IMPORTANTE — MOEDA
-- ─────────────────────────────────────────────────────────────────────────
-- O Pix liquida em reais. A documentação do IfThenPay diz que o campo `amount`
-- leva "EUR ou BRL para Pix", sem esclarecer qual se aplica. O interruptor no
-- painel Admin traz um aviso a vermelho e deve ficar DESLIGADO até isto estar
-- confirmado por escrito com o IfThenPay: enviar euros num campo esperado em
-- reais cobraria cerca de um sexto do preço.

-- ─────────────────────────────────────────────────────────────────────────
-- REVERSÃO
-- ─────────────────────────────────────────────────────────────────────────
-- Mesmo bloco, trocando a ordem dos argumentos do replace.
