-- supabase/migrations/0043_cargos_acesso.sql
-- Níveis de acesso por área (modelo cargo = nível + escopo, decisão do
-- usuário 2026-08-10):
--
--   1. Novo enum `nivel_acesso` com os níveis de coordenação:
--      - coordenador_area: coordena UMA área (sem herança de sub-áreas);
--      - coordenador_geral_area: coordena uma área + todas as sub-áreas
--        (herança via areas_institucionais.area_mae_id) e pode gerir os
--        cargos de coordenador dentro da sua área;
--      - coordenador_localidade: coordena uma localidade (tudo o que tem
--        localidade: voluntários e DIPs) e pode gerir cargos dentro dela.
--      `coordenador_geral`, `financeiro` e `voluntariado` continuam como
--      papéis globais em profiles.role (decisão: ficam "à parte"); ausência
--      de cargos = voluntário comum.
--   2. `cargos` (multi-cargo: um perfil pode ter N cargos) + `cargo_modulos`
--      (módulos concedidos a cada cargo — cada área/sub-área tem acessos
--      independentes, decididos módulo a módulo pelo coordenador).
--   3. Colunas de escopo por id: demandas.area_id, voluntarios.area_id e
--      localidade_id, projetos.area_id, dips.localidade_id — backfill por
--      nome (o texto livre é mantido para exibição/compat) + triggers de
--      sincronização (todo caminho de escrita — server actions, API, admin —
--      mantém o id em dia).
--   4. Helpers RLS no padrão has_role()/is_lider_of_area() do repositório:
--      coordena_area (herança recursiva de sub-áreas), coordena_localidade,
--      tem_cargo_modulo, meus_cargos, pode_conceder_cargo (WITH CHECK de
--      INSERT/UPDATE) e pode_gerir_cargos_de (USING de UPDATE/DELETE).
--   5. Escrita de voluntários: voluntario_manager_scope() estende o gate
--      das funções SECURITY DEFINER (criar/atualizar_voluntario) para
--      coordenadores por cargo, mantendo o teto de nunca atribuir papéis.
--   6. Políticas existentes ganham as cláusulas OR dos cargos (nunca
--      removem o comportamento atual) — demandas, demanda_responsaveis,
--      demanda_membros, voluntarios, profiles, dips e projetos.
--
-- Fontes: 0002 has_role()/revoke-grant idiom, 0004 is_lider_of_area() e
-- políticas SELECT-gates-UPDATE, 0017 voluntario_manager_role() e
-- vincular_meu_cadastro(), 0020 demanda_responsaveis, 0008 recriação de
-- demandas_com_status (select d.*) [CITED: this repo]; projeto skill:
-- SECURITY DEFINER em public é chamável por todos — todo helper abaixo
-- revoga de public/anon e concede a authenticated; políticas de UPDATE
-- exigem SELECT; usar WITH CHECK em UPDATE para impedir fuga de escopo.

-- ---------------------------------------------------------------------------
-- 1. Enum de níveis
-- ---------------------------------------------------------------------------
create type public.nivel_acesso as enum (
  'coordenador_area',
  'coordenador_geral_area',
  'coordenador_localidade'
);

-- ---------------------------------------------------------------------------
-- 2. cargos + cargo_modulos (tabelas primeiro; as políticas vêm depois dos
--    helpers, que elas referenciam)
-- ---------------------------------------------------------------------------
create table public.cargos (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nivel public.nivel_acesso not null,
  area_id bigint references public.areas_institucionais(id) on delete cascade,
  localidade_id bigint references public.voluntario_localidades(id) on delete cascade,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  -- O escopo é determinado pelo nível: cargos de área têm area_id (nunca
  -- localidade); cargos de localidade têm localidade_id (nunca área).
  constraint cargos_escopo_nivel check (
    (nivel in ('coordenador_area', 'coordenador_geral_area') and area_id is not null and localidade_id is null)
    or (nivel = 'coordenador_localidade' and localidade_id is not null and area_id is null)
  )
);

-- Dedup real: uma unique constraint pura trataria NULLs como distintos,
-- então coalesce para 0 torna (perfil, nível, escopo) único de fato.
create unique index cargos_profile_escopo_key
  on public.cargos (profile_id, nivel, coalesce(area_id, 0), coalesce(localidade_id, 0));

