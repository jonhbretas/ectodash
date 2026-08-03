# Phase 1: Project Scaffold & Institutional Login - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 1-Project Scaffold & Institutional Login
**Areas discussed:** Método de login, Onboarding de voluntário novo, Persistência de sessão

---

## Método de login

| Option | Description | Selected |
|--------|-------------|----------|
| Magic link | Só digita e-mail, recebe link por e-mail e entra. Sem senha pra esquecer — melhor pra terceira idade | ✓ |
| E-mail + senha | Fluxo tradicional, precisa lembrar senha e ter fluxo de reset | |
| Ambos disponíveis | Usuário escolhe magic link ou senha — mais flexível, mais tela pra construir | |

**User's choice:** Magic link (Recomendado)
**Notes:** Escolhido para reduzir fricção para público de terceira idade.

---

## Onboarding de voluntário novo

| Option | Description | Selected |
|--------|-------------|----------|
| Coordenador cadastra/convida | Coordenador adiciona e-mail do voluntário manualmente, ele recebe convite. Controle total de quem entra | ✓ |
| Auto-cadastro com domínio restrito | Qualquer @dominio-instituicao entra sozinho sem aprovação | |
| Auto-cadastro + aprovação do coordenador | Voluntário pede acesso, coordenador aprova depois | |

**User's choice:** Coordenador cadastra/convida (Recomendado)
**Notes:** Nenhum fluxo de auto-cadastro público no v1.

---

## Persistência de sessão

| Option | Description | Selected |
|--------|-------------|----------|
| 30 dias | Longo o suficiente pra não incomodar público de terceira idade; renova a cada acesso | |
| 7 dias | Mais curto, pede login com mais frequência | |
| Sessão indefinida (só sai se clicar sair) | Não expira sozinha, só logout manual | ✓ |

**User's choice:** Sessão indefinida (só sai se clicar sair)
**Notes:** Prioriza não incomodar voluntários idosos com re-login frequente.

---

## Claude's Discretion

- Exact Supabase Auth configuration (magic link template copy, invite e-mail template, session/cookie implementation details)
- Whether the coordinator "invite volunteer" UI ships in Phase 1 or Phase 2

## Deferred Ideas

None — discussion stayed within phase scope.
