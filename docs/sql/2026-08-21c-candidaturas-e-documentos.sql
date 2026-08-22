-- 2026-08-21 — APLICADA em 2026-08-21.
-- Migrações: `colaborador_candidaturas_e_documentos` e
--            `candidaturas_documentos_por_funcao`.
--
-- Fases B, D e E do Gestor de Colaboradores: documentos, portal público de
-- candidatura e triagem. Este ficheiro é o estado final das duas migrações
-- somadas — correr de novo é seguro.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O PRINCÍPIO QUE MANDA EM TUDO O QUE ESTÁ AQUI
-- ─────────────────────────────────────────────────────────────────────────
-- Um candidato NUNCA escreve em `colaboradores`. Escreve numa tabela de
-- entrada, de onde só sai por acto explícito de um administrador. Os dados
-- que alimentam o apuramento da Segurança Social têm de ser dados que
-- alguém de 100PRESSÃO verificou — senão o número não vale nada.
--
-- DUAS FASES DE RECOLHA. Na candidatura não há NIF, NISS, IBAN, morada nem
-- data de nascimento. Esses só se pedem depois da decisão e entram pelo
-- painel. De quem for recusado, nunca chegamos a ter nada disso.
--
-- SEM CÓPIAS DO CARTÃO DE CIDADÃO. O art. 5.º/2 da Lei 7/2007 só permite
-- reproduzir o CC com previsão legal, ordem judicial ou consentimento; a
-- CNPD acrescenta que o consentimento só é livre havendo alternativa
-- efectiva de identificação — que num formulário com upload obrigatório não
-- existe. A lista de tipos de documento reflecte isso.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Candidaturas ──────────────────────────────────────────────────────────
create table if not exists public.colaborador_candidaturas (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null,
  email                 text not null,
  telefone              text,
  funcao_pretendida     text not null,
  disponibilidade       text,
  experiencia           text,
  mensagem              text,
  estado                text not null default 'nova',
  notas_internas        text,
  colaborador_id        uuid references public.colaboradores(id) on delete set null,
  consentimento_reserva boolean not null default false,
  origem                text not null default 'portal',
  ip_hash               text,
  criado_em             timestamptz not null default now(),
  decidido_em           timestamptz,
  expira_em             date,

  constraint candidatura_estado_valido
    check (estado in ('nova','em_analise','entrevista','aceite','recusada','arquivada')),
  constraint candidatura_origem_valida
    check (origem in ('portal','presencial','indicacao')),
  constraint candidatura_email_plausivel
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint candidatura_nome_com_substancia
    check (length(btrim(nome)) >= 3)
);

alter table public.colaborador_candidaturas drop constraint if exists candidatura_funcao_valida;
alter table public.colaborador_candidaturas add constraint candidatura_funcao_valida
  check (funcao_pretendida in ('cozinha','balcao','sala','entregas','servicos','outra'));

comment on table public.colaborador_candidaturas is
  'Porta de entrada pública. Fase 1 da minimização: aqui NÃO há NIF, NISS, IBAN, morada nem data de nascimento.';
comment on column public.colaborador_candidaturas.ip_hash is
  'Hash de uma impressão do cliente, nunca o IP. Só serve para travar submissões em catadupa, e é falsificável.';
comment on column public.colaborador_candidaturas.expira_em is
  'Calculado por trigger: 6 meses, ou 12 com consentimento para reserva.';

create index if not exists candidaturas_estado_idx on public.colaborador_candidaturas (estado, criado_em desc);
create index if not exists candidaturas_expira_idx on public.colaborador_candidaturas (expira_em);
create index if not exists candidaturas_ip_idx     on public.colaborador_candidaturas (ip_hash, criado_em desc);

-- Prazo de conservação calculado, não confiado à memória de ninguém.
create or replace function public.candidatura_calcula_expiracao()
returns trigger language plpgsql as $$
begin
  new.expira_em := (coalesce(new.criado_em, now())
                    + case when new.consentimento_reserva
                           then interval '12 months' else interval '6 months' end)::date;
  return new;
end;
$$;

drop trigger if exists candidatura_calcula_expiracao on public.colaborador_candidaturas;
create trigger candidatura_calcula_expiracao
  before insert or update of consentimento_reserva on public.colaborador_candidaturas
  for each row execute function public.candidatura_calcula_expiracao();

