-- Adesão direta ao Cliente Beta na página /ementa-secreta (decisão do Leandro,
-- 26 Set 2026; validado pela Bea com três condições: limitador próprio de 5/h
-- por IP, registo em audit_log sem telemóvel, resposta sempre genérica).
-- Prova de identidade: número (100–999) + telemóvel da inscrição.
-- Quem recusa não fica com benefícios; nada é gravado na recusa.
-- A ementa secreta volta a abrir SÓ para Clientes Beta aderidos (substitui
-- 20260926090000, em que abria para qualquer inscrito).
BEGIN;

-- 1) Aviso 2026-09-26.v1 (arquivo append-only): muda só o parágrafo da adesão.
INSERT INTO public.textos_legais (versao, tipo, texto, publicado_em, origem)
SELECT '2026-09-26.v1', 'aviso',
       replace(replace(texto, $A$Aos inscritos anteriores é apresentado um procedimento individual de adesão. Guardamos a confirmação e a versão efetivamente aceite, sem criar aceitação retroativa. A administração verifica a correspondência com a inscrição antes de disponibilizar um acesso individual à adesão. Saber o nome ou telefone de alguém não autoriza a aceitar termos em seu nome.$A$, $B$Aos inscritos anteriores é apresentada a adesão individual, por convite pessoal ou na página da ementa exclusiva. Na página, pedimos o número de inscrição e o telemóvel indicado na inscrição, e só registamos a adesão quando ambos correspondem. Guardamos a confirmação e a versão efetivamente aceite, sem criar aceitação retroativa. Saber o nome, o número ou o telefone de alguém não autoriza a aceitar termos em seu nome. Quem não aderir mantém apenas a inscrição na campanha, sem os benefícios do programa.$B$), 'Versão 2026-09-16.v1', 'Versão 2026-09-26.v1'),
       '2026-09-26',
       'Aviso 2026-09-26: adesão direta na página da ementa exclusiva (número + telemóvel). Validado pela Bea.'
FROM public.textos_legais WHERE versao = '2026-09-16.v1' AND tipo = 'aviso';

UPDATE public.definicoes
   SET valor = valor || jsonb_build_object('aviso_versao', '2026-09-26.v1', 'limite_adesao_direta_hora', 5)
 WHERE chave = 'cliente_beta';

-- 2) Limitador: ação 'adesao_direta' com limite próprio.
CREATE OR REPLACE FUNCTION public.cliente_beta_limitar(p_acao text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE cfg jsonb; h jsonb; ip text; marca text; limite integer;
BEGIN
 SELECT valor INTO cfg FROM definicoes WHERE chave='cliente_beta';
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 -- Cabeçalho de IP fornecido pelo gateway; nunca aceitar p_ip_hash como identidade.
 ip:=coalesce(nullif(split_part(h->>'x-forwarded-for',',',1),''),nullif(h->>'x-real-ip',''),'sem-origem');
 marca:=encode(extensions.hmac(ip,cfg->>'segredo_ip','sha256'),'hex');
 PERFORM pg_advisory_xact_lock(821940);
 limite:=CASE WHEN p_acao='inscricao' THEN (cfg->>'limite_ip_hora')::integer
              WHEN p_acao='adesao_direta' THEN coalesce((cfg->>'limite_adesao_direta_hora')::integer,5)
              ELSE (cfg->>'limite_convites_hora')::integer END;
 IF (SELECT count(*) FROM cliente_beta_limites WHERE ip_hash=marca AND acao=p_acao AND criado_em>clock_timestamp()-interval '1 hour')>=limite THEN RETURN false; END IF;
 IF (SELECT count(*) FROM cliente_beta_limites WHERE acao=p_acao AND criado_em>clock_timestamp()-interval '24 hours')>=(cfg->>'tecto_diario')::integer THEN RETURN false; END IF;
 INSERT INTO cliente_beta_limites(ip_hash,acao) VALUES(marca,p_acao);
 RETURN true;
END $function$;

-- 3) Adesão direta. Devolve só true/false (nunca revela se o número existe).
CREATE OR REPLACE FUNCTION public.aderir_cliente_beta_direto(p_numero integer, p_telemovel text, p_aceita_regulamento boolean, p_aviso_lido boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE b beta_testers%rowtype; c beta_campanhas%rowtype; cfg jsonb; tel text;
BEGIN
 IF NOT cliente_beta_limitar('adesao_direta') THEN
   RAISE EXCEPTION 'Demasiadas tentativas. Tenta daqui a bocado.' USING ERRCODE='22023';
 END IF;
 tel := regexp_replace(coalesce(p_telemovel,''), '\D', '', 'g');
 IF length(tel) = 12 AND left(tel,3) = '351' THEN tel := substr(tel,4); END IF;
 IF p_aceita_regulamento IS NOT TRUE OR p_aviso_lido IS NOT TRUE
    OR p_numero IS NULL OR p_numero NOT BETWEEN 100 AND 999 OR tel !~ '^\d{9}$' THEN RETURN false; END IF;
 SELECT * INTO b FROM beta_testers WHERE numero = p_numero AND telemovel = tel FOR UPDATE;
 IF b.id IS NULL THEN RETURN false; END IF;
 SELECT * INTO c FROM beta_campanhas WHERE id = b.campanha_id FOR UPDATE;
 SELECT valor INTO cfg FROM definicoes WHERE chave='cliente_beta';
 IF (cfg->>'ativo')::boolean IS NOT TRUE
    OR (c.inauguracao_em IS NOT NULL AND b.criado_em >= c.inauguracao_em) THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM clientes_beta WHERE inscricao_id = b.id OR telemovel = b.telemovel) THEN
   -- Já aderido: responder como sucesso para a ementa abrir.
   RETURN EXISTS (SELECT 1 FROM clientes_beta WHERE numero = p_numero AND estado = 'ativo');
 END IF;
 INSERT INTO clientes_beta(inscricao_id,campanha_id,numero,nome,telemovel,inscrito_em,regulamento_versao,aviso_versao,maioridade_confirmada_em)
 VALUES(b.id,b.campanha_id,b.numero,b.nome,b.telemovel,b.criado_em,cfg->>'regulamento_versao',cfg->>'aviso_versao',b.maioridade_confirmada_em);
 DELETE FROM cliente_beta_convites WHERE inscricao_id = b.id;
 INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_adesao_direta', jsonb_build_object('inscricao_id', b.id, 'via', 'ementa_secreta'));
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.aderir_cliente_beta_direto(integer,text,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aderir_cliente_beta_direto(integer,text,boolean,boolean) TO anon, authenticated;

-- 4) Ementa secreta: só Clientes Beta aderidos (ativo).
CREATE OR REPLACE FUNCTION public.ementa_secreta(p_numero integer)
 RETURNS TABLE(categoria text, categoria_ordem integer, produto text, preco numeric, estilo text, abv numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.cliente_beta_limitar('ementa_secreta') THEN
    RAISE EXCEPTION 'Demasiadas tentativas. Tenta daqui a bocado.' USING ERRCODE='22023';
  END IF;
  IF p_numero IS NULL OR p_numero < 100 OR p_numero > 999 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes_beta WHERE numero = p_numero AND estado = 'ativo') THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.nome, c.ordem, p.nome, p.preco, p.estilo, p.abv
    FROM public.products p JOIN public.categories c ON c.id = p.category_id
    WHERE (p.exclusiva_beta OR c.exclusiva_beta) AND p.disponivel
    ORDER BY c.ordem, p.ordem;
END $function$;
REVOKE ALL ON FUNCTION public.ementa_secreta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ementa_secreta(integer) TO anon, authenticated;

COMMIT;
