-- ============================================================================
-- Segurança — Bloco 1 da auditoria de 2026-08-27
-- Estado: APLICADA em 2026-08-27 (produção, projecto upbwaweymbtcatfvjmdg)
--
-- Fecha os pontos 7, 15 e 17 (que eram a mesma falha contada três vezes),
-- o ponto 10 e o ponto 8 da lista de 20 acções.
-- Relatório: docs/auditoria-seguranca-2026-08-27.md
--
-- Aplicada em seis migrações, duas delas correcções a erros meus que os
-- testes apanharam. Ficam registadas abaixo com o erro à vista, porque o
-- erro é a parte instrutiva.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. perfis: leitura restrita e pin_hash fora da API   [pontos 7, 15, 17]
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: SELECT com USING (true) para `authenticated`. Qualquer conta
-- autenticada lia a tabela inteira, incluindo a coluna pin_hash. O código do
-- cliente já só pedia as colunas de que precisa, mas isso é convenção nossa,
-- não barreira: pela API REST bastava pedir a coluna.
--
-- Duas barreiras, porque são coisas diferentes:
--   linha   -> só equipa activa vê perfis   (RLS)
--   coluna  -> pin_hash deixa de ser pedível (GRANT)

drop policy if exists "perfis leitura autenticada" on public.perfis;

create policy "perfis leitura equipa"
  on public.perfis for select to authenticated
  using ((select public.e_equipa()));

revoke all on public.perfis from anon;

-- ERRO E CORRECÇÃO — vale a pena guardar.
-- Primeira tentativa:
--     revoke select (pin_hash) on public.perfis from authenticated;
-- Não funciona. Em Postgres um GRANT ao nível da TABELA cobre todas as
-- colunas, presentes e futuras, e um REVOKE de coluna não lhe abre excepções.
-- O teste apanhou-o: o pin_hash continuava a ser lido. Forma correcta —
-- retirar na tabela, devolver só as colunas usadas:
revoke select, insert, update, delete, truncate, references, trigger
  on public.perfis from authenticated;

grant select (id, email, nome, papel, ativo, criado_em)
  on public.perfis to authenticated;
-- Efeito lateral bem-vindo: uma coluna nova em perfis nasce invisível para a
-- API até alguém a acrescentar aqui de propósito.

comment on column public.perfis.pin_hash is
  'Nunca legível pela API pública (grant revogado a authenticated/anon). '
  'Escrito só por service_role via definir_pin(); lido só por verificar_pin().';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. PIN: bcrypt, 6 dígitos, âmbito próprio             [ponto 10]
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: sha256(id || ':' || pin) com 4 dígitos. Dez mil hipóteses contra um
-- algoritmo feito para ser rápido — testa-se offline num segundo. A única
-- protecção real era o hash não sair da base de dados, e o ponto 1 mostra
-- como isso podia deixar de ser verdade.
--
-- Agora: bcrypt (custo 10) com 6 dígitos. Um milhão de hipóteses a ~50 ms
-- cada é ordem de horas por PIN — e com sal, o trabalho não se reaproveita
-- de um perfil para o outro.

