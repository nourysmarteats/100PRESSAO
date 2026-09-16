-- Ementa secreta dos Clientes Beta.
-- 1) Marca categorias/produtos como exclusivos de Beta.
-- 2) Funcao-porta: dado um numero, devolve a ementa secreta SO se o numero for
--    de um Cliente Beta ativo. E view-only e tem limitador (trava a enumeracao
--    dos 900 numeros possiveis). O numero identifica para VER a ementa; NAO da
--    o desconto -- o 10% e confirmado ao balcao contra a lista real.
BEGIN;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS exclusiva_beta boolean NOT NULL DEFAULT false;
ALTER TABLE public.products   ADD COLUMN IF NOT EXISTS exclusiva_beta boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.ementa_secreta(p_numero integer)
RETURNS TABLE(categoria text, categoria_ordem integer, produto text, preco numeric, estilo text, abv numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.cliente_beta_limitar('ementa_secreta') THEN
    RAISE EXCEPTION 'Demasiadas tentativas. Tenta daqui a bocado.' USING ERRCODE='22023';
  END IF;
  -- Numero invalido ou nao-Beta: devolve vazio, sem revelar o motivo.
  IF p_numero IS NULL OR p_numero < 100 OR p_numero > 999 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes_beta WHERE numero = p_numero AND estado = 'ativo') THEN RETURN; END IF;

  RETURN QUERY
    SELECT c.nome, c.ordem, p.nome, p.preco, p.estilo, p.abv
    FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE (p.exclusiva_beta OR c.exclusiva_beta) AND p.disponivel
    ORDER BY c.ordem, p.ordem;
END $$;

REVOKE ALL ON FUNCTION public.ementa_secreta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ementa_secreta(integer) TO anon, authenticated;

COMMIT;