-- ── Documentos ────────────────────────────────────────────────────────────
create table if not exists public.colaborador_documentos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid references public.colaboradores(id) on delete cascade,
  candidatura_id uuid references public.colaborador_candidaturas(id) on delete cascade,
  tipo           text not null,
  caminho        text not null unique,
  nome_original  text,
  bytes          int,
  mime           text,
  validade       date,
  carregado_em   timestamptz not null default now(),
  carregado_por  uuid references auth.users(id),

  constraint documento_tem_dono
    check (colaborador_id is not null or candidatura_id is not null)
);

alter table public.colaborador_documentos drop constraint if exists documento_tipo_valido;
alter table public.colaborador_documentos add constraint documento_tipo_valido
  check (tipo in (
    'curriculo',
    'certificado_formacao',
    'carta_conducao',
    'comprovativo_atividade',   -- Declaração de Início de Atividade (AT)
    'contrato',
    'declaracao_rendimento',
    'recibo',
    'outro'
  ));

comment on constraint documento_tipo_valido on public.colaborador_documentos is
  'Documentos de identificação não constam de propósito — Lei 7/2007, art. 5.º/2 e orientação da CNPD sobre reprodução do Cartão de Cidadão.';

create index if not exists documentos_colaborador_idx on public.colaborador_documentos (colaborador_id);
create index if not exists documentos_candidatura_idx on public.colaborador_documentos (candidatura_id);

-- ── Bucket privado ────────────────────────────────────────────────────────
-- Tamanho e MIME impostos pelo Storage, do lado do servidor. O `accept` do
-- input e o Content-Type do pedido são ambos falsificáveis; isto não é.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidaturas','candidaturas', false, 5242880,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists "candidaturas anon escreve" on storage.objects;
create policy "candidaturas anon escreve" on storage.objects
  for insert to anon with check (bucket_id = 'candidaturas');

drop policy if exists "candidaturas admin le" on storage.objects;
create policy "candidaturas admin le" on storage.objects
  for select to authenticated using (bucket_id = 'candidaturas' and (select e_admin()));

drop policy if exists "candidaturas admin apaga" on storage.objects;
create policy "candidaturas admin apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'candidaturas' and (select e_admin()));

-- ── Travão de submissões ──────────────────────────────────────────────────
-- Defesa em profundidade, não a defesa principal: o ip_hash vem do cliente.
-- A protecção a sério é o Turnstile, que ainda falta.
create or replace function public.candidatura_dentro_do_limite(p_ip_hash text)
returns boolean language sql security definer stable
set search_path = public as $$
  select coalesce(p_ip_hash,'') = ''
      or (select count(*) from public.colaborador_candidaturas
           where ip_hash = p_ip_hash and criado_em > now() - interval '1 hour') < 3
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.colaborador_candidaturas enable row level security;
alter table public.colaborador_documentos   enable row level security;

-- O anónimo escreve, e escreve pouco: não pode nascer já aceite, não pode
-- trazer notas internas, e não se pode ligar a um colaborador existente.
drop policy if exists "candidatura anonima" on public.colaborador_candidaturas;
create policy "candidatura anonima" on public.colaborador_candidaturas
  for insert to anon
  with check (
    estado = 'nova' and origem = 'portal'
    and colaborador_id is null and notas_internas is null and decidido_em is null
    and public.candidatura_dentro_do_limite(ip_hash)
  );

-- E não lê nada. Nem a sua própria candidatura.
drop policy if exists "candidaturas admin" on public.colaborador_candidaturas;
create policy "candidaturas admin" on public.colaborador_candidaturas
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

drop policy if exists "documento anonimo" on public.colaborador_documentos;
create policy "documento anonimo" on public.colaborador_documentos
  for insert to anon
  with check (
    candidatura_id is not null and colaborador_id is null
    and tipo in ('curriculo','certificado_formacao','carta_conducao','comprovativo_atividade')
  );

drop policy if exists "documentos admin" on public.colaborador_documentos;
create policy "documentos admin" on public.colaborador_documentos
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

