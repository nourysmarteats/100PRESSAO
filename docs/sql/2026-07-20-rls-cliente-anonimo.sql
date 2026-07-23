-- =====================================================================
-- 2026-07-20 — Fecho do acesso anónimo a sessions / orders / order_items
--
-- Autor: Daniel Cunha (TI) · Auditoria: Bea Salgado (Segurança)
-- Estado: PARA REVISÃO — NÃO APLICADO
--
-- ---------------------------------------------------------------------
-- PROBLEMA
--
-- 1. LEITURA ABERTA (exposição de dados pessoais)
--    As políticas `anon le` em sessions/orders/order_items são
--    USING (true) para o papel `public`. A chave anónima está dentro do
--    JavaScript do cardápio, logo qualquer pessoa lê:
--      - sessions.nome_cliente e posicao_mesa
--      - orders.fatura_nif, total, metodo_pagamento
--    Actualmente: 22 sessões, 15 nomes distintos, 5 NIF, €255,30.
--
-- 2. PREÇO CONTROLADO PELO CLIENTE (exposição a fraude)
--    Cardapio.jsx envia `total` e `preco_unitario` no INSERT. Como o
--    INSERT anónimo é WITH CHECK (true), qualquer pessoa regista um
--    pedido de €50 com total de €0,50. O servidor nunca valida o preço.
--
-- 3. ESCRITA ANÓNIMA SEM LIMITE
--    Pedidos podem ser injectados directamente na cozinha, fora da app.
--
-- ---------------------------------------------------------------------
-- ABORDAGEM
--
-- O cliente do cardápio, na prática, só INSERE. Nunca consulta pedidos
-- existentes — o ecrã de confirmação usa o objecto que já tem em memória
-- (ver Cardapio.jsx: aoConcluir(order, entradas)). O Realtime de orders
-- só é subscrito nas páginas de equipa, que são autenticadas.
--
-- Logo: o anónimo não precisa de SELECT nenhum. Substituímos o acesso
-- directo às tabelas por duas funções SECURITY DEFINER que validam a
-- entrada, calculam o preço do lado do servidor e devolvem só o que o
-- cliente precisa de ver.
--
-- Resultado: zero leitura anónima, preço não manipulável, e o
-- comportamento visível da aplicação mantém-se.
--
-- ---------------------------------------------------------------------
-- REQUER ALTERAÇÃO NO FRONTEND — ver secção final. Aplicar as duas
-- coisas na mesma janela, ou o cardápio deixa de funcionar.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Criar sessão de cliente
-- ---------------------------------------------------------------------
create or replace function public.criar_sessao(
  p_nome  text,
  p_mesa  text default null
)
returns table (id uuid, nome_cliente text, posicao_mesa text, criado_em timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
  v_mesa text := nullif(btrim(p_mesa), '');
begin
  if v_nome is null then
    raise exception 'Nome obrigatório' using errcode = '22023';
  end if;

  -- Limites defensivos: impedem que o campo seja usado como depósito
  -- de texto arbitrário.
  if length(v_nome) > 60 then
    raise exception 'Nome demasiado longo' using errcode = '22023';
  end if;
  if v_mesa is not null and length(v_mesa) > 20 then
    raise exception 'Mesa inválida' using errcode = '22023';
  end if;

  return query
  insert into public.sessions (nome_cliente, posicao_mesa)
  values (v_nome, v_mesa)
  returning sessions.id, sessions.nome_cliente, sessions.posicao_mesa, sessions.criado_em;
end;
$$;

revoke all on function public.criar_sessao(text, text) from public;
grant execute on function public.criar_sessao(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Criar pedido — preço calculado no servidor
-- ---------------------------------------------------------------------
-- p_itens: jsonb array. Cada elemento:
--   { "product_id": uuid|null, "variant_id": uuid|null,
--     "combo_id": uuid|null, "quantidade": int }
--
-- NOTA: o cliente deixa de enviar preços. São lidos das tabelas.
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido(
  p_session_id uuid,
  p_metodo     text,
  p_itens      jsonb
)
returns table (id uuid, numero bigint, total numeric, estado pedido_estado, criado_em timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_total    numeric(10,2) := 0;
  v_item     jsonb;
  v_preco    numeric(10,2);
  v_qtd      int;
  v_n_itens  int;
begin
  -- 2.1 Sessão tem de existir e ser recente (janela de serviço: 12h)
  if not exists (
    select 1 from public.sessions s
    where s.id = p_session_id
      and s.criado_em > now() - interval '12 hours'
  ) then
    raise exception 'Sessão inválida ou expirada' using errcode = '22023';
  end if;

  -- 2.2 Método de pagamento tem de ser um dos aceites
  if p_metodo is null or p_metodo not in ('dinheiro','multibanco','mbway','cartao') then
    raise exception 'Método de pagamento inválido' using errcode = '22023';
  end if;

  -- 2.3 Carrinho não vazio e com dimensão sensata
  v_n_itens := coalesce(jsonb_array_length(p_itens), 0);
  if v_n_itens = 0 then
    raise exception 'Pedido sem itens' using errcode = '22023';
  end if;
  if v_n_itens > 50 then
    raise exception 'Pedido demasiado grande' using errcode = '22023';
  end if;

  -- 2.4 Travão de ritmo: no máximo 5 pedidos por sessão em 10 minutos.
  --     Não impede um ataque determinado, mas trava o caso trivial de
  --     alguém em loop a encher a cozinha.
  if (
    select count(*) from public.orders o
    where o.session_id = p_session_id
      and o.criado_em > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'Demasiados pedidos seguidos. Aguarda um momento.'
      using errcode = '22023';
  end if;

  insert into public.orders (session_id, estado, metodo_pagamento, estado_pagamento, total)
  values (p_session_id, 'recebido', p_metodo, 'pendente', 0)
  returning orders.id into v_order_id;

  -- 2.5 Cada item: preço vem SEMPRE da base de dados, nunca do cliente.
  --     Ordem de precedência igual à do frontend: combo > variante > produto.
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := coalesce((v_item->>'quantidade')::int, 0);
    if v_qtd < 1 or v_qtd > 99 then
      raise exception 'Quantidade inválida' using errcode = '22023';
    end if;

    v_preco := null;

    if v_item->>'combo_id' is not null then
      select c.preco into v_preco from public.combos c
      where c.id = (v_item->>'combo_id')::uuid and c.disponivel;
    elsif v_item->>'variant_id' is not null then
      select pv.preco into v_preco from public.product_variants pv
      where pv.id = (v_item->>'variant_id')::uuid and pv.disponivel;
    elsif v_item->>'product_id' is not null then
      select p.preco into v_preco from public.products p
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

  update public.orders o set total = v_total where o.id = v_order_id;

  return query
  select o.id, o.numero, o.total, o.estado, o.criado_em
  from public.orders o where o.id = v_order_id;
end;
$$;

revoke all on function public.criar_pedido(uuid, text, jsonb) from public;
grant execute on function public.criar_pedido(uuid, text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Remover o acesso anónimo directo às tabelas
-- ---------------------------------------------------------------------
-- A partir daqui o papel `anon` não lê nem escreve nestas tabelas.
-- Todo o acesso do cliente passa pelas duas funções acima.
-- ---------------------------------------------------------------------

drop policy if exists "anon le"     on public.sessions;
drop policy if exists "anon insere" on public.sessions;

drop policy if exists "anon le"     on public.orders;
drop policy if exists "anon insere" on public.orders;

drop policy if exists "anon le"     on public.order_items;
drop policy if exists "anon insere" on public.order_items;


-- ---------------------------------------------------------------------
-- 4. Leitura para a equipa (substitui a leitura anónima)
-- ---------------------------------------------------------------------
-- As páginas de equipa (Operacional, Staff, Ecrã, Caixa, Analytics)
-- deixam de depender da política anónima. Passam a ler como staff
-- activo, validado contra `perfis`.
--
-- Isto NÃO altera o comportamento visível — apenas exige que a sessão
-- esteja autenticada, o que já acontece (signInWithPassword).
-- ---------------------------------------------------------------------

create policy "equipa le sessoes" on public.sessions
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo
  ));

create policy "equipa le pedidos" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo
  ));

create policy "equipa le itens" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo
  ));

