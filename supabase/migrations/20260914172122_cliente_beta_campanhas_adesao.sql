-- Campanhas por unidade e adesão contratual independente da inscrição.
BEGIN;
CREATE TABLE public.beta_campanhas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unidade_codigo text UNIQUE NOT NULL,
 unidade_nome text NOT NULL, aberto boolean NOT NULL DEFAULT false,
 inauguracao_em timestamptz, criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now());
INSERT INTO public.beta_campanhas(unidade_codigo,unidade_nome,aberto,inauguracao_em)
SELECT 'carnaxide','Carnaxide',coalesce((valor->>'aberto')::boolean,false),
 CASE WHEN nullif(valor->>'beta_terminou_em','') IS NOT NULL THEN
 ((valor->>'beta_terminou_em')::date::timestamp AT TIME ZONE 'Europe/Lisbon') END
FROM public.definicoes WHERE chave='beta';
ALTER TABLE public.beta_testers ADD COLUMN campanha_id uuid REFERENCES public.beta_campanhas(id);
UPDATE public.beta_testers SET campanha_id=(SELECT id FROM public.beta_campanhas WHERE unidade_codigo='carnaxide');
ALTER TABLE public.beta_testers ALTER COLUMN campanha_id SET NOT NULL;
INSERT INTO public.definicoes(chave,valor) VALUES ('cliente_beta',jsonb_build_object(
 'ativo',true,'regulamento_versao','2026-09-14.v1','aviso_versao','2026-09-14.v1',
 'consentimento_versao','2026-09-03.v1','tecto_diario',200,'limite_ip_hora',3,
 'limite_convites_hora',20,'convite_dias',7,'saida_dias',30,'prova_anos',3,
 'segredo_ip',encode(extensions.gen_random_bytes(32),'hex')));
