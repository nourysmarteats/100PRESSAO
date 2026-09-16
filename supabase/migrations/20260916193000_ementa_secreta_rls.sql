-- Ementa secreta: a anon deixa de ver produtos exclusivos de Beta.
-- A politica publica era USING(true) para todos; passa a:
--   anon           -> so ve exclusiva_beta = false (o menu publico);
--   authenticated  -> ve tudo (equipa/PDV/admin precisam de vender o secreto).
-- A funcao ementa_secreta (SECURITY DEFINER) ignora a RLS e serve os secretos
-- ao Beta validado. Assim o secreto nao vaza nem por consulta direta a anon.
BEGIN;

DROP POLICY IF EXISTS "leitura publica" ON public.products;

CREATE POLICY "leitura publica nao secreta" ON public.products
  FOR SELECT TO anon USING (exclusiva_beta = false);

CREATE POLICY "leitura equipa total" ON public.products
  FOR SELECT TO authenticated USING (true);

COMMIT;
