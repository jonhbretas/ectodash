-- supabase/migrations/0021_join_tables_profile_nullable.sql
-- Migration 0020 added voluntario_id to demanda_responsaveis/demanda_membros
-- but the original profile_id columns stayed NOT NULL (0003/0012) — a row
-- with only voluntario_id was rejected by 23502. Both columns become
-- nullable; the "exactly one destination" CHECK from 0020 keeps the
-- invariant.

alter table public.demanda_responsaveis
  alter column profile_id drop not null;

alter table public.demanda_membros
  alter column profile_id drop not null;
