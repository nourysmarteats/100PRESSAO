-- PROPOSTA NÃO APLICADA. Gerada a partir da função real em 13/09/2026.
-- Testar em branch Supabase; não executar testes de inscrição na produção.
-- Não altera numeração, consentimentos nem expurgo. Apenas Carnaxide/configuração atual.
-- A modelagem de campanhas por unidade e adesões ao programa continua pendente.
-- Ao publicar, sincronizar beta_terminou_em com o dia local de inauguracao_em:
-- a função de expurgo existente continua a depender da data antiga.

CREATE OR REPLACE FUNCTION public.inscrever_beta_tester(p_nome text, p_telemovel text, p_origem_param text, p_origem_declarada text, p_aviso_lido boolean, p_ip_hash text DEFAULT NULL::text, p_contacto_pos_beta boolean DEFAULT false, p_maioridade boolean DEFAULT false)
 RETURNS TABLE(numero integer, criado_em timestamp with time zone, ja_inscrito boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cfg        jsonb;
  v_nome       text := nullif(btrim(p_nome), '');
  v_tel        text := regexp_replace(coalesce(p_telemovel,''), '\D', '', 'g');
  v_param      text := lower(btrim(coalesce(p_origem_param, '')));
  v_declarada  text := lower(btrim(coalesce(p_origem_declarada, '')));
  v_pos        boolean := coalesce(p_contacto_pos_beta, false);
  v_versao     text;
  v_cons_versao text;
  v_existente  public.beta_testers%rowtype;
  v_numero     int;
  v_criado     timestamptz;
  v_tentativa  int := 0;
  v_constraint text;
begin
  select valor into v_cfg from public.definicoes where chave = 'beta';
  -- Fecho por instante, com compatibilidade para a data antiga de Carnaxide.
  -- Configuração inválida falha fechada; não permite ultrapassar a inauguração.
  if nullif(v_cfg->>'inauguracao_em', '') is not null then
    if (v_cfg->>'inauguracao_em') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})

  if coalesce((v_cfg->>'aberto')::boolean, false) is not true then
    raise exception 'As inscricoes na beta estao fechadas de momento' using errcode = '22023';
  end if;

  -- Nao e consentimento: e a confirmacao de que o aviso do art. 13.º foi lido.
  if p_aviso_lido is not true then
    raise exception 'E necessario confirmar a leitura do aviso' using errcode = '22023';
  end if;

  if p_maioridade is not true then
    raise exception 'E necessario confirmar que tens 18 anos ou mais' using errcode = '22023';
  end if;

  if v_nome is null or length(v_nome) > 80 then
    raise exception 'Nome invalido' using errcode = '22023';
  end if;
  if v_tel !~ '^\d{9}$' then
    raise exception 'Telemovel invalido (9 digitos)' using errcode = '22023';
  end if;

  if v_param = '' then
    v_param := 'directo';
  elsif v_param !~ '^[a-z0-9-]{1,40}$' then
    v_param := 'invalido';
  end if;

  if not (v_cfg->'origens' ? v_declarada) then
    raise exception 'Origem declarada invalida' using errcode = '22023';
  end if;

  -- Sem etiqueta de versao nao se grava nada: um registo sem versao e um
  -- registo sem prova. Vale para o aviso e para o consentimento.
  v_versao      := v_cfg->>'aviso_versao';
  v_cons_versao := v_cfg->>'consentimento_versao';
  if coalesce(v_versao, '') = '' then
    raise exception 'Versao do aviso por definir' using errcode = '22023';
  end if;
  if coalesce(v_cons_versao, '') = '' then
    raise exception 'Versao do consentimento por definir' using errcode = '22023';
  end if;

  select * into v_existente from public.beta_testers t where t.telemovel = v_tel;
  if found then
    -- Reinscricao conta como interaccao. O consentimento pos-beta pode ser
    -- ligado aqui, nunca desligado. Quando e ligado agora, a versao do texto
    -- tem de ser recarimbada com a vigente: senao quem consente em Novembro
    -- fica etiquetado com o texto de Setembro, que nao foi o que leu.
    update public.beta_testers
       set ultima_interacao_em = now(),
           contacto_pos_beta    = beta_testers.contacto_pos_beta or v_pos,
           contacto_pos_beta_em = case
             when v_pos and not beta_testers.contacto_pos_beta then now()
             else beta_testers.contacto_pos_beta_em end,
           consentimento_versao = case
             when v_pos and not beta_testers.contacto_pos_beta then v_cons_versao
             else beta_testers.consentimento_versao end,
           contacto_pos_beta_retirado_em = case
             when v_pos and not beta_testers.contacto_pos_beta then null
             else beta_testers.contacto_pos_beta_retirado_em end
     where id = v_existente.id;
    return query select v_existente.numero, v_existente.criado_em, true;
    return;
  end if;

  if not public.beta_dentro_do_limite(p_ip_hash) then
    raise exception 'Demasiadas inscricoes. Tenta daqui a pouco.' using errcode = '22023';
  end if;

  -- Numero aleatorio. beta_numero_novo() ja verifica beta_testers e
  -- beta_prova, mas entre a verificacao e o insert cabe uma corrida: o
  -- UNIQUE apanha-a e tentamos outro numero. So se repete por colisao de
  -- numero — colisao de telemovel volta a subir, que e outro problema.
  loop
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 25 then
      raise exception 'Nao foi possivel atribuir um numero de membro' using errcode = '22023';
    end if;

    begin
      v_numero := public.beta_numero_novo();

      insert into public.beta_testers (
        numero, nome, telemovel, origem_param, origem_declarada,
        aviso_lido_em, aviso_versao, consentimento_versao, estado, ip_hash,
        contacto_pos_beta, contacto_pos_beta_em, ultima_interacao_em,
        maioridade_confirmada_em
      )
      values (
        v_numero, v_nome, v_tel, v_param, v_declarada,
        now(), v_versao, v_cons_versao, 'inscrito', nullif(p_ip_hash, ''),
        v_pos, case when v_pos then now() end, now(),
        now()
      )
      returning beta_testers.criado_em into v_criado;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'beta_numero_unico' then
        continue;
      else
        raise;
      end if;
    end;
  end loop;

  return query select v_numero, v_criado, false;
