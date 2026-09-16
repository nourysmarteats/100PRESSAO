-- Balcao Beta: verificacao de um numero contra a lista real de Clientes Beta.
-- So autenticados (equipa). Devolve nome e se esta ativo, para a equipa cruzar
-- nome+numero antes de aplicar os 10% no Vendus. SECURITY DEFINER porque a
-- leitura direta de clientes_beta e restrita a admin; aqui abrimos a
-- verificacao (minima) a qualquer membro com login, que e quem esta ao balcao.
BEGIN;

CREATE OR REPLACE FUNCTION public.verificar_cliente_beta(p_numero integer)
RETURNS TABLE(numero integer, nome text, ativo boolean, unidade text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT cb.numero, cb.nome, (cb.estado = 'ativo'), bc.unidade_nome
  FROM public.clientes_beta cb
  JOIN public.beta_campanhas bc ON bc.id = cb.campanha_id
  WHERE p_numero BETWEEN 100 AND 999 AND cb.numero = p_numero;
$$;

REVOKE ALL ON FUNCTION public.verificar_cliente_beta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_cliente_beta(integer) TO authenticated;

COMMIT;