create index cargos_profile_idx on public.cargos (profile_id);
create index cargos_area_idx on public.cargos (area_id);
create index cargos_localidade_idx on public.cargos (localidade_id);

-- Módulos concedidos por cargo ("dar módulo a módulo"). O CHECK lista os
-- módulos concedíveis — painel/áreas (config) ficam de fora, exclusivos do
-- coordenador_geral. Adicionar módulo novo = nova migração (mesma regra do
-- app_role).
create table public.cargo_modulos (
  cargo_id bigint not null references public.cargos(id) on delete cascade,
  modulo text not null check (modulo in (
    'demandas', 'reunioes', 'dips', 'voluntarios', 'eventos',
    'projetos', 'pesquisas', 'proep', 'analise', 'analisar',
    'vendas', 'financeiro', 'utilidades'
  )),
  primary key (cargo_id, modulo)
);

-- ---------------------------------------------------------------------------
-- 3. Helpers RLS (mesmo shape de has_role/is_lider_of_area)
-- ---------------------------------------------------------------------------

-- O chamador coordena a área? coordenador_area = área exata;
-- coordenador_geral_area = área exata OU qualquer ancestral dela (ou seja,
-- a área alvo é a dele ou uma sub-área — a CTE sobe de area_mae_id).
create or replace function public.coordena_area(target_area_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    with recursive ancestrais as (
      select id from public.areas_institucionais where id = target_area_id
      union all
      select a.id
      from public.areas_institucionais a
      join ancestrais on a.area_mae_id = ancestrais.id
    )
    select 1
    from public.cargos c
    where c.profile_id = (select auth.uid())
      and (
        (c.nivel = 'coordenador_area' and c.area_id = target_area_id)
        or (c.nivel = 'coordenador_geral_area' and c.area_id in (select id from ancestrais))
      )
  );
$$;

revoke execute on function public.coordena_area(bigint) from public, anon;
grant execute on function public.coordena_area(bigint) to authenticated;

create or replace function public.coordena_localidade(target_localidade_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.cargos c
    where c.profile_id = (select auth.uid())
      and c.nivel = 'coordenador_localidade'
      and c.localidade_id = target_localidade_id
  );
$$;

revoke execute on function public.coordena_localidade(bigint) from public, anon;
grant execute on function public.coordena_localidade(bigint) to authenticated;

-- O chamador tem algum cargo com o módulo concedido? (uso futuro em RLS e
-- no app; a tela usa meus_cargos direto.)
create or replace function public.tem_cargo_modulo(modulo text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.cargo_modulos cm
    join public.cargos c on c.id = cm.cargo_id
    where c.profile_id = (select auth.uid())
      and cm.modulo = modulo
  );
$$;

revoke execute on function public.tem_cargo_modulo(text) from public, anon;
grant execute on function public.tem_cargo_modulo(text) to authenticated;