end;
$function$
 then
      raise exception 'Configuracao da inauguracao invalida' using errcode = '22023';
    end if;
    if clock_timestamp() >= (v_cfg->>'inauguracao_em')::timestamptz then
      raise exception 'As inscricoes na beta estao fechadas de momento' using errcode = '22023';
    end if;
  elsif nullif(v_cfg->>'beta_terminou_em', '') is not null then
    if (v_cfg->>'beta_terminou_em') !~ '^\d{4}-\d{2}-\d{2}

  if coalesce((v_cfg->>'aberto')::boolean, false) is not true then
    raise exception 'As inscricoes na beta estao fechadas de momento' using errcode = '22023';
  end if;

  -- Nao e consentimento: e a confirmacao de que o aviso do art. 13.º foi lido.
  if p_aviso_lido is not true then
    raise exception 'E necessario confirmar a leitura do aviso' using errcode = '22023';
  end if;

  if p_maioridade is not true then
    raise exception 'E necessario confirmar que tens 18 anos ou mais' using errcode = '22023';
  end if;

  if v_nome is null or length(v_nome) > 80 then
    raise exception 'Nome invalido' using errcode = '22023';
  end if;
  if v_tel !~ '^\d{9}$' then
    raise exception 'Telemovel invalido (9 digitos)' using errcode = '22023';
  end if;

  if v_param = '' then
    v_param := 'directo';
  elsif v_param !~ '^[a-z0-9-]{1,40}$' then
    v_param := 'invalido';
  end if;

  if not (v_cfg->'origens' ? v_declarada) then
    raise exception 'Origem declarada invalida' using errcode = '22023';
  end if;

  -- Sem etiqueta de versao nao se grava nada: um registo sem versao e um
  -- registo sem prova. Vale para o aviso e para o consentimento.
  v_versao      := v_cfg->>'aviso_versao';
  v_cons_versao := v_cfg->>'consentimento_versao';
  if coalesce(v_versao, '') = '' then
    raise exception 'Versao do aviso por definir' using errcode = '22023';
  end if;
  if coalesce(v_cons_versao, '') = '' then
    raise exception 'Versao do consentimento por definir' using errcode = '22023';
  end if;

  select * into v_existente from public.beta_testers t where t.telemovel = v_tel;
  if found then
    -- Reinscricao conta como interaccao. O consentimento pos-beta pode ser
    -- ligado aqui, nunca desligado. Quando e ligado agora, a versao do texto
    -- tem de ser recarimbada com a vigente: senao quem consente em Novembro
    -- fica etiquetado com o texto de Setembro, que nao foi o que leu.
    update public.beta_testers
       set ultima_interacao_em = now(),
           contacto_pos_beta    = beta_testers.contacto_pos_beta or v_pos,
           contacto_pos_beta_em = case
             when v_pos and not beta_testers.contacto_pos_beta then now()
             else beta_testers.contacto_pos_beta_em end,
           consentimento_versao = case
             when v_pos and not beta_testers.contacto_pos_beta then v_cons_versao
             else beta_testers.consentimento_versao end,
           contacto_pos_beta_retirado_em = case
             when v_pos and not beta_testers.contacto_pos_beta then null
             else beta_testers.contacto_pos_beta_retirado_em end
     where id = v_existente.id;
    return query select v_existente.numero, v_existente.criado_em, true;
    return;
  end if;

  if not public.beta_dentro_do_limite(p_ip_hash) then
    raise exception 'Demasiadas inscricoes. Tenta daqui a pouco.' using errcode = '22023';
  end if;

  -- Numero aleatorio. beta_numero_novo() ja verifica beta_testers e
  -- beta_prova, mas entre a verificacao e o insert cabe uma corrida: o
  -- UNIQUE apanha-a e tentamos outro numero. So se repete por colisao de
  -- numero — colisao de telemovel volta a subir, que e outro problema.
  loop
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 25 then
      raise exception 'Nao foi possivel atribuir um numero de membro' using errcode = '22023';
    end if;

    begin
      v_numero := public.beta_numero_novo();

      insert into public.beta_testers (
        numero, nome, telemovel, origem_param, origem_declarada,
        aviso_lido_em, aviso_versao, consentimento_versao, estado, ip_hash,
        contacto_pos_beta, contacto_pos_beta_em, ultima_interacao_em,
        maioridade_confirmada_em
      )
      values (
        v_numero, v_nome, v_tel, v_param, v_declarada,
        now(), v_versao, v_cons_versao, 'inscrito', nullif(p_ip_hash, ''),
        v_pos, case when v_pos then now() end, now(),
        now()
      )
      returning beta_testers.criado_em into v_criado;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'beta_numero_unico' then
        continue;
      else
        raise;
      end if;
    end;
  end loop;

  return query select v_numero, v_criado, false;
