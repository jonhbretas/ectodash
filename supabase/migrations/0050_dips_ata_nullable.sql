-- supabase/migrations/0050_dips_ata_nullable.sql
-- Allow DIP records to exist without a linked meeting (ata).
-- Standalone DIP registrations (via /dips/cadastro) don't always originate
-- from a meeting analysis, so ata_id must be nullable.

alter table public.dips
  alter column ata_id drop not null;