-- Cargos do chamador (com módulos agregados) — usado pelo app para decidir
-- visibilidade de módulos e ações. SECURITY DEFINER com filtro por
-- auth.uid() dentro do corpo (padrão vincular_meu_cadastro).
create or replace function public.meus_cargos()
returns table (
  cargo_id bigint,
  nivel public.nivel_acesso,
  area_id bigint,
  area_nome text,
  localidade_id bigint,
  localidade_nome text,
  modulos text[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.id,
    c.nivel,
    c.area_id,
    ai.nome,
    c.localidade_id,
    vl.nome,
    coalesce(array_agg(cm.modulo order by cm.modulo) filter (where cm.modulo is not null), '{}'::text[])
  from public.cargos c
  left join public.areas_institucionais ai on ai.id = c.area_id
  left join public.voluntario_localidades vl on vl.id = c.localidade_id
  left join public.cargo_modulos cm on cm.cargo_id = c.id
  where c.profile_id = (select auth.uid())
  group by c.id, ai.nome, vl.nome
$$;

revoke execute on function public.meus_cargos() from public, anon;
grant execute on function public.meus_cargos() to authenticated;

-- WITH CHECK de INSERT/UPDATE de cargos: o escopo do cargo novo/resultante
-- precisa estar DENTRO do escopo do gestor. coordenador_geral concede
-- qualquer coisa; coordenador_geral_area concede cargos cuja área está na
-- própria árvore; coordenador_localidade concede cargos da própria
-- localidade. Nunca permite conceder um nível/escopo que o gestor não tem.
create or replace function public.pode_conceder_cargo(area_id bigint, localidade_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return false;
  end if;

  if (select role from public.profiles where id = me) = 'coordenador_geral' then
    return true;
  end if;

  if area_id is not null then
    return exists (
      with recursive arvore as (
        select c.area_id as id
        from public.cargos c
        where c.profile_id = me
          and c.nivel = 'coordenador_geral_area'
          and c.area_id is not null
        union all
        select a.id
        from public.areas_institucionais a
        join arvore on a.area_mae_id = arvore.id
      )
      select 1 from arvore where id = area_id
    );
  end if;

  if localidade_id is not null then
    return exists (
      select 1 from public.cargos c
      where c.profile_id = me
        and c.nivel = 'coordenador_localidade'
        -- Qualificado com o nome da função: sem isso o PL/pgSQL trata o
        -- `localidade_id` desqualificado como ambíguo (parâmetro vs coluna)
        -- e quebra com SQLSTATE 42702.
        and c.localidade_id = pode_conceder_cargo.localidade_id
    );
  end if;

  return false;
end;
$$;

revoke execute on function public.pode_conceder_cargo(bigint, bigint) from public, anon;
grant execute on function public.pode_conceder_cargo(bigint, bigint) to authenticated;

-- USING de UPDATE/DELETE de cargos: o alvo já tem algum cargo dentro do
-- escopo do gestor? (o cargo existe, então dá para olhar o perfil alvo).
-- Nunca sobre si mesmo (impede autopromoção: me <> target_profile).
create or replace function public.pode_gerir_cargos_de(target_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or target_profile = me then
    return false;
  end if;

  if (select role from public.profiles where id = me) = 'coordenador_geral' then
    return true;
  end if;

  -- Algum cargo de área do alvo dentro da minha árvore de geral de área?
  if exists (
    with recursive arvore as (
      select c.area_id as id
      from public.cargos c
      where c.profile_id = me
        and c.nivel = 'coordenador_geral_area'
        and c.area_id is not null
      union all
      select a.id
      from public.areas_institucionais a
      join arvore on a.area_mae_id = arvore.id
    )
    select 1
    from public.cargos alvo
    where alvo.profile_id = target_profile
      and alvo.area_id is not null
      and alvo.area_id in (select id from arvore)
  ) then
    return true;
  end if;

  -- Algum cargo de localidade do alvo na minha localidade?
  if exists (
    select 1
    from public.cargos alvo
    where alvo.profile_id = target_profile
      and alvo.localidade_id is not null
      and alvo.localidade_id in (
        select c.localidade_id
        from public.cargos c
        where c.profile_id = me
          and c.nivel = 'coordenador_localidade'
          and c.localidade_id is not null
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.pode_gerir_cargos_de(uuid) from public, anon;
grant execute on function public.pode_gerir_cargos_de(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS de cargos/cargo_modulos
-- ---------------------------------------------------------------------------
alter table public.cargos enable row level security;
alter table public.cargo_modulos enable row level security;

-- SELECT do próprio dono + coordenador_geral + quem pode gerir os cargos do
-- perfil; escrita só para coordenador_geral ou quem tem o escopo do cargo
-- (pode_conceder_cargo no WITH CHECK impede fuga de escopo: o cargo
-- novo/resultante precisa estar DENTRO da área/localidade do gestor).
create policy "cargo holder and scope managers can view cargos"
  on public.cargos
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.pode_gerir_cargos_de(profile_id))
  );

create policy "coordenador_geral or scope manager can insert cargos"
  on public.cargos
  for insert
  to authenticated
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.pode_conceder_cargo(area_id, localidade_id))
  );

create policy "coordenador_geral or scope manager can update cargos"
  on public.cargos
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.pode_gerir_cargos_de(profile_id))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.pode_conceder_cargo(area_id, localidade_id))
  );

