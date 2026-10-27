-- Atualiza a escolha global existente: ela tem prioridade sobre AI_MODEL.
-- A chave OpenAI e as permissões de edição permanecem as mesmas.
insert into public.ai_config (id, modelo, provider)
values (1, 'gpt-6-luna', 'openai')
on conflict (id) do update
set modelo = excluded.modelo,
    provider = excluded.provider,
    updated_by = null;
