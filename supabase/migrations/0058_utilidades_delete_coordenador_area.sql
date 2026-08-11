-- supabase/migrations/0058_utilidades_delete_coordenador_area.sql
-- Permite que coordenadores de área excluam itens do acervo de utilidades,
-- espelhando a policy de update (0032/0022): criador, coordenador_geral ou
-- coordenador_area podem excluir.

DROP POLICY IF EXISTS "creator or coordinator can delete utilidades" ON public.utilidades_itens;

CREATE POLICY "creator or coordinator can delete utilidades"
  on public.utilidades_itens
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('coordenador_area'))
  );
