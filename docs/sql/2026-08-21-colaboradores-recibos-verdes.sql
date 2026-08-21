-- 2026-08-21 — POR APLICAR.
--
-- Colaboradores a recibos verdes: pagamento mensal e controlo da dependência
-- económica, por entidade do grupo e consolidado.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O PROBLEMA QUE ISTO RESOLVE
-- ─────────────────────────────────────────────────────────────────────────
-- Quando uma entidade contratante representa mais de 50% do valor total da
-- atividade de um trabalhador independente no mesmo ano civil, deve uma
-- contribuição própria à Segurança Social (7% acima de 50%, 10% acima de 80%
-- — confirmar as taxas a cada Orçamento do Estado).
--
-- ENTIDADE CONTRATANTE NÃO É ENTIDADE JURÍDICA. O Guia Prático das Entidades
-- Contratantes é literal: «considera-se como prestada à mesma entidade
-- contratante os serviços prestados a empresas do mesmo agrupamento
-- empresarial». Três NIPC sob domínio comum são UM apuramento.
--
-- É por isso que `entidades_grupo.agrupamento` existe. Sem essa coluna, o
-- ecrã dividia 9.600 € por três empresas, mostrava 26,7% em cada uma e
-- concluía que não havia contribuição nenhuma — quando os 9.600 € sobre
-- 12.000 € declarados dão 80% e 672 € de contribuição devida.
--
-- Há ainda dois travões que não são contas e vivem aqui, na ficha da pessoa:
--   · só há entidade contratante se o rendimento anual do colaborador for
--     igual ou superior a 6 × IAS (3.222,78 € em 2026);
--   · um colaborador isento de contribuir (art. 157.º do Código Contributivo)
--     não gera contribuição, seja qual for a fração.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O QUE ESTÁ GRAVADO NA ESTRUTURA, E NÃO APENAS NAS BOAS INTENÇÕES
-- ─────────────────────────────────────────────────────────────────────────
--
--   A FATURA SEGUE O TRABALHO. Cada pagamento aponta para a entidade que
--   recebeu o serviço e exige uma descrição não vazia do que foi prestado
--   A ESSA entidade. Não há como lançar um pagamento "de rotação": teria de
--   se escrever, à mão, o que a entidade recebeu em troca.
--
--   O ANO É O DO RECIBO. `ano` e `mes` são colunas geradas a partir de
--   data_recibo, não da transferência. É a data do recibo que conta para o
--   apuramento da Segurança Social, e uma coluna gerada não se engana.
--
--   ACIMA DO TETO EXIGE JUSTIFICAÇÃO ESCRITA. O CHECK recusa a linha se
--   acima_do_teto for verdadeiro e a justificação vier vazia ou telegráfica.
--   Há casos legítimos (o colaborador declarou mais entretanto); o que não
--   há é a possibilidade de passar o teto em silêncio.
--
--   DESLIGAR UM CÁLCULO EXIGE FUNDAMENTO. A isenção do art. 157.º anula a
--   contribuição. Por isso não se marca sem escrever porquê — mesmo CHECK,
--   mesma lógica do teto.
--
--   O DENOMINADOR É DECLARADO, E SABE-SE QUE O É. O rendimento total anual
--   vive em tabela própria, com data e origem, porque o grupo não tem — nem
--   pode ter — maneira de o conhecer sozinho. Guardá-lo como se fosse um
--   facto do sistema seria mentir sobre a qualidade do número.
--
-- NOTA DE ÂMBITO: nada disto mede o risco laboral. A contribuição de
-- entidade contratante é um custo; a presunção de contrato de trabalho do
-- art. 12.º do Código do Trabalho é outra ordem de grandeza e não se afere
-- por percentagens de faturação.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Entidades do grupo ────────────────────────────────────────────────────
create table if not exists public.entidades_grupo (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  nipc         text not null unique,
  atividade    text,
  agrupamento  text,
  principal    boolean not null default false,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- Idempotente: a coluna foi acrescentada depois do primeiro rascunho.
alter table public.entidades_grupo
  add column if not exists agrupamento text;

comment on table public.entidades_grupo is
  'Entidades com NIPC próprio a que os colaboradores prestam serviço.';
comment on column public.entidades_grupo.atividade is
  'O que esta entidade faz. Serve para conferir se o serviço descrito num pagamento é plausível nela.';
comment on column public.entidades_grupo.agrupamento is
  'Agrupamento empresarial. Entidades com o mesmo valor são UMA entidade contratante para a Segurança Social. Vazio = apura-se sozinha.';
comment on column public.entidades_grupo.principal is
  'A entidade que opera o restaurante — é a ela que o apuramento de estafetas (orders.estafeta_taxa) diz respeito.';

-- Só uma entidade pode ser a principal, senão a reconciliação dos estafetas
-- não sabe onde encostar os valores.
create unique index if not exists entidades_grupo_principal_idx
  on public.entidades_grupo (principal) where principal;

create index if not exists entidades_grupo_agrupamento_idx
  on public.entidades_grupo (agrupamento) where agrupamento is not null;

-- ── Colaboradores ─────────────────────────────────────────────────────────
create table if not exists public.colaboradores (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null,
  nif                   text unique,
  email                 text,
  telefone              text,
  perfil_id             uuid references public.perfis(id) on delete set null,
  estafeta_id           uuid references public.estafetas(id) on delete set null,
  inicio_atividade      date,
  isento_art_53         boolean not null default false,
  isento_ss_art157      boolean not null default false,
  isencao_ss_fundamento text,
  taxa_retencao_irs     numeric not null default 0 check (taxa_retencao_irs between 0 and 100),
  ativo                 boolean not null default true,
  notas                 text,
  criado_em             timestamptz not null default now()
);

alter table public.colaboradores
  add column if not exists isento_ss_art157 boolean not null default false;
alter table public.colaboradores
  add column if not exists isencao_ss_fundamento text;

-- Desligar a contribuição é uma decisão, e as decisões escrevem-se.
alter table public.colaboradores
  drop constraint if exists isencao_ss_exige_fundamento;
alter table public.colaboradores
  add constraint isencao_ss_exige_fundamento
    check (not isento_ss_art157
           or (isencao_ss_fundamento is not null
               and length(btrim(isencao_ss_fundamento)) >= 10));

comment on table public.colaboradores is
  'A pessoa enquanto prestador de serviços. Distinta de perfis, que é a conta de login.';
comment on column public.colaboradores.estafeta_id is
  'Ligação ao registo de estafeta, quando é a mesma pessoa. Sem isto, o que lhe é pago a entregar ficava fora da fração dos 50%.';
comment on column public.colaboradores.isento_art_53 is
  'Isenção de IVA do art. 53.º do CIVA. Muda o que o recibo deve conter. NÃO tem efeito nenhum na Segurança Social.';
comment on column public.colaboradores.isento_ss_art157 is
  'Isenção de contribuir do art. 157.º do Código Contributivo. Anula a contribuição de entidade contratante. Nada a ver com o art. 53.º do CIVA.';

-- ── Rendimento total declarado, por ano ───────────────────────────────────
create table if not exists public.colaborador_rendimento_anual (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  ano             int  not null check (ano between 2020 and 2100),
  total_declarado numeric not null check (total_declarado >= 0),
  origem          text not null default 'declaracao'
                    check (origem in ('declaracao', 'estimativa')),
  documento_url   text,
  declarado_em    date not null default current_date,
  atualizado_em   timestamptz not null default now(),
  unique (colaborador_id, ano)
);

comment on table public.colaborador_rendimento_anual is
  'Rendimento total de trabalho independente do colaborador no ano, TODAS as entidades incluídas. É o denominador da dependência económica e vem sempre dele — o grupo só conhece a sua própria parte.';
comment on column public.colaborador_rendimento_anual.origem is
  '"declaracao" = o colaborador declarou; "estimativa" = valor presumido pelo grupo. A estimativa não é suporte documental de nada.';
comment on column public.colaborador_rendimento_anual.declarado_em is
  'Data da declaração. Um valor de há oito meses já não descreve o ano corrente.';

-- ── Pagamentos ────────────────────────────────────────────────────────────
create table if not exists public.colaborador_pagamentos (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  entidade_id    uuid not null references public.entidades_grupo(id) on delete restrict,
  data_recibo    date not null,
  ano            int generated always as (extract(year  from data_recibo)::int) stored,
  mes            int generated always as (extract(month from data_recibo)::int) stored,
  valor_base     numeric not null check (valor_base > 0),
  iva            numeric not null default 0 check (iva >= 0),
  retencao_irs   numeric not null default 0 check (retencao_irs >= 0),
  numero_recibo  text,
  descricao      text not null,
  estado         text not null default 'previsto'
                   check (estado in ('previsto', 'recibo_recebido', 'pago')),
  pago_em        date,
  acima_do_teto  boolean not null default false,
  justificacao   text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users(id),

  -- A descrição é o que liga o pagamento a trabalho real. Vazia ou de três
  -- letras não liga nada, e é precisamente o que se pediria a alguém para
  -- mostrar se o apuramento fosse contestado.
  constraint descricao_com_substancia
    check (length(btrim(descricao)) >= 10),

  -- Passar o teto é uma decisão, e as decisões escrevem-se.
  constraint teto_exige_justificacao
    check (not acima_do_teto
           or (justificacao is not null and length(btrim(justificacao)) >= 10)),

  -- Um pagamento em estado "pago" tem de dizer quando.
  constraint pago_tem_data
    check (estado <> 'pago' or pago_em is not null)
);

comment on table public.colaborador_pagamentos is
  'Pagamentos mensais a colaboradores, um por recibo. A entidade é a que recebeu o serviço, não a que calha na vez.';
comment on column public.colaborador_pagamentos.ano is
  'Ano do RECIBO, não da transferência — é esse que conta para o apuramento anual.';
comment on column public.colaborador_pagamentos.valor_base is
  'Valor dos serviços, sem IVA. É esta a base de incidência da contribuição de entidade contratante.';
comment on column public.colaborador_pagamentos.acima_do_teto is
  'Marcado no momento do registo, com a fração que se conhecia então. Fica como registo do que se sabia, e não é recalculado depois.';

create index if not exists colaborador_pagamentos_ano_idx
  on public.colaborador_pagamentos (colaborador_id, ano);
create index if not exists colaborador_pagamentos_entidade_idx
  on public.colaborador_pagamentos (entidade_id, ano);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Remuneração e NIF de pessoas concretas: leitura de admin, não de toda a
-- equipa. A exceção é entidades_grupo, que não tem nada de pessoal.
alter table public.entidades_grupo              enable row level security;
alter table public.colaboradores                enable row level security;
alter table public.colaborador_rendimento_anual enable row level security;
alter table public.colaborador_pagamentos       enable row level security;

drop policy if exists "entidades leitura equipa" on public.entidades_grupo;
create policy "entidades leitura equipa" on public.entidades_grupo
  for select to authenticated using ((select e_equipa()));

drop policy if exists "entidades escrita admin" on public.entidades_grupo;
create policy "entidades escrita admin" on public.entidades_grupo
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

drop policy if exists "colaboradores admin" on public.colaboradores;
create policy "colaboradores admin" on public.colaboradores
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

drop policy if exists "rendimento admin" on public.colaborador_rendimento_anual;
create policy "rendimento admin" on public.colaborador_rendimento_anual
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

drop policy if exists "pagamentos admin" on public.colaborador_pagamentos;
create policy "pagamentos admin" on public.colaborador_pagamentos
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

-- ── Configuração ──────────────────────────────────────────────────────────
-- Os limiares ficam em definicoes para poderem mudar sem tocar em código —
-- as taxas, os escalões e o IAS são matéria de Orçamento do Estado.
--
-- O upsert MERGE em vez de substituir: chaves novas entram, valores já
-- afinados à mão não são pisados. Correr isto duas vezes é seguro.
insert into public.definicoes (chave, valor, atualizado_em)
values (
  'colaboradores',
  jsonb_build_object(
    'limiar_dependencia',  0.50,  -- acima disto há entidade contratante
    'alerta_dependencia',  0.40,  -- âmbar: começa a apertar
    'escalao_agravado',    0.80,  -- acima disto a taxa sobe
    'taxa_contratante',    0.07,
    'taxa_contratante_agravada', 0.10,
    'declaracao_valida_dias', 180, -- ao fim disto, pedir declaração nova
    -- Piso de abrangência: 6 × IAS. Abaixo disto não há entidade contratante.
    'ias_anual',           537.13, -- IAS de 2026
    'minimo_multiplo_ias', 6,
    -- Teto do regime de isenção de IVA do art. 53.º do CIVA, e a tolerância
    -- de 25% acima da qual a saída do regime é imediata. Não é obrigação
    -- nossa: é para não empurrarmos o colaborador para fora sem avisar.
    'limite_art_53',       15000,
    'tolerancia_art_53',   18750
  ),
  now()
)
on conflict (chave) do update
  set valor = excluded.valor || public.definicoes.valor,
      atualizado_em = now();
