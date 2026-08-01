-- =====================================================================
-- 2026-08-01 — Restaurante Online: checkout real (encomendas + pagamento)
--
-- Dá corpo ao canal próprio de encomendas (/restaurante). Até aqui era só
-- simulação. Agora cria encomendas REAIS, com pagamento IfThenPay (MB Way /
-- Multibanco). Mesmo modelo de segurança do /cardapio: o cliente anónimo
-- nunca escreve direto nas tabelas nem controla o preço — tudo passa por uma
-- função SECURITY DEFINER que lê os preços (preco_online) da base de dados.
--
-- Aplicar no SQL Editor do Supabase. Idempotente, não-destrutiva.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas do canal online em orders
-- ---------------------------------------------------------------------
-- canal: 'mesa' (default, retrocompatível) | 'online'. As encomendas de
-- mesa existentes ficam automaticamente 'mesa'. A cozinha só mostra
-- encomendas online quando estado_pagamento = 'pago' (ver frontend/lib).
alter table public.orders
  add column if not exists canal            text not null default 'mesa',
  add column if not exists tipo_entrega     text,               -- 'entrega' | 'levar'
  add column if not exists cliente_nome     text,
  add column if not exists cliente_telefone text,
  add column if not exists cliente_email    text,
  add column if not exists morada           text,
  add column if not exists distancia_km     numeric(6,2),
  add column if not exists portes           numeric(10,2) not null default 0,
  add column if not exists pagamento_id     text,               -- RequestId IfThenPay (MB Way)
  add column if not exists pagamento_ref    jsonb,              -- {entidade, referencia, valor} (Multibanco)
  add column if not exists pago_em          timestamptz,
  add column if not exists idade_confirmada boolean not null default false,     -- Brandão E
  add column if not exists aceitou_condicoes_em timestamptz;                     -- Brandão J

-- Índice para o callback do IfThenPay encontrar a encomenda depressa.
create index if not exists orders_pagamento_id_idx on public.orders (pagamento_id);


