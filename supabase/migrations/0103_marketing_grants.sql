-- supabase/migrations/0103_marketing_grants.sql
-- A página pública /descadastrar?token=... chama
-- marketing_unsubscribe() sem sessão: libera EXECUTE p/ anon e
-- authenticated. A segurança está no token UUID (capacidade
-- unguessable), não na role — sem token válido nada é alcançável.
grant execute on function public.marketing_unsubscribe(uuid) to anon, authenticated;
