-- 2026-08-21 — APLICADA em 2026-08-21 (migração colaboradores_estado_e_vinculo).
--
-- Fase A do Gestor de Colaboradores: estado e vínculo contratual.
--
-- O `vinculo` é o campo que faz este módulo deixar de ser uma folha de
-- pagamentos e passar a ser um registo defensável. O `vinculo_fundamento`
-- é obrigatório onde a lei o exige: um contrato a termo sem fundamento
-- escrito converte-se em contrato sem termo, e uma prestação de serviços
-- sem justificação é a primeira coisa que a ACT pergunta.
--
-- A lista de valores admissíveis inclui de propósito os instrumentos legais
-- de flexibilidade (termo certo, muito curta duração, intermitente, tempo
-- parcial). Se o único caminho fácil no sistema for "prestação de serviços",
-- é esse que se acaba por usar.

alter table public.colaboradores
  add column if not exists estado             text not null default 'activo',
  add column if not exists vinculo            text,
  add column if not exists vinculo_fundamento text,
  add column if not exists funcao             text,
  add column if not exists data_inicio        date,
  add column if not exists data_fim           date;

-- Quem já lá estava marcado como inactivo mantém-se inactivo.
update public.colaboradores set estado = 'inactivo' where ativo is false;

alter table public.colaboradores drop constraint if exists colaborador_estado_valido;
alter table public.colaboradores add constraint colaborador_estado_valido
  check (estado in ('candidato', 'activo', 'suspenso', 'inactivo'));

alter table public.colaboradores drop constraint if exists colaborador_vinculo_valido;
alter table public.colaboradores add constraint colaborador_vinculo_valido
  check (vinculo is null or vinculo in (
    'contrato_trabalho',      -- sem termo
    'termo_certo',
    'muito_curta_duracao',
    'intermitente',
    'tempo_parcial',
    'prestacao_servicos'      -- recibos verdes
  ));

-- Os vínculos precários exigem fundamento escrito. Os outros não.
-- Esta lista espelha VINCULOS_COM_FUNDAMENTO em src/lib/colaboradores.js.
alter table public.colaboradores drop constraint if exists colaborador_vinculo_exige_fundamento;
alter table public.colaboradores add constraint colaborador_vinculo_exige_fundamento
  check (vinculo is null
         or vinculo not in ('termo_certo', 'muito_curta_duracao', 'prestacao_servicos')
         or (vinculo_fundamento is not null
             and length(btrim(vinculo_fundamento)) >= 15));

alter table public.colaboradores drop constraint if exists colaborador_datas_coerentes;
alter table public.colaboradores add constraint colaborador_datas_coerentes
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio);

-- `ativo` passa a ser derivado de `estado`, para não haver duas verdades.
create or replace function public.colaborador_sincroniza_ativo()
returns trigger language plpgsql as $$
begin
  new.ativo := (new.estado = 'activo');
  return new;
end;
$$;

drop trigger if exists colaborador_sincroniza_ativo on public.colaboradores;
create trigger colaborador_sincroniza_ativo
  before insert or update on public.colaboradores
  for each row execute function public.colaborador_sincroniza_ativo();

comment on column public.colaboradores.estado is
  'candidato · activo · suspenso · inactivo. Nunca se apaga um colaborador — inactiva-se. `ativo` é derivado daqui por trigger.';
comment on column public.colaboradores.vinculo is
  'Natureza jurídica da relação. Decidido por 100PRESSÃO após análise, nunca escolhido pelo próprio.';
comment on column public.colaboradores.vinculo_fundamento is
  'Fundamento legal escrito. Obrigatório em termo certo, muito curta duração e prestação de serviços.';

create index if not exists colaboradores_estado_idx  on public.colaboradores (estado);
create index if not exists colaboradores_vinculo_idx on public.colaboradores (vinculo);
