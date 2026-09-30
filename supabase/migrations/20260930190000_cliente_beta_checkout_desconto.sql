-- Cliente Beta no checkout do restaurante online (decisão do Leandro, 30 Set 2026;
-- parecer da Bea: mesma finalidade, sem consentimento novo; utilizações conservadas
-- enquanto a adesão estiver ativa + 12 meses; falhas 90 dias; resposta neutra).
-- APLICADA em produção a 30 Set 2026 pelo Daniel (via MCP). Este ficheiro é o registo.
--
-- 1) validar_cliente_beta_checkout(numero, telefone): número + telemóvel da adesão
--    (clientes_beta ativo). Devolve só valido/token/pct. 3 falhas/h por IP (HMAC).
-- 2) criar_pedido_online(..., p_beta_token): token de uso único, 30 min, mesmo
--    telemóvel do pedido. 10% por unidade (arredondado ao cêntimo) nos artigos,
--    não nos portes; mínimo de encomenda conta pelo valor bruto. Artigos da ementa
--    exclusiva passam a exigir Cliente Beta validado no servidor.
-- 3) orders.cliente_beta_id/numero_beta/desconto_beta; order_items.desconto_percentagem.
-- 4) cliente_beta_validacoes (RLS: só admin lê) + expurgo diário 03:55.
--
-- Definições completas: ver pg_get_functiondef em produção
-- (public.validar_cliente_beta_checkout, public.criar_pedido_online, public.expurgar_validacoes_cliente_beta).

update public.definicoes set valor = valor || '{"desconto_pct":10,"validacao_minutos":30,"limite_falhas_hora":3}'::jsonb where chave='cliente_beta';

alter table public.orders
  add column if not exists cliente_beta_id uuid references public.clientes_beta(id) on delete set null,
  add column if not exists numero_beta integer,
  add column if not exists desconto_beta numeric(10,2) not null default 0;

alter table public.order_items
  add column if not exists desconto_percentagem numeric(5,2) not null default 0;

create table if not exists public.cliente_beta_validacoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  numero integer,
  cliente_beta_id uuid references public.clientes_beta(id) on delete set null,
  resultado text not null check (resultado in ('ok','falhou')),
  ip_hash text,
  order_id uuid references public.orders(id) on delete set null,
  usado_em timestamptz,
  desconto numeric(10,2)
);