CREATE TABLE public.clientes_beta (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inscricao_id uuid UNIQUE REFERENCES public.beta_testers(id) ON DELETE SET NULL,
 campanha_id uuid NOT NULL REFERENCES public.beta_campanhas(id), numero integer UNIQUE NOT NULL,
 nome text NOT NULL, telemovel text UNIQUE NOT NULL, inscrito_em timestamptz NOT NULL,
 aderiu_em timestamptz NOT NULL DEFAULT now(), regulamento_versao text NOT NULL,
 aviso_versao text NOT NULL, aviso_lido_em timestamptz NOT NULL DEFAULT now(),
 maioridade_confirmada_em timestamptz NOT NULL,
 estado text NOT NULL DEFAULT 'ativo' CHECK(estado IN ('ativo','saida')),
 saida_em timestamptz, expira_em timestamptz, rever_em timestamptz NOT NULL DEFAULT now()+interval '1 year',
 revisao_pendente boolean NOT NULL DEFAULT false,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.cliente_beta_prova (
 id uuid PRIMARY KEY, regulamento_versao text NOT NULL,aviso_versao text NOT NULL,
 aderiu_em timestamptz NOT NULL, saida_em timestamptz NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL);
CREATE TABLE public.cliente_beta_convites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inscricao_id uuid NOT NULL REFERENCES public.beta_testers(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL);
CREATE TABLE public.cliente_beta_limites (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ip_hash text NOT NULL,
 acao text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL DEFAULT now()+interval '24 hours');
CREATE INDEX ON public.cliente_beta_limites(ip_hash,acao,criado_em);
CREATE OR REPLACE FUNCTION public.cliente_beta_expiracao() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.estado='saida' THEN
  NEW.saida_em:=coalesce(OLD.saida_em,clock_timestamp());
  NEW.expira_em:=NEW.saida_em+interval '30 days';
 ELSE NEW.expira_em:=NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cliente_beta_expiracao BEFORE INSERT OR UPDATE ON public.clientes_beta FOR EACH ROW EXECUTE FUNCTION public.cliente_beta_expiracao();
CREATE TRIGGER clientes_beta_touch BEFORE UPDATE ON public.clientes_beta FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();
CREATE TRIGGER beta_campanhas_touch BEFORE UPDATE ON public.beta_campanhas FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();
CREATE OR REPLACE FUNCTION public.cliente_beta_limitar(p_acao text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg jsonb; h jsonb; ip text; marca text; limite integer;
BEGIN
 SELECT valor INTO cfg FROM definicoes WHERE chave='cliente_beta';
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 -- Cabeçalho de IP fornecido pelo gateway; nunca aceitar p_ip_hash como identidade.
 ip:=coalesce(nullif(split_part(h->>'x-forwarded-for',',',1),''),nullif(h->>'x-real-ip',''),'sem-origem');
 marca:=encode(extensions.hmac(ip,cfg->>'segredo_ip','sha256'),'hex');
 PERFORM pg_advisory_xact_lock(821940);
 limite:=CASE WHEN p_acao='inscricao' THEN (cfg->>'limite_ip_hora')::integer ELSE (cfg->>'limite_convites_hora')::integer END;
 IF (SELECT count(*) FROM cliente_beta_limites WHERE ip_hash=marca AND acao=p_acao AND criado_em>clock_timestamp()-interval '1 hour')>=limite THEN RETURN false; END IF;
 IF (SELECT count(*) FROM cliente_beta_limites WHERE acao=p_acao AND criado_em>clock_timestamp()-interval '24 hours')>=(cfg->>'tecto_diario')::integer THEN RETURN false; END IF;
 INSERT INTO cliente_beta_limites(ip_hash,acao) VALUES(marca,p_acao);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.listar_campanhas_beta() RETURNS TABLE(id uuid,unidade_codigo text,unidade_nome text,aberto boolean,inauguracao_em timestamptz,agora_servidor timestamptz,regulamento_versao text,aviso_versao text,consentimento_versao text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT c.id,c.unidade_codigo,c.unidade_nome,c.aberto AND coalesce((d.valor->>'ativo')::boolean,false) AND (c.inauguracao_em IS NULL OR clock_timestamp()<c.inauguracao_em),c.inauguracao_em,clock_timestamp(),d.valor->>'regulamento_versao',d.valor->>'aviso_versao',d.valor->>'consentimento_versao'
 FROM beta_campanhas c CROSS JOIN definicoes d WHERE d.chave='cliente_beta' ORDER BY c.criado_em;
$$;
CREATE OR REPLACE FUNCTION public.beta_numero_novo() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer; BEGIN
 FOR tentativa IN 1..900 LOOP
 n:=100+floor(random()*900)::integer;
 IF NOT EXISTS(SELECT 1 FROM beta_testers WHERE numero=n) AND NOT EXISTS(SELECT 1 FROM beta_prova WHERE numero=n) AND NOT EXISTS(SELECT 1 FROM clientes_beta WHERE numero=n) THEN RETURN n; END IF;
 END LOOP;
 SELECT x INTO n FROM generate_series(100,999) x WHERE NOT EXISTS(SELECT 1 FROM beta_testers WHERE numero=x) AND NOT EXISTS(SELECT 1 FROM beta_prova WHERE numero=x) AND NOT EXISTS(SELECT 1 FROM clientes_beta WHERE numero=x) LIMIT 1;
 IF n IS NULL THEN RAISE EXCEPTION 'Sem números disponíveis' USING ERRCODE='22023'; END IF; RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.inscrever_cliente_beta(p_campanha_id uuid,p_nome text,p_telemovel text,p_origem_param text,p_origem_declarada text,p_aviso_lido boolean,p_aceita_regulamento boolean,p_ip_hash text DEFAULT NULL,p_contacto_pos_beta boolean DEFAULT false,p_maioridade boolean DEFAULT false)
RETURNS TABLE(numero integer,criado_em timestamptz,ja_inscrito boolean,adesao_registada boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c beta_campanhas%rowtype; cfg jsonb; antigo jsonb; tel text:=regexp_replace(coalesce(p_telemovel,''),'\D','','g'); n integer; b beta_testers%rowtype; origem text:=lower(trim(coalesce(p_origem_param,''))); declarada text:=lower(trim(coalesce(p_origem_declarada,'')));
BEGIN
 IF NOT cliente_beta_limitar('inscricao') THEN RETURN QUERY SELECT NULL::integer,NULL::timestamptz,false,false; RETURN; END IF;
 SELECT * INTO c FROM beta_campanhas WHERE id=p_campanha_id FOR UPDATE;
 SELECT valor INTO cfg FROM definicoes WHERE chave='cliente_beta';
 SELECT valor INTO antigo FROM definicoes WHERE chave='beta';
 IF c.id IS NULL OR NOT c.aberto OR (cfg->>'ativo')::boolean IS NOT TRUE OR (c.inauguracao_em IS NOT NULL AND clock_timestamp()>=c.inauguracao_em) THEN RAISE EXCEPTION 'Inscrições encerradas' USING ERRCODE='22023'; END IF;
 IF p_aviso_lido IS NOT TRUE OR p_aceita_regulamento IS NOT TRUE OR p_maioridade IS NOT TRUE THEN RAISE EXCEPTION 'Confirmações obrigatórias em falta' USING ERRCODE='22023'; END IF;
 IF length(trim(coalesce(p_nome,''))) NOT BETWEEN 2 AND 80 OR tel !~ '^\d{9}$' THEN RAISE EXCEPTION 'Nome ou telefone inválido' USING ERRCODE='22023'; END IF;
 IF declarada<>'' AND NOT (antigo->'origens' ? declarada) THEN RAISE EXCEPTION 'Origem inválida' USING ERRCODE='22023'; END IF;
 IF origem='' THEN origem:='directo'; ELSIF origem !~ '^[a-z0-9-]{1,40}$' THEN origem:='invalido'; END IF;
 IF EXISTS(SELECT 1 FROM beta_testers t WHERE t.telemovel=tel) OR EXISTS(SELECT 1 FROM clientes_beta t WHERE t.telemovel=tel) THEN RETURN QUERY SELECT NULL::integer,NULL::timestamptz,true,false; RETURN; END IF;
 IF coalesce(cfg->>'regulamento_versao','')='' OR coalesce(cfg->>'aviso_versao','')='' OR coalesce(cfg->>'consentimento_versao','')='' THEN RAISE EXCEPTION 'Configuração incompleta'; END IF;
 n:=beta_numero_novo();
 INSERT INTO beta_testers(numero,nome,telemovel,origem_param,origem_declarada,aviso_versao,consentimento_versao,maioridade_confirmada_em,contacto_pos_beta,contacto_pos_beta_em,campanha_id)
 VALUES(n,trim(p_nome),tel,origem,declarada,cfg->>'aviso_versao',cfg->>'consentimento_versao',clock_timestamp(),coalesce(p_contacto_pos_beta,false),CASE WHEN p_contacto_pos_beta THEN clock_timestamp() END,c.id) RETURNING * INTO b;
 INSERT INTO clientes_beta(inscricao_id,campanha_id,numero,nome,telemovel,inscrito_em,regulamento_versao,aviso_versao,maioridade_confirmada_em)
 VALUES(b.id,c.id,n,b.nome,tel,b.criado_em,cfg->>'regulamento_versao',cfg->>'aviso_versao',b.maioridade_confirmada_em);
 RETURN QUERY SELECT n,b.criado_em,false,true;
END $$;
CREATE OR REPLACE FUNCTION public.inscrever_beta_tester(p_nome text,p_telemovel text,p_origem_param text,p_origem_declarada text,p_aviso_lido boolean,p_ip_hash text DEFAULT NULL,p_contacto_pos_beta boolean DEFAULT false,p_maioridade boolean DEFAULT false)
RETURNS TABLE(numero integer,criado_em timestamptz,ja_inscrito boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Atualiza a página para consultar as condições atuais' USING ERRCODE='22023'; END $$;
CREATE OR REPLACE FUNCTION public.emitir_convite_cliente_beta(p_inscricao_id uuid) RETURNS TABLE(token text,expira_em timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b beta_testers%rowtype; c beta_campanhas%rowtype; segredo text; fim timestamptz;
BEGIN
 IF NOT e_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM beta_testers WHERE id=p_inscricao_id FOR UPDATE;
 SELECT * INTO c FROM beta_campanhas WHERE id=b.campanha_id;
 IF b.id IS NULL OR EXISTS(SELECT 1 FROM clientes_beta WHERE inscricao_id=b.id OR telemovel=b.telemovel) OR (c.inauguracao_em IS NOT NULL AND b.criado_em>=c.inauguracao_em) THEN RAISE EXCEPTION 'Inscrição não elegível' USING ERRCODE='22023'; END IF;
 DELETE FROM cliente_beta_convites WHERE inscricao_id=b.id;
 segredo:=encode(extensions.gen_random_bytes(32),'hex'); fim:=clock_timestamp()+interval '7 days';
 INSERT INTO cliente_beta_convites(inscricao_id,token_hash,expira_em) VALUES(b.id,encode(extensions.digest(segredo,'sha256'),'hex'),fim);
 INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_convite_emitido',jsonb_build_object('inscricao_id',b.id));
 RETURN QUERY SELECT segredo,fim;
END $$;
CREATE OR REPLACE FUNCTION public.aderir_cliente_beta(p_token text,p_aceita_regulamento boolean,p_aviso_lido boolean) RETURNS TABLE(numero integer,adesao_registada boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE convite cliente_beta_convites%rowtype; b beta_testers%rowtype; c beta_campanhas%rowtype; cfg jsonb;
BEGIN
 IF NOT cliente_beta_limitar('adesao') THEN RETURN QUERY SELECT NULL::integer,false; RETURN; END IF;
 IF p_aceita_regulamento IS NOT TRUE OR p_aviso_lido IS NOT TRUE OR length(coalesce(p_token,''))<>64 THEN RETURN QUERY SELECT NULL::integer,false; RETURN; END IF;
 SELECT * INTO convite FROM cliente_beta_convites WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') FOR UPDATE;
 IF convite.id IS NULL OR convite.expira_em<=clock_timestamp() THEN RETURN QUERY SELECT NULL::integer,false; RETURN; END IF;
 SELECT * INTO b FROM beta_testers WHERE id=convite.inscricao_id FOR UPDATE;
 SELECT * INTO c FROM beta_campanhas WHERE id=b.campanha_id FOR UPDATE;
 SELECT valor INTO cfg FROM definicoes WHERE chave='cliente_beta';
 IF b.id IS NULL OR (cfg->>'ativo')::boolean IS NOT TRUE OR (c.inauguracao_em IS NOT NULL AND b.criado_em>=c.inauguracao_em) OR EXISTS(SELECT 1 FROM clientes_beta WHERE telemovel=b.telemovel) THEN RETURN QUERY SELECT NULL::integer,false; RETURN; END IF;
 INSERT INTO clientes_beta(inscricao_id,campanha_id,numero,nome,telemovel,inscrito_em,regulamento_versao,aviso_versao,maioridade_confirmada_em)
 VALUES(b.id,b.campanha_id,b.numero,b.nome,b.telemovel,b.criado_em,cfg->>'regulamento_versao',cfg->>'aviso_versao',b.maioridade_confirmada_em);
 DELETE FROM cliente_beta_convites WHERE id=convite.id;
 RETURN QUERY SELECT b.numero,true;
END $$;
CREATE OR REPLACE FUNCTION public.listar_adesoes_cliente_beta_admin() RETURNS TABLE(inscricao_id uuid,regulamento_versao text,aderiu_em timestamptz,estado text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT e_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF; RETURN QUERY SELECT c.inscricao_id,c.regulamento_versao,c.aderiu_em,c.estado FROM clientes_beta c; END $$;
CREATE OR REPLACE FUNCTION public.definir_campanha_beta(p_id uuid,p_aberto boolean,p_inauguracao_em timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c beta_campanhas%rowtype;
BEGIN IF NOT e_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM beta_campanhas WHERE id=p_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Campanha inexistente'; END IF;
 IF c.inauguracao_em<=clock_timestamp() AND (p_aberto IS TRUE OR p_inauguracao_em IS DISTINCT FROM c.inauguracao_em) THEN RAISE EXCEPTION 'Uma campanha inaugurada não pode reabrir'; END IF;
 IF p_inauguracao_em IS NOT NULL AND EXISTS(SELECT 1 FROM beta_testers WHERE campanha_id=p_id AND criado_em>=p_inauguracao_em) THEN RAISE EXCEPTION 'A data não pode invalidar inscrições existentes'; END IF;
 UPDATE beta_campanhas SET aberto=coalesce(p_aberto,false),inauguracao_em=p_inauguracao_em WHERE id=p_id;
 INSERT INTO audit_log(acao,detalhe) VALUES('beta_campanha_definida',jsonb_build_object('campanha_id',p_id,'inauguracao_em',p_inauguracao_em));
END $$;
CREATE OR REPLACE FUNCTION public.encerrar_cliente_beta(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT e_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 UPDATE clientes_beta SET estado='saida' WHERE id=p_id AND estado='ativo';
 INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_saida',jsonb_build_object('id',p_id));
END $$;
CREATE OR REPLACE FUNCTION public.rever_cliente_beta(p_id uuid,p_fundamento text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT e_admin() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF p_fundamento NOT IN ('contrato_ativo','pedido_titular_em_tratamento') THEN RAISE EXCEPTION 'Fundamento obrigatório'; END IF;
 UPDATE clientes_beta SET rever_em=clock_timestamp()+interval '1 year',revisao_pendente=false WHERE id=p_id AND estado='ativo';
 INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_revisao',jsonb_build_object('id',p_id,'fundamento',p_fundamento)); END $$;
CREATE OR REPLACE FUNCTION public.expurgar_clientes_beta() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 DELETE FROM cliente_beta_limites WHERE expira_em<=clock_timestamp();
 DELETE FROM cliente_beta_convites WHERE expira_em<=clock_timestamp();
 UPDATE clientes_beta SET revisao_pendente=true WHERE rever_em<=clock_timestamp() AND estado='ativo' AND NOT revisao_pendente;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n>0 THEN INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_revisao_pendente',jsonb_build_object('quantidade',n)); END IF;
 WITH removidos AS (DELETE FROM clientes_beta WHERE estado='saida' AND expira_em<=clock_timestamp() RETURNING *)
 INSERT INTO cliente_beta_prova(id,regulamento_versao,aviso_versao,aderiu_em,saida_em,expira_em)
 SELECT id,regulamento_versao,aviso_versao,aderiu_em,saida_em,clock_timestamp()+interval '3 years' FROM removidos;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n>0 THEN INSERT INTO audit_log(acao,detalhe) VALUES('cliente_beta_expurgo',jsonb_build_object('quantidade',n)); END IF;
 DELETE FROM cliente_beta_prova WHERE expira_em<=clock_timestamp();
 -- Apenas as novas inscrições seguem este aviso; os antigos mantêm expurgo histórico.
 DELETE FROM beta_testers b USING beta_campanhas c WHERE b.campanha_id=c.id AND b.aviso_versao='2026-09-14.v1' AND c.inauguracao_em+interval '30 days'<=clock_timestamp();
 UPDATE beta_testers b SET origem_param='eliminado',origem_declarada='' FROM beta_campanhas c WHERE b.campanha_id=c.id AND c.inauguracao_em+interval '30 days'<=clock_timestamp() AND (b.origem_param<>'eliminado' OR b.origem_declarada<>'');
END $$;
-- Nenhuma tabela nova é exposta a anónimos. A configuração com segredo também não é pública.
REVOKE ALL ON public.cliente_beta_limites,public.cliente_beta_convites,public.cliente_beta_prova,public.clientes_beta,public.beta_campanhas FROM anon,authenticated;
ALTER TABLE public.cliente_beta_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_beta_convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_beta_prova ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_beta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_beta_admin ON public.clientes_beta FOR SELECT TO authenticated USING(public.e_admin());
GRANT SELECT ON public.clientes_beta TO authenticated;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS assinatura FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('cliente_beta_expiracao','cliente_beta_limitar','listar_campanhas_beta','beta_numero_novo','inscrever_cliente_beta','inscrever_beta_tester','emitir_convite_cliente_beta','aderir_cliente_beta','listar_adesoes_cliente_beta_admin','definir_campanha_beta','encerrar_cliente_beta','rever_cliente_beta','expurgar_clientes_beta') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.assinatura);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.listar_campanhas_beta(),public.inscrever_cliente_beta(uuid,text,text,text,text,boolean,boolean,text,boolean,boolean),public.aderir_cliente_beta(text,boolean,boolean) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_convite_cliente_beta(uuid),public.listar_adesoes_cliente_beta_admin(),public.definir_campanha_beta(uuid,boolean,timestamptz),public.encerrar_cliente_beta(uuid),public.rever_cliente_beta(uuid,text) TO authenticated;
SELECT cron.schedule('expurgar-clientes-beta','35 3 * * *','SELECT public.expurgar_clientes_beta()');
COMMIT;
