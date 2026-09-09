-- supabase/migrations/0094_ai_provider.sql
-- Permite usar conta propria Claude/Codex sem gastar credito Go.
-- 0094

alter table public.ai_config
  add column if not exists provider text not null default 'opencode-go'
  check (provider in ('opencode-go','anthropic','openai'));

-- Atualiza seed para garantir coluna existe em instancias antigas
update public.ai_config set provider = 'opencode-go' where provider is null;

comment on column public.ai_config.provider is 'opencode-go usa OPENCODE_API_KEY; anthropic usa ANTHROPIC_API_KEY; openai/codex usa OPENAI_API_KEY';
