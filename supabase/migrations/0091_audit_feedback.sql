-- supabase/migrations/0091_audit_feedback.sql
-- Audit trail para feedback: permite aba de Logs em /feedback
-- mostrar quem criou / mudou status. Usa o mesmo trigger genérico
-- de 0059_audit_log.sql.
create trigger audit_feedback
  after insert or update or delete on public.feedback
  for each row execute function public.registrar_audit('id');
