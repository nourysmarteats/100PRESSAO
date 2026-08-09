-- 2026-08-09 — APLICADO EM PRODUÇÃO (via MCP, nesta data).
--
-- Estafetas próprios: registo, atribuição e apuramento semanal.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O DESENHO SEGUE O PARECER JURÍDICO (Brandão, via Leandro, 2026-08-09)
-- ─────────────────────────────────────────────────────────────────────────
-- As restrições estão gravadas na ESTRUTURA, não apenas nas boas intenções:
--
--   LOCALIZAÇÃO — apenas durante entrega ativa, posição atual, SEM RASTO.
--   Por isso são três colunas sobrescritas na linha do estafeta, e não uma
--   tabela de histórico: não há onde guardar um percurso mesmo que alguém
--   queira. Serve para propor a entrega mais próxima; nunca para avaliar.
--
--   RECUSA — a registar como prova de autonomia, mas sem taxa de aceitação,
--   ranking nem desativação automática. Daí não haver aqui contador nenhum.
--   A tabela de propostas virá com o despacho e será um registo de factos,
--   sem agregados.
--
--   O SISTEMA PROPÕE, NÃO ATRIBUI. Nesta fase quem atribui é uma pessoa ao
--   balcão, que é a forma mais simples de o garantir.
--
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.estafetas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  nif         text,
  telefone    text,
  email       text,
  ativo       boolean not null default true,
  notas       text,
  posicao_lat numeric,
  posicao_lng numeric,
  posicao_em  timestamptz,
  criado_em   timestamptz not null default now()
);

comment on table public.estafetas is
  'Estafetas próprios. Posição é sempre a atual e nunca histórica, por exigência jurídica.';
comment on column public.estafetas.posicao_em is
  'Momento da última posição conhecida. Nulo quando não há entrega ativa.';

alter table public.orders
  add column if not exists estafeta_id   uuid references public.estafetas(id) on delete set null,
  add column if not exists estafeta_taxa numeric;

comment on column public.orders.estafeta_taxa is
  'Valor devido ao estafeta por esta entrega, CONGELADO no momento da atribuição. Não recalcular: se os valores mudarem, as faturas já emitidas deixariam de bater certo.';

create index if not exists orders_estafeta_idx on public.orders (estafeta_id, criado_em);

-- Contactos e NIF são dados pessoais: só a equipa autenticada lê.
alter table public.estafetas enable row level security;

drop policy if exists "estafetas leitura equipa" on public.estafetas;
create policy "estafetas leitura equipa" on public.estafetas
  for select to authenticated using ((select e_equipa()));

drop policy if exists "estafetas escrita admin" on public.estafetas;
create policy "estafetas escrita admin" on public.estafetas
  for all to authenticated using ((select e_admin())) with check ((select e_admin()));

-- Valores acordados: 2,00 € por recolha e entrega + 0,40 €/km. Ficam na
-- configuração para poderem mudar sem alterar código; o que já foi atribuído
-- permanece congelado em orders.estafeta_taxa.
update public.definicoes
set valor = valor || jsonb_build_object('estafeta_base', 2.00, 'estafeta_km', 0.40),
    atualizado_em = now()
where chave = 'entrega' and not (valor ? 'estafeta_base');