-- ---------------------------------------------------------------------
-- 2. Criar encomenda online — preço e portes calculados no servidor
-- ---------------------------------------------------------------------
-- p_itens: jsonb array, cada elemento:
--   { "product_id": uuid|null, "variant_id": uuid|null,
--     "combo_id": uuid|null, "quantidade": int }
--
-- Preço usado: preco_online quando definido, senão o preço local (coalesce).
-- Portes: lidos da config 'entrega' (definicoes) — grátis até km_gratis,
-- depois taxa_base + preco_km × (km − km_gratis), até raio_max.
--
-- A encomenda nasce estado='recebido' mas estado_pagamento='pendente'.
-- Só fica visível na cozinha quando o pagamento confirma (estado_pagamento
-- = 'pago'), feito pelo callback IfThenPay do lado do servidor.
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido_online(
  p_nome      text,
  p_telefone  text,
  p_email     text,
  p_tipo      text,        -- 'entrega' | 'levar'
  p_morada    text,
  p_distancia numeric,
  p_metodo    text,        -- 'mbway' | 'multibanco'
  p_idade_ok  boolean,
  p_aceitou   boolean,
  p_itens     jsonb
)
returns table (id uuid, numero bigint, total numeric, portes numeric, estado pedido_estado, criado_em timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome     text := nullif(btrim(p_nome), '');
  v_tel      text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
  v_email    text := nullif(btrim(lower(p_email)), '');
  v_morada   text := nullif(btrim(p_morada), '');
  v_tipo     text := lower(coalesce(p_tipo, ''));
  v_dist     numeric := coalesce(p_distancia, 0);
  v_session  uuid;
  v_order_id uuid;
  v_total    numeric(10,2) := 0;
  v_portes   numeric(10,2) := 0;
  v_item     jsonb;
  v_preco    numeric(10,2);
  v_qtd      int;
  v_n_itens  int;
  v_cfg      jsonb;
  v_min      numeric;
  v_kmg      numeric;
  v_taxa     numeric;
  v_pkm      numeric;
  v_raio     numeric;
begin
  -- 2.1 Validações de identidade / contacto (obrigatórios para poder
  --     confirmar a encomenda em suporte duradouro — email/telefone).
  if v_nome is null or length(v_nome) > 80 then
    raise exception 'Nome inválido' using errcode = '22023';
  end if;
  if v_tel !~ '^\d{9}$' then
    raise exception 'Telemóvel inválido (9 dígitos)' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then
    raise exception 'Email inválido' using errcode = '22023';
  end if;
  if v_tipo not in ('entrega', 'levar') then
    raise exception 'Tipo de encomenda inválido' using errcode = '22023';
  end if;

  -- 2.2 Requisitos legais do checkout (Brandão): idade + aceitação.
  if p_idade_ok is not true then
    raise exception 'É necessário confirmar que tem 18 anos ou mais' using errcode = '22023';
  end if;
  if p_aceitou is not true then
    raise exception 'É necessário aceitar as Condições de Venda' using errcode = '22023';
  end if;

  -- 2.3 Método de pagamento (nesta fase: só online, MB Way ou Multibanco).
  if p_metodo not in ('mbway', 'multibanco') then
    raise exception 'Método de pagamento inválido' using errcode = '22023';
  end if;

  -- 2.4 Carrinho.
  v_n_itens := coalesce(jsonb_array_length(p_itens), 0);
  if v_n_itens = 0 then
    raise exception 'Encomenda sem itens' using errcode = '22023';
  end if;
  if v_n_itens > 50 then
    raise exception 'Encomenda demasiado grande' using errcode = '22023';
  end if;

  -- 2.5 Config de entrega (com defaults se a chave não existir).
  select valor into v_cfg from public.definicoes where chave = 'entrega';
  v_min  := coalesce((v_cfg->>'min_encomenda')::numeric, 20);
  v_kmg  := coalesce((v_cfg->>'km_gratis')::numeric, 2);
  v_taxa := coalesce((v_cfg->>'taxa_base')::numeric, 1.6);
  v_pkm  := coalesce((v_cfg->>'preco_km')::numeric, 0.9);
  v_raio := coalesce((v_cfg->>'raio_max')::numeric, 12);

  if v_tipo = 'entrega' then
    if v_morada is null then
      raise exception 'Morada de entrega obrigatória' using errcode = '22023';
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

  -- 2.6 Sessão (reaproveita o modelo de mesa: a cozinha lê nome + "posição").
  insert into public.sessions (nome_cliente, posicao_mesa)
  values (v_nome, case when v_tipo = 'entrega' then 'Entrega' else 'Levantamento' end)
  returning sessions.id into v_session;

  -- 2.7 Encomenda (total 0 por agora; somado abaixo). Nasce pendente de
  --     pagamento e invisível na cozinha até o pagamento confirmar.
  insert into public.orders (
    session_id, estado, metodo_pagamento, estado_pagamento, total,
    canal, tipo_entrega, cliente_nome, cliente_telefone, cliente_email,
    morada, distancia_km, portes, idade_confirmada, aceitou_condicoes_em
  )
  values (
    v_session, 'recebido', p_metodo, 'pendente', 0,
    'online', v_tipo, v_nome, v_tel, v_email,
    v_morada, v_dist, v_portes, true, now()
  )
  returning orders.id into v_order_id;

  -- 2.8 Itens: preço SEMPRE da base de dados (preco_online, fallback preco).
  --     Precedência igual ao frontend: combo > variante > produto.
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := coalesce((v_item->>'quantidade')::int, 0);
    if v_qtd < 1 or v_qtd > 99 then
      raise exception 'Quantidade inválida' using errcode = '22023';
    end if;

    v_preco := null;

    if v_item->>'combo_id' is not null then
      select coalesce(c.preco_online, c.preco) into v_preco from public.combos c
      where c.id = (v_item->>'combo_id')::uuid and c.disponivel;
    elsif v_item->>'variant_id' is not null then
      select coalesce(pv.preco_online, pv.preco) into v_preco from public.product_variants pv
      where pv.id = (v_item->>'variant_id')::uuid and pv.disponivel;
    elsif v_item->>'product_id' is not null then
      select coalesce(p.preco_online, p.preco) into v_preco from public.products p
      where p.id = (v_item->>'product_id')::uuid and p.disponivel;
    end if;

    if v_preco is null then
      raise exception 'Item indisponível ou inexistente' using errcode = '22023';
    end if;

    insert into public.order_items
      (order_id, product_id, variant_id, combo_id, quantidade, preco_unitario)
    values (
      v_order_id,
      nullif(v_item->>'product_id','')::uuid,
      nullif(v_item->>'variant_id','')::uuid,
      nullif(v_item->>'combo_id','')::uuid,
      v_qtd,
      v_preco
    );

    v_total := v_total + (v_preco * v_qtd);
  end loop;

  -- 2.9 Encomenda mínima (só entrega) sobre o subtotal (sem portes).
  if v_tipo = 'entrega' and v_total < v_min then
    raise exception 'Abaixo da encomenda mínima' using errcode = '22023';
  end if;

  v_total := v_total + v_portes;
  update public.orders o set total = v_total where o.id = v_order_id;

  return query
  select o.id, o.numero, o.total, o.portes, o.estado, o.criado_em
  from public.orders o where o.id = v_order_id;
end;
$$;

revoke all on function public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb) from public;
grant execute on function public.criar_pedido_online(text,text,text,text,text,numeric,text,boolean,boolean,jsonb) to anon, authenticated;


-- =====================================================================
-- VERIFICAÇÃO
-- =====================================================================
--   select column_name from information_schema.columns
--   where table_name='orders' and column_name in
--     ('canal','tipo_entrega','portes','pagamento_id','pago_em');
-- =====================================================================