commit;


-- =====================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO
-- =====================================================================
-- Correr e confirmar que NÃO devolve nenhuma linha com roles={public}:
--
--   select tablename, policyname, cmd, roles::text
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('sessions','orders','order_items')
--   order by tablename, cmd;
--
-- =====================================================================
-- ALTERAÇÕES NECESSÁRIAS NO FRONTEND (src/pages/Cardapio.jsx)
-- =====================================================================
--
-- ANTES (linha ~257) — iniciarSessao:
--   supabase.from('sessions')
--     .insert({ nome_cliente: nome.trim(), posicao_mesa: mesa.trim() || null })
--     .select().single()
--
-- DEPOIS:
--   supabase.rpc('criar_sessao', {
--     p_nome: nome.trim(),
--     p_mesa: mesa.trim() || null,
--   }).single()
--
-- ---------------------------------------------------------------------
--
-- ANTES (linha ~281) — confirmarPedido: dois INSERT separados,
-- com `total` e `preco_unitario` vindos do browser.
--
-- DEPOIS: uma só chamada, sem preços.
--
--   const itens = entradas.map(({ r, qtd }) => ({
--     product_id: r.produto?.id ?? null,
--     variant_id: r.variante?.id ?? null,
--     combo_id:   r.combo?.id ?? null,
--     quantidade: qtd,
--   }))
--
--   const { data: order, error } = await comTimeout(
--     supabase.rpc('criar_pedido', {
--       p_session_id: sessao.id,
--       p_metodo: metodo,
--       p_itens: itens,
--     }).single()
--   )
--
-- NOTA: `order.total` passa a vir do servidor. Se divergir de
-- `totalCarrinho`, o servidor tem razão — mostrar o valor devolvido.
-- Uma divergência persistente indica preços desactualizados no frontend.
-- =====================================================================
