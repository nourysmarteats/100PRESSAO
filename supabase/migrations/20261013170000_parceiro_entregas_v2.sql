-- Registo de empresas de entrega — v2 da página /parceiro-entregas (13/10/2026, pedido do Leandro).
--   · preço em quatro partes: recolha, entrega, km incluídos, € por km adicional (+ suplementos);
--   · campos operacionais: horários, estafetas em hora de ponta, experiência com refeições
--     quentes, confirmação de mochila/caixa térmica e de seguros;
--   · condições e aviso passam à versão 2026-10-13.v2 (faturação SEMANAL consolidada).
--
-- Compatibilidade: o preço ACORDADO e o cálculo do custo de cada entrega continuam a usar
-- tarifa_base + tarifa_km (admin e despacho não mudam nesta alteração). Para isso a proposta
-- nova também preenche os campos antigos: base = recolha + entrega; km = € por km adicional.
-- Os km incluídos ficam guardados mas ainda não entram no cálculo — ver nota no fim.

begin;

alter table public.empresas_entrega
  add column if not exists tarifa_recolha      numeric(6,2) check (tarifa_recolha is null or tarifa_recolha between 0 and 50),
  add column if not exists tarifa_entrega      numeric(6,2) check (tarifa_entrega is null or tarifa_entrega between 0 and 50),
  add column if not exists km_incluidos        numeric(5,2) check (km_incluidos is null or km_incluidos between 0 and 30),
  add column if not exists tarifa_km_adicional numeric(6,2) check (tarifa_km_adicional is null or tarifa_km_adicional between 0 and 10),
  add column if not exists suplementos         text check (suplementos is null or char_length(suplementos) <= 1000),
  add column if not exists horarios            text check (horarios is null or char_length(horarios) <= 300),
  add column if not exists experiencia_refeicoes text check (experiencia_refeicoes is null or experiencia_refeicoes in ('regular','alguma','nenhuma')),
  add column if not exists mochila_termica     boolean,
  add column if not exists seguros_confirmados boolean;

comment on column public.empresas_entrega.n_estafetas is 'Estafetas disponíveis nos horários de maior procura (v2) / n.º aproximado (v1).';
comment on column public.empresas_entrega.zona is 'Zonas de cobertura.';

update public.definicoes
   set valor = valor || '{"termos_versao":"2026-10-13.v2","aviso_versao":"2026-10-13.v2"}'::jsonb
 where chave = 'empresas_entrega';

-- A função antiga (12 parâmetros) sai: a página nova só fala com a v2.
drop function if exists public.registar_empresa_entrega(text,text,text,text,text,text,int,text,numeric,numeric,boolean,boolean);

create or replace function public.registar_empresa_entrega(
  p_nome_legal text, p_nome_comercial text, p_nipc text,
  p_contacto_nome text, p_contacto_email text, p_contacto_telefone text,
  p_zona text, p_n_estafetas int, p_horarios text, p_experiencia text,
  p_tarifa_recolha numeric, p_tarifa_entrega numeric, p_km_incluidos numeric, p_tarifa_km_adicional numeric,
  p_suplementos text,
  p_mochila_termica boolean, p_seguros boolean,
  p_aceita_termos boolean, p_aviso_lido boolean)
