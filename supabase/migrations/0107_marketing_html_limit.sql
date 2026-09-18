-- supabase/migrations/0107_marketing_html_limit.sql
-- HTML de marketing com imagens inline passa fácil de 500 KB:
-- relaxa o CHECK para 2 MB (o transporte sobe para 3mb em
-- next.config.ts; Gmail corta visualização acima de ~102 KB, mas isso
-- é aviso de UX na tela, não bloqueio aqui).
alter table public.marketing_campaigns
  drop constraint marketing_campaigns_html_check;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_html_check check (
    char_length(html) between 1 and 2000000
  );
