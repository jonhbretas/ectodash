# EctoDash

## What This Is

Sistema de gestão para voluntários de uma instituição sem fins lucrativos de pesquisa e experimentação. Centraliza demandas/tarefas com prazos e responsáveis, envia lembretes automáticos por e-mail (Resend), transcreve e resume reuniões semanais com IA para gerar novas demandas automaticamente, e oferece um dashboard financeiro visual sincronizado com a planilha de fluxo de caixa da instituição. Voltado para coordenador geral, líderes de área, voluntários comuns e financeiro — com forte atenção a UX simples e acessível (público inclui muita terceira idade).

## Core Value

Coordenador consegue ver, num só lugar, o andamento real de todas as demandas/projetos da instituição — quem é responsável, qual o prazo, o que está atrasado — sem precisar cobrar manualmente ou vasculhar planilhas e grupos.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Cadastro e gestão de demandas: título, responsável, prazo, status, área/projeto
- [ ] Envio de lembretes recorrentes por e-mail via Resend para demandas com prazo próximo/atrasado
- [ ] Colar transcrição de reunião (texto vindo de Fireflies/tl;dv) e gerar resumo com IA
- [ ] A partir do resumo da IA, extrair e cadastrar automaticamente novas demandas (responsável + prazo) no sistema
- [ ] Dashboard financeiro visual e interativo (entradas, saídas, resultado do mês, caixa atual)
- [ ] Sincronização automática com a planilha Google Sheets de fluxo de caixa (formato fixo/padronizado)
- [ ] Painel de visão geral do coordenador: status de projetos/pesquisas/tarefas por voluntário
- [ ] Controle de acesso por papel: Coordenador geral, Líder de área/projeto, Voluntário comum, Financeiro
- [ ] Login vinculado a e-mail institucional

### Out of Scope

- Integração com Google Agenda (eventos vinculados a e-mails institucionais) — fase 2, não trava v1
- Central de acervo conectada ao Google Drive — fase 2
- Tela de Gescons (gestações conscienciais / artigos científicos: rascunho, revisão, publicado) — fase 2
- Tela de Eventos (metas, quantidade de alunos, etc.) — fase 2
- Tela de Utilidades por área (comunicação, voluntariado, eventos, etc.) — fase 2
- Integração com ICNET (ferramenta interna) — decisão adiada, pode nunca entrar
- Sistema de transcrição próprio para todos os voluntários gravarem reuniões — fase 2 (v1 usa texto já exportado de ferramentas como Fireflies/tl;dv)
- Ingestão automática via API de Fireflies/tldv — v1 é colar texto manual; automação fica para depois

## Context

- Instituição sem fins lucrativos, foco em pesquisa e experimentação.
- Público de voluntários inclui parcela relevante de terceira idade — UX precisa ser simples, leve, contraste bom, fluxos curtos.
- Reuniões semanais já são gravadas/transcritas por ferramentas externas (Fireflies, tl;dv); o texto da transcrição é a entrada do sistema, não o áudio.
- Já existe uma planilha de fluxo de caixa em uso, com formato fixo — o sistema deve se adaptar a ela, não substituí-la à força.
- Usuário (owner do projeto) é o coordenador geral, precisa de visão macro de projetos/pesquisas/tarefas por voluntário.

## Constraints

- **Tech stack**: Vercel + Supabase (camada gratuita) — orçamento zero/baixo, evitar serviços pagos
- **Acessibilidade/UX**: público com parcela de terceira idade — interface leve, clara, sem fricção
- **Dados financeiros**: precisa ler/sincronizar com planilha Google Sheets existente de formato fixo
- **IA de resumo/transcrição**: entrada é texto (transcrição já pronta), não processamento de áudio

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| V1 cobre: demandas/prazos, lembretes por e-mail, transcrição colada + resumo IA + geração automática de demandas, dashboard financeiro, painel do coordenador | Núcleo do que resolve a dor real do coordenador agora | — Pending |
| Google Agenda, Drive/acervo, Gescons, Eventos, Utilidades adiados para fase 2 | Escopo grande demais para v1; core value não depende deles | — Pending |
| ICNET fica fora, decisão adiada | Incerteza se vai integrar; não bloqueia v1 | — Pending |
| Entrada da transcrição é texto colado manualmente (Fireflies/tl;dv) | Ferramentas já geram texto; evita construir pipeline de áudio/API agora | — Pending |
| 4 papéis de acesso: Coordenador geral, Líder de área, Voluntário comum, Financeiro | Reflete estrutura real da instituição e sensibilidade dos dados financeiros | — Pending |
| Fluxo de caixa via sincronização automática com Google Sheets | Planilha já existe e tem formato fixo; evita retrabalho de digitação dupla | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-02 after initialization*
