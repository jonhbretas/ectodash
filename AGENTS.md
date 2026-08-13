<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Regras de Análise de Demandas

Ao analisar qualquer evento, tarefa ou DIP com IA, **sempre**:

1. **Verificar se já existe** — consultar no sistema/banco se há registro duplicado (mesmo evento/tarefa/DIP).
2. **Oferecer opção de mesclagem** — se existir registro prévio, oferecer a opção de **mesclar** dados, pois:
   - Pode haver informações mais recentes
   - Responsáveis podem ter sido alterados
   - Datas podem ter sido atualizadas
   - A demanda deve ser **atualizada**, não duplicada

**Fluxo**: Ao criar/editar demanda → buscar duplicatas → sugerir mesclagem se houver → atualizar registro existente ao invés de criar novo.

## Git

- **Sempre commit + push** após concluir qualquer tarefa/ajuste (o usuário pediu explicitamente; não perguntar de novo).

## Supabase

- **Sempre `supabase db push`** após criar/alterar qualquer migration em `supabase/migrations/` (o usuário pediu explicitamente; rodar com `--linked --yes` sem perguntar).