returns table (id uuid, estado text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare cfg jsonb; h jsonb; ip text; seg text; marca text;
  v_nipc text := regexp_replace(coalesce(p_nipc, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p_contacto_telefone, ''), '[^0-9+]', '', 'g');
  v_id uuid;
begin
  select valor into cfg from public.definicoes where chave = 'empresas_entrega';
  if cfg is null or not coalesce((cfg->>'registo_aberto')::boolean, false) then raise exception 'O registo de empresas de entrega está fechado.' using errcode = '22023'; end if;
  if not coalesce(p_aceita_termos, false) or not coalesce(p_aviso_lido, false) then raise exception 'É preciso aceitar as condições e confirmar a leitura do aviso de privacidade.' using errcode = '22023'; end if;
  if not coalesce(p_mochila_termica, false) or not coalesce(p_seguros, false) then raise exception 'É preciso confirmar a mochila ou caixa térmica e os seguros.' using errcode = '22023'; end if;
  if not public.nif_valido(v_nipc) then raise exception 'O NIPC não é válido.' using errcode = '22023'; end if;
  if coalesce(trim(p_contacto_nome), '') = '' or coalesce(trim(p_contacto_email), '') = '' or v_tel = '' then raise exception 'Faltam os dados da pessoa de contacto.' using errcode = '22023'; end if;
  if coalesce(trim(p_zona), '') = '' then raise exception 'Indique as zonas de cobertura.' using errcode = '22023'; end if;
  if p_tarifa_recolha is null or p_tarifa_entrega is null or p_km_incluidos is null or p_tarifa_km_adicional is null then raise exception 'Preencha todos os valores do preço.' using errcode = '22023'; end if;
  if p_experiencia is not null and p_experiencia not in ('regular','alguma','nenhuma') then raise exception 'Experiência inválida.' using errcode = '22023'; end if;
  if exists (select 1 from public.empresas_entrega e where e.nipc = v_nipc and e.estado in ('pendente','aprovada','suspensa')) then raise exception 'Já existe um registo activo para este NIPC.' using errcode = '23505'; end if;

  h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  ip := coalesce(nullif(split_part(h->>'x-forwarded-for', ',', 1), ''), nullif(h->>'x-real-ip', ''), 'sem-origem');
  select decrypted_secret into seg from vault.decrypted_secrets where name = 'empresas_entrega_segredo_ip';
  marca := encode(extensions.hmac(ip, seg, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(821942);
  if (select count(*) from public.empresas_entrega_limites l where l.ip_hash = marca and l.criado_em > clock_timestamp() - interval '1 hour') >= coalesce((cfg->>'limite_ip_hora')::int, 3) then raise exception 'Recebemos vários registos desta ligação há pouco. Tente mais tarde.' using errcode = 'P0001'; end if;
  if (select count(*) from public.empresas_entrega_limites l where l.criado_em > clock_timestamp() - interval '24 hours') >= coalesce((cfg->>'tecto_diario')::int, 20) then raise exception 'O registo atingiu o limite diário. Tente amanhã.' using errcode = 'P0001'; end if;
  insert into public.empresas_entrega_limites (ip_hash) values (marca);

  insert into public.empresas_entrega (
    nome_legal, nome_comercial, nipc, contacto_nome, contacto_email, contacto_telefone,
    zona, n_estafetas, horarios, experiencia_refeicoes,
    tarifa_recolha, tarifa_entrega, km_incluidos, tarifa_km_adicional, suplementos,
    tarifa_proposta_base, tarifa_proposta_km,
    mochila_termica, seguros_confirmados,
    termos_versao, aviso_versao, aceitou_termos_em, ip_hash)
  values (
    trim(p_nome_legal), nullif(trim(p_nome_comercial), ''), v_nipc, trim(p_contacto_nome), lower(trim(p_contacto_email)), v_tel,
    trim(p_zona), p_n_estafetas, nullif(trim(p_horarios), ''), p_experiencia,
    round(p_tarifa_recolha, 2), round(p_tarifa_entrega, 2), round(p_km_incluidos, 2), round(p_tarifa_km_adicional, 2), nullif(trim(p_suplementos), ''),
    round(p_tarifa_recolha + p_tarifa_entrega, 2), round(p_tarifa_km_adicional, 2),
    true, true,
    cfg->>'termos_versao', cfg->>'aviso_versao', now(), marca)
  returning empresas_entrega.id into v_id;

  insert into public.audit_log (acao, detalhe) values ('empresa_entrega_registada', jsonb_build_object('id', v_id, 'versao', cfg->>'termos_versao'));
  return query select v_id, 'pendente'::text;
end; $$;

revoke all on function public.registar_empresa_entrega(text,text,text,text,text,text,text,int,text,text,numeric,numeric,numeric,numeric,text,boolean,boolean,boolean,boolean) from public;
grant execute on function public.registar_empresa_entrega(text,text,text,text,text,text,text,int,text,text,numeric,numeric,numeric,numeric,text,boolean,boolean,boolean,boolean) to anon, authenticated;

commit;

-- NOTA para a próxima alteração (admin + despacho, fora do âmbito desta página):
-- o custo de cada entrega devia passar a ser recolha + entrega + max(0, km − km_incluídos) × € km adicional,
-- e o admin devia mostrar e permitir acordar estas quatro parcelas.