end;
$function$
 then
      raise exception 'Configuracao da inauguracao invalida' using errcode = '22023';
    end if;
    if (clock_timestamp() at time zone 'Europe/Lisbon')::date >= (v_cfg->>'beta_terminou_em')::date then
      raise exception 'As inscricoes na beta estao fechadas de momento' using errcode = '22023';
    end if;
  end if;


  if coalesce((v_cfg->>'aberto')::boolean, false) is not true then
    raise exception 'As inscricoes na beta estao fechadas de momento' using errcode = '22023';
  end if;

  -- Nao e consentimento: e a confirmacao de que o aviso do art. 13.º foi lido.
  if p_aviso_lido is not true then
    raise exception 'E necessario confirmar a leitura do aviso' using errcode = '22023';
  end if;

  if p_maioridade is not true then
    raise exception 'E necessario confirmar que tens 18 anos ou mais' using errcode = '22023';
  end if;

  if v_nome is null or length(v_nome) > 80 then
    raise exception 'Nome invalido' using errcode = '22023';
  end if;
  if v_tel !~ '^\d{9}$' then
    raise exception 'Telemovel invalido (9 digitos)' using errcode = '22023';
  end if;

  if v_param = '' then
    v_param := 'directo';
  elsif v_param !~ '^[a-z0-9-]{1,40}$' then
    v_param := 'invalido';
  end if;

  if not (v_cfg->'origens' ? v_declarada) then
    raise exception 'Origem declarada invalida' using errcode = '22023';
  end if;

  -- Sem etiqueta de versao nao se grava nada: um registo sem versao e um
  -- registo sem prova. Vale para o aviso e para o consentimento.
  v_versao      := v_cfg->>'aviso_versao';
  v_cons_versao := v_cfg->>'consentimento_versao';
  if coalesce(v_versao, '') = '' then
    raise exception 'Versao do aviso por definir' using errcode = '22023';
  end if;
  if coalesce(v_cons_versao, '') = '' then
    raise exception 'Versao do consentimento por definir' using errcode = '22023';
  end if;

  select * into v_existente from public.beta_testers t where t.telemovel = v_tel;
  if found then
    -- Reinscricao conta como interaccao. O consentimento pos-beta pode ser
    -- ligado aqui, nunca desligado. Quando e ligado agora, a versao do texto
    -- tem de ser recarimbada com a vigente: senao quem consente em Novembro
    -- fica etiquetado com o texto de Setembro, que nao foi o que leu.
    update public.beta_testers
       set ultima_interacao_em = now(),
           contacto_pos_beta    = beta_testers.contacto_pos_beta or v_pos,
           contacto_pos_beta_em = case
             when v_pos and not beta_testers.contacto_pos_beta then now()
             else beta_testers.contacto_pos_beta_em end,
           consentimento_versao = case
             when v_pos and not beta_testers.contacto_pos_beta then v_cons_versao
             else beta_testers.consentimento_versao end,
           contacto_pos_beta_retirado_em = case
             when v_pos and not beta_testers.contacto_pos_beta then null
             else beta_testers.contacto_pos_beta_retirado_em end
     where id = v_existente.id;
    return query select v_existente.numero, v_existente.criado_em, true;
    return;
  end if;

  if not public.beta_dentro_do_limite(p_ip_hash) then
    raise exception 'Demasiadas inscricoes. Tenta daqui a pouco.' using errcode = '22023';
  end if;

  -- Numero aleatorio. beta_numero_novo() ja verifica beta_testers e
  -- beta_prova, mas entre a verificacao e o insert cabe uma corrida: o
  -- UNIQUE apanha-a e tentamos outro numero. So se repete por colisao de
  -- numero — colisao de telemovel volta a subir, que e outro problema.
  loop
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 25 then
      raise exception 'Nao foi possivel atribuir um numero de membro' using errcode = '22023';
    end if;

    begin
      v_numero := public.beta_numero_novo();

      insert into public.beta_testers (
        numero, nome, telemovel, origem_param, origem_declarada,
        aviso_lido_em, aviso_versao, consentimento_versao, estado, ip_hash,
        contacto_pos_beta, contacto_pos_beta_em, ultima_interacao_em,
        maioridade_confirmada_em
      )
      values (
        v_numero, v_nome, v_tel, v_param, v_declarada,
        now(), v_versao, v_cons_versao, 'inscrito', nullif(p_ip_hash, ''),
        v_pos, case when v_pos then now() end, now(),
        now()
      )
      returning beta_testers.criado_em into v_criado;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'beta_numero_unico' then
        continue;
      else
        raise;
      end if;
    end;
  end loop;

  return query select v_numero, v_criado, false;
end;
$function$
;

