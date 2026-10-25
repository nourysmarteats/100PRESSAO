-- criar_pedido_online: aceita os dados da empresa para a fatura (p_fatura).
--
-- Com NIF de empresa, a fatura precisa do nome e da morada fiscal do
-- adquirente (art. 36.º do CIVA); a Vendus recusa-a sem morada (A001 —
-- encomendas nº 40 e 41). O checkout passa a pedi-los e envia-os em p_fatura:
--   { "nome", "morada", "codigo_postal", "localidade" }
--
-- p_fatura é opcional e fica no fim, com default: um browser com a versão
-- anterior da página em cache continua a criar encomendas (sem estes dados,
-- a fatura para no painel à espera de ser completada — não se perde a venda).
-- Se vier, é validada aqui; o browser não é fonte de verdade.
--
-- Acrescentar um argumento muda a assinatura, por isso a antiga é removida na
-- mesma transacção — se não, ficavam duas sobrecargas e o PostgREST não sabia
-- qual chamar.

begin;

drop function if exists public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid,text);

create function public.criar_pedido_online(
  p_nome text, p_telefone text, p_email text, p_tipo text, p_morada text,
  p_distancia numeric, p_metodo text, p_idade_ok boolean, p_aceitou boolean,
  p_itens jsonb, p_nif text default null, p_beta_token uuid default null,
  p_origem text default null, p_fatura jsonb default null
)
returns table(id uuid, numero bigint, total numeric, portes numeric, estado pedido_estado, criado_em timestamp with time zone)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nome     text := nullif(btrim(p_nome), '');
  v_tel      text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
  v_nif      text;
  v_email    text := nullif(btrim(lower(p_email)), '');
  v_morada   text := nullif(btrim(p_morada), '');
  v_tipo     text := lower(coalesce(p_tipo, ''));
  v_dist     numeric := coalesce(p_distancia, 0);
  v_session  uuid;
  v_order_id uuid;
  v_total    numeric(10,2) := 0;
  v_desc     numeric(10,2) := 0;
  v_portes   numeric(10,2) := 0;
  v_item     jsonb;
  v_preco    numeric(10,2);
  v_qtd      int;
  v_n_itens  int;
  v_cfg      jsonb;
  v_cbcfg    jsonb;
  v_min      numeric;
  v_kmg      numeric;
  v_taxa     numeric;
  v_pkm      numeric;
  v_raio     numeric;
  v_cb_id    uuid;
  v_cb_num   integer;
  v_pct      numeric(5,2) := 0;
  v_excl     boolean;
  v_origem   text := lower(btrim(coalesce(p_origem, '')));
  v_f_nome   text;
  v_f_morada text;
  v_f_cp     text;
  v_f_loc    text;