create policy "coordenador_geral or scope manager can delete cargos"
  on public.cargos
  for delete
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.pode_gerir_cargos_de(profile_id))
  );

create policy "cargo modules visible with the cargo"
  on public.cargo_modulos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.cargos c
      where c.id = cargo_id
        and (
          c.profile_id = (select auth.uid())
          or (select public.has_role('coordenador_geral'))
          or (select public.pode_gerir_cargos_de(c.profile_id))
        )
    )
  );

create policy "cargo modules managed with the cargo"
  on public.cargo_modulos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.cargos c
      where c.id = cargo_id
        and (
          (select public.has_role('coordenador_geral'))
          or (select public.pode_gerir_cargos_de(c.profile_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.cargos c
      where c.id = cargo_id
        and (
          (select public.has_role('coordenador_geral'))
          or (select public.pode_gerir_cargos_de(c.profile_id))
        )
    )
  );

-- Expor as tabelas novas à Data API (config.toml: novos objetos NÃO são
-- auto-expostos; a RLS acima governa as linhas, o GRANT governa a
-- acessibilidade do endpoint).
grant select, insert, update, delete on table public.cargos to authenticated;
grant select, insert, update, delete on table public.cargo_modulos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Colunas de escopo por id + backfill + triggers de sincronização
-- ---------------------------------------------------------------------------
alter table public.demandas
  add column area_id bigint references public.areas_institucionais(id) on delete set null;

alter table public.voluntarios
  add column area_id bigint references public.areas_institucionais(id) on delete set null,
  add column localidade_id bigint references public.voluntario_localidades(id) on delete set null;

alter table public.projetos
  add column area_id bigint references public.areas_institucionais(id) on delete set null;

alter table public.dips
  add column localidade_id bigint references public.voluntario_localidades(id) on delete set null;

create index demandas_area_id_idx on public.demandas (area_id);
create index voluntarios_area_id_idx on public.voluntarios (area_id);
create index voluntarios_localidade_id_idx on public.voluntarios (localidade_id);
create index projetos_area_id_idx on public.projetos (area_id);
create index dips_localidade_id_idx on public.dips (localidade_id);

-- Backfill: casamento por nome (lower/trim nos dois lados), idempotente e
-- inofensivo quando o texto não bate com nenhuma área cadastrada.
update public.demandas d
  set area_id = ai.id
  from public.areas_institucionais ai
  where lower(trim(d.area)) = lower(trim(ai.nome));

update public.voluntarios v
  set area_id = ai.id
  from public.areas_institucionais ai
  where lower(trim(v.area_atuacao)) = lower(trim(ai.nome));

update public.voluntarios v
  set localidade_id = vl.id
  from public.voluntario_localidades vl
  where lower(trim(v.unidade)) = lower(trim(vl.nome));

update public.projetos p
  set area_id = ai.id
  from public.areas_institucionais ai
  where lower(trim(p.area)) = lower(trim(ai.nome));

update public.dips d
  set localidade_id = vl.id
  from public.voluntario_localidades vl
  where lower(trim(d.localidade)) = lower(trim(vl.nome));

-- Sincronização automática: toda escrita (app, API, admin) que alterar o
-- texto da área/localidade mantém o id em dia. `before insert or update of
-- <coluna>` cobre o INSERT e só dispara no UPDATE quando a coluna muda.
create or replace function public.sync_demanda_area_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.area_id := (
    select ai.id from public.areas_institucionais ai
    where lower(trim(ai.nome)) = lower(trim(coalesce(new.area, '')))
  );
  return new;
end;
$$;

drop trigger if exists demandas_sync_area_id on public.demandas;
create trigger demandas_sync_area_id
  before insert or update of area on public.demandas
  for each row execute function public.sync_demanda_area_id();

create or replace function public.sync_voluntario_escopo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.area_id := (
    select ai.id from public.areas_institucionais ai
    where lower(trim(ai.nome)) = lower(trim(coalesce(new.area_atuacao, '')))
  );
  new.localidade_id := (
    select vl.id from public.voluntario_localidades vl
    where lower(trim(vl.nome)) = lower(trim(coalesce(new.unidade, '')))
  );
  return new;
end;
$$;

drop trigger if exists voluntarios_sync_escopo on public.voluntarios;
create trigger voluntarios_sync_escopo
  before insert or update of area_atuacao, unidade on public.voluntarios
  for each row execute function public.sync_voluntario_escopo();

create or replace function public.sync_projeto_area_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.area_id := (
    select ai.id from public.areas_institucionais ai
    where lower(trim(ai.nome)) = lower(trim(coalesce(new.area, '')))
  );
  return new;
end;
$$;

drop trigger if exists projetos_sync_area_id on public.projetos;
create trigger projetos_sync_area_id
  before insert or update of area on public.projetos
  for each row execute function public.sync_projeto_area_id();

create or replace function public.sync_dip_localidade_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.localidade_id := (
    select vl.id from public.voluntario_localidades vl
    where lower(trim(vl.nome)) = lower(trim(coalesce(new.localidade, '')))
  );
  return new;
end;
$$;

drop trigger if exists dips_sync_localidade_id on public.dips;
create trigger dips_sync_localidade_id
  before insert or update of localidade on public.dips
  for each row execute function public.sync_dip_localidade_id();

-- demandas_com_status foi criado com select d.*, que congela a lista de
-- colunas — a nova coluna area_id só aparece após recriar (mesma correção
-- de 0008 para evento_id).
drop view public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

-- ---------------------------------------------------------------------------
-- 6. Escrita de voluntários por cargo (SECURITY DEFINER, sem atribuir papel)
-- ---------------------------------------------------------------------------

-- Gate de escopo para coordenadores por cargo: retorna 'coordenador_area'
-- quando o chamador tem cargo que cobre a área OU a localidade do alvo —
-- o papel devolvido só destrava o caminho de dados (nunca atribuição de
-- role), igual ao coordenador_area legado. coordenador_geral/voluntariado
-- continuam passando direto.
create or replace function public.voluntario_manager_scope(area_id bigint, localidade_id bigint)
returns public.app_role
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  caller_role public.app_role;
begin
  select p.role into caller_role
  from public.profiles p
  where p.id = (select auth.uid());

  if caller_role is null then
    return null;
  end if;

  if caller_role in ('coordenador_geral', 'voluntariado') then
    return caller_role;
  end if;

  if area_id is not null and public.coordena_area(area_id) then
    return 'coordenador_area';
  end if;

  if localidade_id is not null and public.coordena_localidade(localidade_id) then
    return 'coordenador_area';
  end if;

  return null;
end;
$$;

revoke execute on function public.voluntario_manager_scope(bigint, bigint) from public, anon;
grant execute on function public.voluntario_manager_scope(bigint, bigint) to authenticated;

-- criar_voluntario: fallback do gate para cargos (resolve área/localidade
-- por nome do payload) e pinagem para a primeira área em escopo (cargo de
-- área), mantendo o teto de papel. Assinatura p_* com telefones igual à
-- 0030 (a 0030 DROPPED e recriou com esses parâmetros — recriar sem eles
-- quebraria a chamada do app com PGRST202).
create or replace function public.criar_voluntario(
  p_nome text,
  p_codigo_pf text,
  p_unidade text,
  p_org_depto text,
  p_funcao text,
  p_data_inicio date,
  p_data_saida date,
  p_obs text,
  p_area_atuacao text,
  p_papel public.app_role,
  p_areas_lideradas text[],
  p_telefone1 text,
  p_telefone2 text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  manager public.app_role;
  effective_area text;
  effective_role public.app_role;
  novo_id bigint;
begin
  if me is null then
    return null;
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    return null;
  end if;

  manager := public.voluntario_manager_role(p_area_atuacao);
  if manager is null then
    manager := public.voluntario_manager_scope(
      (select ai.id from public.areas_institucionais ai
       where lower(trim(ai.nome)) = lower(trim(nullif(trim(coalesce(p_area_atuacao, '')), '')))),
      (select vl.id from public.voluntario_localidades vl
       where lower(trim(vl.nome)) = lower(trim(nullif(trim(coalesce(p_unidade, '')), ''))))
    );
  end if;
  if manager is null then
    return null;
  end if;

  effective_area := nullif(trim(coalesce(p_area_atuacao, '')), '');
  if manager = 'coordenador_area' then
    -- Legado (role coordenador_area): pin para a primeira lider_area.
    -- Cargo de área: pin para a primeira área do cargo. Só localidade:
    -- mantém a área escolhida no payload (o escopo dela é a localidade).
    effective_area := case
      when (select role from public.profiles where id = me) = 'coordenador_area' then
        (select la.area from public.lider_areas la
         where la.lider_id = me order by la.created_at asc limit 1)
      when exists (
        select 1 from public.cargos c
        where c.profile_id = me and c.area_id is not null
      ) then
        (select ai.nome
         from public.cargos c
         join public.areas_institucionais ai on ai.id = c.area_id
         where c.profile_id = me and c.area_id is not null
         order by c.id asc limit 1)
      else effective_area
    end;
    effective_role := 'voluntario_comum';
  else
    effective_role := case
      when p_papel = 'coordenador_geral' then 'voluntario_comum'
      else p_papel
    end;
  end if;

  insert into public.voluntarios (
    nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida,
    obs, area_atuacao, role, areas_lideradas, telefone1, telefone2
  ) values (
    trim(p_nome),
    nullif(trim(coalesce(p_codigo_pf, '')), ''),
    nullif(trim(coalesce(p_unidade, '')), ''),
    nullif(trim(coalesce(p_org_depto, '')), ''),
    nullif(trim(coalesce(p_funcao, '')), ''),
    p_data_inicio,
    p_data_saida,
    nullif(trim(coalesce(p_obs, '')), ''),
    effective_area,
    effective_role,
    case when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[]) else '{}'::text[] end,
    nullif(trim(coalesce(p_telefone1, '')), ''),
    nullif(trim(coalesce(p_telefone2, '')), '')
  )
  returning id into novo_id;

  return novo_id;
end;
$$;

-- atualizar_voluntario: fallback do gate para cargos usando a área/
-- localidade atuais da linha (o trigger sincroniza area_id/localidade_id).
create or replace function public.atualizar_voluntario(
  p_cadastro_id bigint,
  p_nome text,
  p_codigo_pf text,
  p_unidade text,
  p_org_depto text,
  p_funcao text,
  p_data_inicio date,
  p_data_saida date,
  p_obs text,
  p_area_atuacao text,
  p_papel public.app_role,
  p_areas_lideradas text[],
  p_ativo boolean,
  p_telefone1 text,
  p_telefone2 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
  t_area_id bigint;
  t_localidade_id bigint;
  linked_profile uuid;
begin
  select area_atuacao, area_id, localidade_id
  into target_area, t_area_id, t_localidade_id
  from public.voluntarios
  where id = p_cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    manager := public.voluntario_manager_scope(t_area_id, t_localidade_id);
  end if;
  if manager is null then
    return false;
  end if;

  update public.voluntarios v
    set nome = trim(p_nome),
        codigo_pf = nullif(trim(coalesce(p_codigo_pf, '')), ''),
        unidade = nullif(trim(coalesce(p_unidade, '')), ''),
        org_depto = nullif(trim(coalesce(p_org_depto, '')), ''),
        funcao = nullif(trim(coalesce(p_funcao, '')), ''),
        data_inicio = p_data_inicio,
        data_saida = p_data_saida,
        obs = nullif(trim(coalesce(p_obs, '')), ''),
        area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
        role = case
          when manager = 'coordenador_geral' then p_papel
          else v.role
        end,
        areas_lideradas = case
          when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[])
          else v.areas_lideradas
        end,
        ativo = p_ativo,
        telefone1 = nullif(trim(coalesce(p_telefone1, '')), ''),
        telefone2 = nullif(trim(coalesce(p_telefone2, '')), '')
    where v.id = p_cadastro_id;

  select id into linked_profile
  from public.profiles
  where voluntario_id = p_cadastro_id;

  if linked_profile is not null then
    if manager = 'coordenador_geral' then
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            role = p_papel,
            ativo = p_ativo
        where id = linked_profile;

      delete from public.lider_areas where lider_id = linked_profile;
      if p_papel = 'coordenador_area' then
        insert into public.lider_areas (lider_id, area)
        select distinct linked_profile, unnest(coalesce(p_areas_lideradas, '{}'::text[]));
      end if;
    else
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            ativo = p_ativo
        where id = linked_profile;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) from public, anon;