-- ── Configuração do portal ────────────────────────────────────────────────
-- `via` diz o que 100PRESSÃO tenciona que aquela função seja. Não é escolha
-- do candidato, e é por isso que vive aqui e não no formulário.
--
-- O comprovativo de início de atividade só é exigido na via de prestação de
-- serviços. Exigi-lo a um candidato a cozinha seria decidir o vínculo antes
-- da entrevista, e deixar isso escrito num formulário público.
insert into public.definicoes (chave, valor, atualizado_em)
values (
  'candidaturas',
  jsonb_build_object(
    'portal_aberto', false,
    'email_notificacao', 'equipa@100pressao.pt',
    'max_anexos', 3,
    'funcoes', jsonb_build_object(
      'cozinha',  jsonb_build_object('rotulo','Cozinha',               'via','emprego',  'obrigatorios', jsonb_build_array()),
      'balcao',   jsonb_build_object('rotulo','Balcão',                'via','emprego',  'obrigatorios', jsonb_build_array()),
      'sala',     jsonb_build_object('rotulo','Sala',                  'via','emprego',  'obrigatorios', jsonb_build_array()),
      'entregas', jsonb_build_object('rotulo','Entregas',              'via','emprego',  'obrigatorios', jsonb_build_array()),
      'servicos', jsonb_build_object('rotulo','Prestação de serviços', 'via','prestacao','obrigatorios', jsonb_build_array('comprovativo_atividade')),
      'outra',    jsonb_build_object('rotulo','Outra',                 'via','emprego',  'obrigatorios', jsonb_build_array())
    )
  ),
  now()
)
on conflict (chave) do update
  set valor = excluded.valor || definicoes.valor, atualizado_em = now();

-- ── Promoção a colaborador ────────────────────────────────────────────────
-- Numa transacção só: nasce o colaborador, os documentos mudam de dono, a
-- candidatura fica marcada, e fica registo no audit_log.
create or replace function public.promover_candidatura(
  p_candidatura uuid, p_funcao text default null,
  p_vinculo text default null, p_fundamento text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_cand public.colaborador_candidaturas%rowtype; v_id uuid;
begin
  if not e_admin() then raise exception 'Sem permissão para promover candidaturas.'; end if;

  select * into v_cand from public.colaborador_candidaturas where id = p_candidatura;
  if not found then raise exception 'Candidatura não encontrada.'; end if;
  if v_cand.colaborador_id is not null then raise exception 'Esta candidatura já foi promovida.'; end if;

  insert into public.colaboradores (nome, email, telefone, funcao, vinculo, vinculo_fundamento, estado)
  values (v_cand.nome, v_cand.email, v_cand.telefone,
          coalesce(p_funcao, v_cand.funcao_pretendida), p_vinculo, p_fundamento, 'activo')
  returning id into v_id;

  update public.colaborador_documentos set colaborador_id = v_id where candidatura_id = p_candidatura;

  update public.colaborador_candidaturas
     set estado = 'aceite', colaborador_id = v_id, decidido_em = now()
   where id = p_candidatura;

  insert into public.audit_log (user_id, acao, detalhe)
  values (auth.uid(), 'candidatura_promovida',
          jsonb_build_object('candidatura', p_candidatura, 'colaborador', v_id, 'vinculo', p_vinculo));

  return v_id;
end;
$$;

-- ── Expurgo ───────────────────────────────────────────────────────────────
-- Um prazo de conservação que ninguém executa não é um prazo, é uma frase
-- numa política. Isto apaga registo E ficheiros.
create or replace function public.expurgar_candidaturas()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from storage.objects
   where bucket_id = 'candidaturas'
     and name in (select d.caminho from public.colaborador_documentos d
                    join public.colaborador_candidaturas c on c.id = d.candidatura_id
                   where c.expira_em < current_date and c.colaborador_id is null);

  with apagadas as (
    delete from public.colaborador_candidaturas
     where expira_em < current_date and colaborador_id is null
    returning 1
  ) select count(*) into v_n from apagadas;

  if v_n > 0 then
    insert into public.audit_log (acao, detalhe)
    values ('candidaturas_expurgadas', jsonb_build_object('quantidade', v_n));
  end if;
  return v_n;
end;
$$;

revoke all on function public.promover_candidatura(uuid, text, text, text) from public, anon;
grant execute on function public.promover_candidatura(uuid, text, text, text) to authenticated;
revoke all on function public.expurgar_candidaturas() from public, anon;
grant execute on function public.expurgar_candidaturas() to authenticated;
