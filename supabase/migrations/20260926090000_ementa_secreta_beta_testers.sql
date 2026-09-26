-- Ementa secreta: passa a abrir também para beta testers inscritos, não só para
-- Clientes Beta aderidos (decisão do Leandro, 26 Set 2026 — "simplificar").
-- Ver a ementa não confere direito a nada: o desconto de 10% continua a exigir
-- adesão ao regulamento e é confirmado ao balcão (verificar_cliente_beta, sem
-- alterações). Mantém-se o limitador anti-enumeração e a janela 100–999.
CREATE OR REPLACE FUNCTION public.ementa_secreta(p_numero integer)
 RETURNS TABLE(categoria text, categoria_ordem integer, produto text, preco numeric, estilo text, abv numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.cliente_beta_limitar('ementa_secreta') THEN
    RAISE EXCEPTION 'Demasiadas tentativas. Tenta daqui a bocado.' USING ERRCODE='22023';
  END IF;
  IF p_numero IS NULL OR p_numero < 100 OR p_numero > 999 THEN RETURN; END IF;
  IF NOT (
       EXISTS (SELECT 1 FROM public.clientes_beta WHERE numero = p_numero AND estado = 'ativo')
    OR EXISTS (SELECT 1 FROM public.beta_testers  WHERE numero = p_numero
                 AND (expira_em IS NULL OR expira_em >= current_date))
  ) THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.nome, c.ordem, p.nome, p.preco, p.estilo, p.abv
    FROM public.products p JOIN public.categories c ON c.id = p.category_id
    WHERE (p.exclusiva_beta OR c.exclusiva_beta) AND p.disponivel
    ORDER BY c.ordem, p.ordem;
END $function$;

REVOKE ALL ON FUNCTION public.ementa_secreta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ementa_secreta(integer) TO anon, authenticated;