grant execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) to authenticated;

revoke execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) from public, anon;
grant execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Políticas existentes ganham as cláusulas de cargo (OR, nunca remove o
--    comportamento atual — coordenadores por cargo se somam aos legados)
-- ---------------------------------------------------------------------------

-- Demandas: SELECT e UPDATE usam o MESMO predicado (cópia literal, por
-- construção — lição SELECT-gates-UPDATE da Fase 2/4).
drop policy "role-scoped demandas visibility" on public.demandas;
create policy "role-scoped demandas visibility"
  on public.demandas
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or (area_id is not null and (select public.coordena_area(area_id)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

drop policy "role-scoped demandas edit" on public.demandas;
create policy "role-scoped demandas edit"
  on public.demandas
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or (area_id is not null and (select public.coordena_area(area_id)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or (area_id is not null and (select public.coordena_area(area_id)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

-- Join tables: visibilidade segue a demanda pai (mesma regra da 0004/0020),
-- agora incluindo o escopo de área por cargo.
drop policy "role-scoped demanda_responsaveis visibility" on public.demanda_responsaveis;
create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or voluntario_id = (select public.meu_voluntario_id())
    or exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or (d.area_id is not null and (select public.coordena_area(d.area_id)))
          or d.criado_por = (select auth.uid())
        )
    )
  );

drop policy "role-scoped membros visibility" on public.demanda_membros;
create policy "role-scoped membros visibility"
  on public.demanda_membros
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or voluntario_id = (select public.meu_voluntario_id())
    or exists (
      select 1 from public.demandas d
      where d.id = demanda_membros.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or (d.area_id is not null and (select public.coordena_area(d.area_id)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- Voluntários: coordenadores por cargo (área com herança e localidade)
-- enxergam as linhas dentro do escopo, somando-se aos legados.
drop policy "roster managers can view all voluntarios" on public.voluntarios;
create policy "roster managers can view all voluntarios"
  on public.voluntarios
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area_atuacao is not null and (select public.is_lider_of_area(area_atuacao)))
    or (area_id is not null and (select public.coordena_area(area_id)))
    or (localidade_id is not null and (select public.coordena_localidade(localidade_id)))
  );

-- Profiles: o join do roster agora considera o escopo por cargo da linha
-- vinculada (email/full_name nas telas de equipe).
drop policy "voluntariado and area coordenadores can view profiles" on public.profiles;
create policy "voluntariado and area coordenadores can view profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select public.has_role('voluntariado'))
    or (area_atuacao is not null and (select public.is_lider_of_area(area_atuacao)))
    or exists (
      select 1 from public.voluntarios v
      where v.id = public.profiles.voluntario_id
        and (
          (v.area_id is not null and (select public.coordena_area(v.area_id)))
          or (v.localidade_id is not null and (select public.coordena_localidade(v.localidade_id)))
        )
    )
  );

-- DIPs: coordenador de localidade atualiza/exclui os DIPs da própria
-- localidade (o resto continua como antes).
drop policy "creator or coordinator can update dips" on public.dips;
create policy "creator or coordinator can update dips"
  on public.dips
  for update
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (localidade_id is not null and (select public.coordena_localidade(localidade_id)))
  )
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (localidade_id is not null and (select public.coordena_localidade(localidade_id)))
  );

drop policy "creator or coordinator can delete dips" on public.dips;
create policy "creator or coordinator can delete dips"
  on public.dips
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (localidade_id is not null and (select public.coordena_localidade(localidade_id)))
  );

-- Projetos: coordenador por cargo atualiza os projetos da própria área.
drop policy "creator or coordinator can update projetos" on public.projetos;
create policy "creator or coordinator can update projetos"
  on public.projetos
  for update
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('coordenador_area'))
    or (area_id is not null and (select public.coordena_area(area_id)))
  )
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('coordenador_area'))
    or (area_id is not null and (select public.coordena_area(area_id)))
  );