-- definir_pin: o hash sai do Node e passa a ser feito onde o segredo já está.
create or replace function public.definir_pin(p_user uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
begin
  if p_pin is null or p_pin !~ '^\d{6}$' then
    raise exception 'O PIN tem de ter 6 dígitos' using errcode = '22023';
  end if;
  -- Não é uma política de robustez, é só recusar os quatro ou cinco que toda
  -- a gente escolhe primeiro.
  if p_pin ~ '^(.)\1{5}$' or p_pin in ('123456','654321','012345','543210') then
    raise exception 'PIN demasiado óbvio — escolhe outro' using errcode = '22023';
  end if;

  -- Alias obrigatório: sem ele, `where id = ...` seria ambíguo entre a coluna
  -- e uma variável. Foi assim que rebentou na primeira versão (ver ponto 3).
  update public.perfis p
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
   where p.id = p_user;

  if not found then
    raise exception 'Perfil inexistente' using errcode = '22023';
  end if;

  -- Fica o registo de que o PIN mudou e quando. Nunca o PIN.
  insert into public.audit_log (acao, detalhe)
  values ('pin_definido', jsonb_build_object('perfil', p_user, 'em', now()));
end;
$function$;

-- verificar_pin: dois formatos durante a transição, e só a própria conta.
create or replace function public.verificar_pin(p_pin text)
returns table(id uuid, nome text, papel text)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_falhas int;
  v_perfil record;
  v_ok     boolean := false;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  -- 4 a 6 durante a transição. Passa a ^\d{6}$ quando não houver legados.
  if p_pin is null or p_pin !~ '^\d{4,6}$' then
    raise exception 'PIN inválido' using errcode = '22023';
  end if;

  select count(*) into v_falhas
    from public.pin_tentativas t
   where t.auth_uid = v_uid
     and not t.sucesso
     and t.criado_em > now() - interval '15 minutes';

  if v_falhas >= 10 then
    raise exception 'Demasiadas tentativas. Aguarda 15 minutos.'
      using errcode = '22023';
  end if;

  -- MUDANÇA DE SEMÂNTICA, de propósito: só a própria conta.
  -- A versão anterior procurava o PIN em TODOS os perfis e devolvia o dono;
  -- o cliente é que rejeitava se não fosse o próprio. Ou seja, o servidor
  -- confirmava a quem perguntasse que um PIN era válido para alguém. Quem
  -- chamasse a RPC directamente varria os PINs dos colegas. Os dois ecrãs
  -- (CaixaPdv, EquipaLayout) já comparavam com a própria conta, por isso
  -- para eles não muda nada.
  select p.id, p.nome, p.papel, p.pin_hash into v_perfil
    from public.perfis p
   where p.id = v_uid and p.ativo and p.pin_hash is not null;

  if v_perfil.id is not null then
    if v_perfil.pin_hash like '$2%' then
      v_ok := v_perfil.pin_hash = extensions.crypt(p_pin, v_perfil.pin_hash);
    else
      -- Legado sha256, 4 dígitos. Continua a abrir, mas NÃO se transforma
      -- sozinho — ver a nota sobre a subida automática no ponto 3.
      v_ok := v_perfil.pin_hash
              = encode(extensions.digest(v_perfil.id::text || ':' || p_pin, 'sha256'), 'hex');
    end if;
  end if;

  insert into public.pin_tentativas (auth_uid, sucesso) values (v_uid, v_ok);

  if not v_ok then return; end if;
  return query select v_perfil.id, v_perfil.nome, v_perfil.papel;
end;
$function$;


-- ─────────────────────────────────────────────────────────────────────────
-- 3. pin_estado diz ao ecrã quantos dígitos esperar
-- ─────────────────────────────────────────────────────────────────────────
-- Dois problemas do bloco anterior, ambos apanhados antes de chegarem ao ar.
--
-- (a) O portão de PIN verifica assim que o campo tem 4 dígitos. Com PINs de
--     6, cada entrada CORRECTA gastava duas tentativas falhadas (aos 4 e aos
--     5) antes de acertar aos 6 — e o travão é às 10. Cinco entradas
--     correctas trancavam a pessoa fora. O ecrã precisa de saber o
--     comprimento, e só o servidor sabe.
--
-- (b) A subida automática do hash legado para bcrypt era boa ideia com um
--     efeito lateral mau: depois de subir, o formato deixava de distinguir
--     um PIN de 4 de um de 6, e o ecrã ficava sem forma de saber o
--     comprimento. Saiu. Um PIN legado fica legado até ser substituído por
--     um de 6 no painel — estado legível vale mais do que esperteza.

drop function if exists public.pin_estado();

create function public.pin_estado()
returns table(tem_pin_proprio boolean, existem_pins boolean, digitos int)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    exists (select 1 from public.perfis p
             where p.id = auth.uid() and p.ativo and p.pin_hash is not null),
    exists (select 1 from public.perfis p
             where p.ativo and p.pin_hash is not null),
    -- bcrypt ('$2...') = PIN novo, 6 dígitos. Qualquer outro formato é o
    -- sha256 antigo, que só existe com 4. É sempre sobre quem pergunta:
    -- ninguém fica a saber nada da conta de outra pessoa.
    coalesce((select case when p.pin_hash like '$2%' then 6 else 4 end
                from public.perfis p
               where p.id = auth.uid() and p.ativo and p.pin_hash is not null), 6);
$function$;


-- ─────────────────────────────────────────────────────────────────────────
-- 4. Quem pode executar o quê
-- ─────────────────────────────────────────────────────────────────────────
-- ARMADILHA: uma função criada de novo nasce com EXECUTE concedido a PUBLIC,
-- e `anon`/`authenticated` herdam de PUBLIC. Revogar só de `anon` não faz
-- nada. É a mesma hierarquia do ponto 1 — retirar por baixo, devolver por
-- cima. O pin_estado passou por aqui porque foi recriado com DROP + CREATE.

revoke all on function public.definir_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.definir_pin(uuid, text) to service_role;

revoke all on function public.verificar_pin(text) from public, anon;
grant execute on function public.verificar_pin(text) to authenticated;

revoke all on function public.pin_estado() from public, anon;
grant execute on function public.pin_estado() to authenticated, service_role;

revoke all on function public.existem_pins() from public, anon;
grant execute on function public.existem_pins() to authenticated, service_role;

revoke all on function public.pins_definidos() from public, anon;
grant execute on function public.pins_definidos() to authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────
-- 5. Mass assignment: colunas de escrita restritas       [ponto 8]
-- ─────────────────────────────────────────────────────────────────────────
-- O essencial já estava feito — perfis não tem política de INSERT nem de
-- UPDATE, por isso ninguém se promove a admin. Ficavam três frestas.

-- (a) orders: a política de UPDATE exige e_equipa(), mas RLS filtra LINHAS,
--     não COLUNAS. Quem passasse a política podia alterar `total`. Não é
--     ataque de fora, é controlo interno — e é o único destes três que mexe
--     em dinheiro. As colunas abaixo são exactamente as que os ecrãs
--     escrevem (CaixaPdv, Staff, Operacional).
revoke update on public.orders from authenticated;
grant update (estado, estado_pagamento, metodo_pagamento,
              fatura_pedida, fatura_nif, estafeta_id, estafeta_taxa)
  on public.orders to authenticated;

revoke update on public.order_items from authenticated;
grant update (estado) on public.order_items to authenticated;

-- (b) feedback: with_check era `true`, e a tabela tem `lido boolean default
--     false`. Bastava enviar lido:true e a crítica entrava marcada como
--     vista — ninguém a via na caixa. Pequeno, mas é mass assignment com
--     efeito real.
drop policy if exists "feedback insert publico" on public.feedback;
create policy "feedback insert publico"
  on public.feedback for insert to public
  with check (lido is not true);

-- (c) colaborador_documentos: a lista branca prendia candidatura_id,
--     colaborador_id e tipo, mas deixava `caminho` livre — dava para inserir
--     uma linha a apontar para qualquer ficheiro do bucket. Impacto baixo
--     (anon não tem SELECT), mas uma lista branca com um buraco não é uma
--     lista branca.
drop policy if exists "documento anonimo" on public.colaborador_documentos;
create policy "documento anonimo"
  on public.colaborador_documentos for insert to anon
  with check (
    candidatura_id is not null
    and colaborador_id is null
    and tipo = any (array['curriculo','certificado_formacao','carta_conducao','comprovativo_atividade'])
    and caminho like candidatura_id::text || '/%'
  );


-- ============================================================================
-- POR FAZER quando os dois PINs legados forem substituídos por 6 dígitos:
--
--   -- em verificar_pin, trocar
--   if p_pin is null or p_pin !~ '^\d{4,6}$' then
--   -- por
--   if p_pin is null or p_pin !~ '^\d{6}$' then
--
--   -- e em pin_estado, o `case ... else 4 end` deixa de ter caso.
--
-- Verificar antes com:
--   select count(*) from public.perfis
--    where pin_hash is not null and pin_hash not like '$2%';
--   -- tem de dar 0
-- ============================================================================
