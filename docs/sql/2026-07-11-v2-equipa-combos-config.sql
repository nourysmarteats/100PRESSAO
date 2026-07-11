-- Migração v2 do /admin (jul 2026): equipa, combos, auditoria, definições,
-- variantes. Aplicar no SQL Editor do Supabase ANTES de usar os ecrãs novos.
-- Idempotente: pode correr mais do que uma vez.
--
-- NOTA: o item 3 (gestão de equipa) também precisa da env var
-- SUPABASE_SERVICE_ROLE_KEY no projeto Vercel (Settings → Environment
-- Variables) — a chave NUNCA entra no git nem no browser.

-- ── 1. PERFIS DE EQUIPA (papel + PIN pessoal) ──────────────────────────
-- Uma linha por conta auth.users; papel admin|staff; pin_hash =
-- sha256("<user_id>:<pin>") — o PIN é conveniência de turno, não substitui
-- a password (modelo igual ao 1707 atual, mas individual e fora do código)
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  papel text not null default 'staff' check (papel in ('admin', 'staff')),
  pin_hash text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.perfis enable row level security;

drop policy if exists "perfis leitura autenticada" on public.perfis;
create policy "perfis leitura autenticada" on public.perfis
  for select to authenticated using (true);
-- escrita só via service role (função Vercel) — sem policies de escrita

-- Cria o perfil admin para as contas já existentes (a conta partilhada
-- atual fica admin até as individuais existirem; ajustar depois se preciso)
insert into public.perfis (id, email, nome, papel)
select u.id, u.email, coalesce(split_part(u.email, '@', 1), 'Equipa'), 'admin'
from auth.users u
where not exists (select 1 from public.perfis p where p.id = u.id);

-- ── 2. COMBOS (menus compostos) ────────────────────────────────────────
create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco numeric(8,2) not null,
  category_id uuid references public.categories(id),
  imagem_url text,
  disponivel boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
create table if not exists public.combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.combos(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantidade integer not null default 1
);
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;

drop policy if exists "combos leitura publica" on public.combos;
create policy "combos leitura publica" on public.combos
  for select using (true);
drop policy if exists "combos escrita equipa" on public.combos;
create policy "combos escrita equipa" on public.combos
  for all to authenticated using (true) with check (true);

drop policy if exists "combo_items leitura publica" on public.combo_items;
create policy "combo_items leitura publica" on public.combo_items
  for select using (true);
drop policy if exists "combo_items escrita equipa" on public.combo_items;
create policy "combo_items escrita equipa" on public.combo_items
  for all to authenticated using (true) with check (true);

-- Combo entra no pedido como linha própria (decisão jul 2026):
alter table public.order_items
  add column if not exists combo_id uuid references public.combos(id);
alter table public.order_items
  alter column product_id drop not null;

-- ── 3. VARIANTES DE TAMANHO/PREÇO (ex: 20cl/30cl/50cl) ────────────────
-- Verificado a 2026-07-11: não existia suporte no schema — criado de raiz
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  nome text not null,
  preco numeric(8,2) not null,
  disponivel boolean not null default true,
  ordem integer not null default 0
);
alter table public.product_variants enable row level security;

drop policy if exists "variantes leitura publica" on public.product_variants;
create policy "variantes leitura publica" on public.product_variants
  for select using (true);
drop policy if exists "variantes escrita equipa" on public.product_variants;
create policy "variantes escrita equipa" on public.product_variants
  for all to authenticated using (true) with check (true);

alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id);

-- ── 4. LOG DE AUDITORIA ────────────────────────────────────────────────
-- user_id/email = conta Supabase com sessão; operador = nome de quem
-- desbloqueou o turno com o PIN pessoal (pode diferir num dispositivo
-- partilhado). Retenção: confirmar período com a Bea Salgado (RGPD).
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  email text,
  operador text,
  acao text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
alter table public.audit_log enable row level security;

drop policy if exists "audit escrita autenticada" on public.audit_log;
create policy "audit escrita autenticada" on public.audit_log
  for insert to authenticated with check (true);

-- consulta reservada a admins
drop policy if exists "audit leitura admin" on public.audit_log;
create policy "audit leitura admin" on public.audit_log
  for select to authenticated using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'admin' and p.ativo
    )
  );

-- ── 5. DEFINIÇÕES (banner operacional + horário) ───────────────────────
create table if not exists public.definicoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.definicoes enable row level security;

drop policy if exists "definicoes leitura publica" on public.definicoes;
create policy "definicoes leitura publica" on public.definicoes
  for select using (true);
drop policy if exists "definicoes escrita equipa" on public.definicoes;
create policy "definicoes escrita equipa" on public.definicoes
  for all to authenticated using (true) with check (true);

insert into public.definicoes (chave, valor) values
  ('banner', '""'::jsonb),
  ('horario', '{
    "segunda": "8:00 – 12:00", "terca": "8:00 – 12:00",
    "quarta": "8:00 – 12:00", "quinta": "8:00 – 12:00",
    "sexta": "8:00 – 12:00", "sabado": "", "domingo": ""
  }'::jsonb)
on conflict (chave) do nothing;

-- Realtime para o banner aparecer em /cardapio sem reload
do $$
begin
  alter publication supabase_realtime add table public.definicoes;
exception
  when duplicate_object then null;
end $$;
