-- Formulário de feedback (jul 2026). Aplicar no SQL Editor do Supabase.
-- Idempotente. O visitante envia (insert público, anónimo); só admins leem.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('sugestao', 'elogio', 'critica', 'outro')),
  mensagem text not null,
  nome text,
  contacto text,
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Qualquer visitante (anon) pode enviar feedback
grant insert on public.feedback to anon, authenticated;
drop policy if exists "feedback insert publico" on public.feedback;
create policy "feedback insert publico" on public.feedback
  for insert with check (true);

-- Leitura e marcação como lido reservadas a admins (como o audit_log)
grant select, update on public.feedback to authenticated;
drop policy if exists "feedback leitura admin" on public.feedback;
create policy "feedback leitura admin" on public.feedback
  for select to authenticated using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'admin' and p.ativo
    )
  );
drop policy if exists "feedback update admin" on public.feedback;
create policy "feedback update admin" on public.feedback
  for update to authenticated using (
    exists (
      select 1 from public.perfis p
      where p.id = auth.uid() and p.papel = 'admin' and p.ativo
    )
  );
