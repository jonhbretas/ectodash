-- Eventos são de leitura institucional, mas suas alterações são operacionais
-- da área de Comunicação. Esta função centraliza a regra para RLS e telas:
-- integrante da área, coordenação daquela área ou Coordenação Geral.
create or replace function public.pode_gerir_eventos()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    (select public.has_role('coordenador_geral'))
    or exists (
      select 1
      from public.profiles p
      join public.voluntarios v on v.id = p.voluntario_id
      join public.areas_institucionais a on a.id = v.area_id
      where p.id = (select auth.uid())
        and lower(a.nome) in ('comunicação', 'comunicacao')
    )
    or exists (
      select 1
      from public.areas_institucionais a
      where lower(a.nome) in ('comunicação', 'comunicacao')
        and (select public.coordena_area(a.id))
    );
$$;

revoke execute on function public.pode_gerir_eventos() from public, anon;
grant execute on function public.pode_gerir_eventos() to authenticated;

-- Eventos: leitura continua aberta, enquanto criar/editar/excluir passa a
-- exigir a equipe responsável. As policies substituídas eram baseadas no
-- criador da linha, permitindo que qualquer voluntário administrasse eventos.
drop policy if exists "authenticated users can create eventos" on public.eventos;
drop policy if exists "creator or coordinator can update eventos" on public.eventos;
drop policy if exists "creator or coordinator can delete eventos" on public.eventos;

create policy "equipe de eventos pode criar eventos"
  on public.eventos for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and (select public.pode_gerir_eventos())
  );
create policy "equipe de eventos pode atualizar eventos"
  on public.eventos for update to authenticated
  using ((select public.pode_gerir_eventos()))
  with check ((select public.pode_gerir_eventos()));
create policy "equipe de eventos pode excluir eventos"
  on public.eventos for delete to authenticated
  using ((select public.pode_gerir_eventos()));

-- Tipos e modelos geram demandas em diversas áreas e são configurações
-- sensíveis: seguem a mesma equipe responsável, em vez de qualquer conta.
drop policy if exists "coordinator manages evento tipos" on public.evento_tipos;
drop policy if exists "coordinator manages modelo tarefas" on public.modelo_tarefas;
create policy "equipe de eventos gerencia tipos"
  on public.evento_tipos for all to authenticated
  using ((select public.pode_gerir_eventos()))
  with check ((select public.pode_gerir_eventos()));
create policy "equipe de eventos gerencia modelos"
  on public.modelo_tarefas for all to authenticated
  using ((select public.pode_gerir_eventos()))
  with check ((select public.pode_gerir_eventos()));