begin
  if v_origem = '' then v_origem := 'directo';
  elsif v_origem !~ '^[a-z0-9-]{1,40}$' then v_origem := 'invalido';
  end if;

  select valor into v_cfg from public.definicoes where chave = 'entrega';
  select valor into v_cbcfg from public.definicoes where chave = 'cliente_beta';

  if coalesce((v_cfg->>'ativo')::boolean, false) is not true then
    raise exception 'O restaurante online está fechado de momento' using errcode = '22023';
  end if;

  if v_nome is null or length(v_nome) > 80 then
    raise exception 'Nome inválido' using errcode = '22023';
  end if;
  if length(v_tel) = 12 and v_tel like '351%' then v_tel := substr(v_tel, 4); end if;
  if v_tel !~ '^\d{9}$' then
    raise exception 'Telemóvel inválido (9 dígitos)' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then
    raise exception 'Email inválido' using errcode = '22023';
  end if;
  v_nif := nullif(regexp_replace(coalesce(p_nif, ''), '\D', '', 'g'), '');
  if v_nif is not null and v_nif !~ '^\d{9}$' then
    raise exception 'NIF inválido (9 dígitos)' using errcode = '22023';
  end if;

  -- Dados da empresa para a fatura: só com NIF de empresa (começa por 5–9).
  if p_fatura is not null and v_nif ~ '^[5-9]' then
    v_f_nome   := nullif(left(btrim(regexp_replace(coalesce(p_fatura->>'nome', ''), '\s+', ' ', 'g')), 120), '');
    v_f_morada := nullif(left(btrim(regexp_replace(coalesce(p_fatura->>'morada', ''), '\s+', ' ', 'g')), 200), '');
    v_f_cp     := nullif(btrim(coalesce(p_fatura->>'codigo_postal', '')), '');
    v_f_loc    := nullif(left(btrim(regexp_replace(coalesce(p_fatura->>'localidade', ''), '\s+', ' ', 'g')), 80), '');
    if v_f_nome is null or v_f_morada is null or v_f_loc is null then
      raise exception 'Dados da empresa incompletos: nome, morada e localidade' using errcode = '22023';
    end if;
    if v_f_cp is null or v_f_cp !~ '^\d{4}-\d{3}$' then
      raise exception 'Código postal inválido (0000-000)' using errcode = '22023';
    end if;
  end if;

  if v_tipo not in ('entrega', 'levar') then
    raise exception 'Tipo de encomenda inválido' using errcode = '22023';
  end if;
  if p_idade_ok is not true then
    raise exception 'É necessário confirmar que tem 18 anos ou mais' using errcode = '22023';
  end if;
  if p_aceitou is not true then
    raise exception 'É necessário aceitar as Condições de Venda' using errcode = '22023';
  end if;
  if p_metodo not in ('mbway', 'multibanco', 'cartao', 'pix', 'dinheiro') then
    raise exception 'Método de pagamento inválido' using errcode = '22023';
  end if;
  if p_metodo = 'dinheiro'
     and coalesce((v_cfg->>'dinheiro_ativo')::boolean, false) is not true then
    raise exception 'Pagamento em dinheiro indisponível de momento' using errcode = '22023';
  end if;

  -- Cliente Beta: só com token de validação recente, não usado, e o mesmo telemóvel do pedido.
  if p_beta_token is not null then
    select cb.id, cb.numero into v_cb_id, v_cb_num
      from public.cliente_beta_validacoes v
      join public.clientes_beta cb on cb.id = v.cliente_beta_id
     where v.id = p_beta_token
       and v.resultado = 'ok'
       and v.order_id is null
       and v.criado_em > now() - make_interval(mins => coalesce((v_cbcfg->>'validacao_minutos')::int, 30))
       and cb.estado = 'ativo'
       and (cb.expira_em is null or cb.expira_em >= current_date)
       and cb.telemovel = v_tel
     for update of v;
    if v_cb_id is null then
      raise exception 'Não foi possível validar o Cliente Beta. Volte a validar o número.' using errcode = '22023';
    end if;
    v_pct := coalesce((v_cbcfg->>'desconto_pct')::numeric, 10);
  end if;

  v_n_itens := coalesce(jsonb_array_length(p_itens), 0);
  if v_n_itens = 0 then
    raise exception 'Encomenda sem itens' using errcode = '22023';
  end if;
  if v_n_itens > 50 then
    raise exception 'Encomenda demasiado grande' using errcode = '22023';
  end if;

  v_min  := coalesce((v_cfg->>'min_encomenda')::numeric, 20);
  v_kmg  := coalesce((v_cfg->>'km_gratis')::numeric, 2);
  v_taxa := coalesce((v_cfg->>'taxa_base')::numeric, 1.6);
  v_pkm  := coalesce((v_cfg->>'preco_km')::numeric, 0.9);
  v_raio := coalesce((v_cfg->>'raio_max')::numeric, 12);

  if v_tipo = 'entrega' then
    if v_morada is null then
      raise exception 'Morada de entrega obrigatória' using errcode = '22023';
    end if;
    if v_dist <= 0 then
      raise exception 'Distância da entrega por calcular' using errcode = '22023';
    end if;
    if v_dist > v_raio then
      raise exception 'Fora da área de entrega' using errcode = '22023';
    end if;
    if v_dist > v_kmg then
      v_portes := v_taxa + (v_dist - v_kmg) * v_pkm;
    end if;
  else
    v_morada := null;
    v_dist   := 0;
    v_portes := 0;
  end if;

  insert into public.sessions (nome_cliente, posicao_mesa)
  values (v_nome, case when v_tipo = 'entrega' then 'Entrega' else 'Levantamento' end)
  returning sessions.id into v_session;

  insert into public.orders (
    session_id, estado, metodo_pagamento, estado_pagamento, total,
    canal, tipo_entrega, cliente_nome, cliente_telefone, cliente_email,
    morada, distancia_km, portes, idade_confirmada, aceitou_condicoes_em, fatura_pedida, fatura_nif,
    fatura_nome, fatura_morada, fatura_codigo_postal, fatura_localidade,
    cliente_beta_id, numero_beta, origem
  )
  values (
    v_session, 'recebido', p_metodo,
    case when p_metodo = 'dinheiro' then 'na_entrega' else 'pendente' end, 0,
    'online', v_tipo, v_nome, v_tel, v_email,
    v_morada, v_dist, v_portes, true, now(), v_nif is not null, v_nif,
    v_f_nome, v_f_morada, v_f_cp, v_f_loc,
    v_cb_id, v_cb_num, v_origem
  )
  returning orders.id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := coalesce((v_item->>'quantidade')::int, 0);
    if v_qtd < 1 or v_qtd > 99 then
      raise exception 'Quantidade inválida' using errcode = '22023';
    end if;

    v_preco := null;
    v_excl  := false;

    if v_item->>'combo_id' is not null then
      select coalesce(c.preco_online, c.preco) into v_preco from public.combos c
      where c.id = (v_item->>'combo_id')::uuid and c.disponivel;
      select exists (select 1 from public.combo_items ci
                       join public.products pp on pp.id = ci.product_id
                       left join public.categories cc on cc.id = pp.category_id
                      where ci.combo_id = (v_item->>'combo_id')::uuid
                        and (pp.exclusiva_beta or coalesce(cc.exclusiva_beta,false))) into v_excl;
    elsif v_item->>'variant_id' is not null then
      select coalesce(pv.preco_online, pv.preco),
             (pp.exclusiva_beta or coalesce(cc.exclusiva_beta,false))
        into v_preco, v_excl
        from public.product_variants pv
        join public.products pp on pp.id = pv.product_id
        left join public.categories cc on cc.id = pp.category_id
      where pv.id = (v_item->>'variant_id')::uuid and pv.disponivel and public.servido_hoje(pv.dias_semana);
    elsif v_item->>'product_id' is not null then
      select coalesce(p.preco_online, p.preco),
             (p.exclusiva_beta or coalesce(cc.exclusiva_beta,false))
        into v_preco, v_excl
        from public.products p
        left join public.categories cc on cc.id = p.category_id
      where p.id = (v_item->>'product_id')::uuid and p.disponivel and public.servido_hoje(p.dias_semana);
    end if;

    if v_preco is null then
      raise exception 'Item indisponível ou inexistente' using errcode = '22023';
    end if;

    if coalesce(v_excl,false) and v_cb_id is null then
      raise exception 'Artigo exclusivo para Clientes Beta: valide o seu número Beta' using errcode = '22023';
    end if;

    if v_tipo = 'entrega' and (
         (v_item->>'variant_id' is not null and exists (
            select 1 from public.product_variants pv join public.products pp on pp.id = pv.product_id
             where pv.id = (v_item->>'variant_id')::uuid and pp.so_recolha))
      or (v_item->>'variant_id' is null and v_item->>'product_id' is not null and exists (
            select 1 from public.products pp
             where pp.id = (v_item->>'product_id')::uuid and pp.so_recolha))
      or (v_item->>'combo_id' is not null and exists (
            select 1 from public.combo_items ci join public.products pp on pp.id = ci.product_id
             where ci.combo_id = (v_item->>'combo_id')::uuid and pp.so_recolha))
    ) then
      raise exception 'Há artigos só para levantar: escolha levantamento' using errcode = '22023';
    end if;

    insert into public.order_items
      (order_id, product_id, variant_id, combo_id, quantidade, preco_unitario, desconto_percentagem)
    values (
      v_order_id,
      nullif(v_item->>'product_id','')::uuid,
      nullif(v_item->>'variant_id','')::uuid,
      nullif(v_item->>'combo_id','')::uuid,
      v_qtd,
      v_preco,
      v_pct
    );

    v_total := v_total + (v_preco * v_qtd);
    v_desc  := v_desc + (v_preco - round(v_preco * (100 - v_pct) / 100, 2)) * v_qtd;  -- por unidade, igual à fatura
  end loop;

  -- A encomenda mínima conta pelo valor antes do desconto.
  if v_tipo = 'entrega' and v_total < v_min then
    raise exception 'Abaixo da encomenda mínima' using errcode = '22023';
  end if;

  v_total := v_total - v_desc + v_portes;
  update public.orders o set total = v_total, desconto_beta = v_desc where o.id = v_order_id;

  if v_cb_id is not null then
    update public.cliente_beta_validacoes cbv
       set order_id = v_order_id, usado_em = now(), desconto = v_desc
     where cbv.id = p_beta_token;
  end if;

  return query
  select o.id, o.numero, o.total, o.portes, o.estado, o.criado_em
  from public.orders o where o.id = v_order_id;
end;
$function$;

grant execute on function public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb,text,uuid,text,jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
