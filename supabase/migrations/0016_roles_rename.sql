-- supabase/migrations/0016_roles_rename.sql
-- Role model update (user decision, 2026-08-04):
--   1. `lider_area` renamed to `coordenador_area` ("Coordenador de área").
--   2. New role `voluntariado` — full access to the volunteer roster.
-- Split into its own migration because SQLSTATE 55P04 forbids USING a
-- newly-added enum value in the same transaction that added it — the
-- following migration (0017) is the one that references 'voluntariado' in
-- policies and function bodies.

alter type public.app_role rename value 'lider_area' to 'coordenador_area';
alter type public.app_role add value 'voluntariado';
