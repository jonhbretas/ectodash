# Requirements: EctoDash

**Defined:** 2026-08-02
**Core Value:** Coordenador consegue ver, num só lugar, o andamento real de todas as demandas/projetos da instituição — quem é responsável, qual o prazo, o que está atrasado — sem precisar cobrar manualmente ou vasculhar planilhas e grupos.

## v1 Requirements

### Autenticação e Papéis

- [x] **AUTH-01**: Usuário faz login com e-mail institucional
- [x] **AUTH-02**: Sistema define 4 papéis fixos: Coordenador geral, Líder de área/projeto, Voluntário comum, Financeiro
- [x] **AUTH-03**: Acesso a dados sensíveis (financeiro) é restrito por papel via RLS no banco, não só ocultado na tela
- [x] **AUTH-04**: Sessão persiste entre acessos (sem re-login constante)

### Demandas

- [x] **DEM-01**: Usuário cria demanda com título, responsável, prazo, status e área/projeto
- [x] **DEM-02**: Usuário edita e conclui demanda
- [x] **DEM-03**: Demanda com prazo vencido é sinalizada visualmente como atrasada
- [x] **DEM-04**: Usuário filtra/agrupa demandas por área, projeto ou responsável
- [x] **DEM-05**: Voluntário comum vê e edita só suas próprias demandas; líder de área vê as da sua área; coordenador vê tudo

### Lembretes por E-mail

- [x] **LEMB-01**: Sistema envia lembrete por e-mail (Resend) para demandas com prazo próximo
- [x] **LEMB-02**: Sistema envia lembrete por e-mail para demandas já atrasadas
- [x] **LEMB-03**: Envio é idempotente — não manda lembrete duplicado no mesmo dia/ciclo
- [x] **LEMB-04**: Execução do job de lembrete fica registrada e visível (sucesso/falha, quantidade enviada)

### Extração de Demandas via IA

- [ ] **IA-01**: Usuário cola resumo de reunião já pronto (gerado por Fireflies/tl;dv) no sistema
- [ ] **IA-03**: Sistema extrai do resumo colado uma lista de demandas sugeridas (título, responsável, prazo)
- [ ] **IA-04**: Demandas extraídas por IA passam por tela de revisão/confirmação humana antes de virarem demandas reais no sistema — nunca criação automática sem revisão

### Dashboard Financeiro

- [ ] **FIN-01**: Sistema sincroniza dados automaticamente da planilha Google Sheets de fluxo de caixa (formato fixo)
- [ ] **FIN-02**: Sistema exibe dashboard visual com entradas, saídas, resultado do mês e caixa atual
- [ ] **FIN-03**: Sistema mostra indicador visível de última sincronização (data/hora, sucesso ou falha)
- [ ] **FIN-04**: Acesso ao dashboard financeiro é restrito aos papéis Coordenador geral e Financeiro

### Painel do Coordenador

- [x] **COORD-01**: Coordenador vê painel único com status de projetos/pesquisas/tarefas por voluntário
- [x] **COORD-02**: Painel destaca demandas atrasadas em toda a instituição
- [x] **COORD-03**: Painel resume contagem de demandas por área e por voluntário

### UX Acessível

- [x] **UX-01**: Interface usa fontes, contraste e toques grandes o suficiente para público de terceira idade
- [x] **UX-02**: Formulários são curtos, com poucos campos por tela e confirmação clara em ações importantes
- [x] **UX-03**: Sistema é responsivo (funciona bem em celular e desktop)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Integrações Futuras

- **FASE2-01**: Integração com Google Agenda (eventos vinculados a e-mails institucionais)
- **FASE2-02**: Central de acervo conectada ao Google Drive
- **FASE2-03**: Tela de Gescons (artigos científicos: rascunho, revisão, publicado)
- **FASE2-04**: Tela de Eventos (metas, quantidade de alunos, etc.)
- **FASE2-05**: Tela de Utilidades por área (comunicação, voluntariado, eventos, etc.)
- **FASE2-06**: Ingestão automática via API do Fireflies/tl;dv (sem colar texto manual)

### Refinamentos Pós-Validação

- **REFI-01**: Lembretes com cadência escalonada (aviso → firme → escalar para líder de área se atrasado N dias)
- **REFI-02**: Dashboards com layout específico por papel, em vez de um painel único com visibilidade condicional
- **REFI-03**: Edição em lote/rápida de demandas (mudança de status inline)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Integração com ICNET | Decisão adiada — incerto se vai integrar, não pode travar v1 |
| Pipeline próprio de transcrição de áudio | Ferramentas externas (Fireflies/tl;dv) já resolvem isso; construir do zero adiciona custo de storage/consentimento sem necessidade |
| Notificações via SMS/WhatsApp/push | E-mail institucional já é o canal padrão; canais extras multiplicam custo de integração sem dado que justifique ainda |
| Builder de permissões granulares por campo | Sistema de 4 papéis fixos é suficiente pro tamanho da instituição; permissão por campo é complexidade desproporcional |
| Dashboard/BI genérico para financeiro (queries ad-hoc, drill-down livre) | Necessidade real é visão fixa de fluxo de caixa, não ferramenta de BI; planilha original continua disponível pra análises mais profundas |
| Atualização em tempo real via websocket | Público não checa o painel a cada segundo; sincronização periódica com timestamp visível é suficiente e mais barata |
| Sistema gerar resumo de reunião via IA | Fireflies/tl;dv já geram o resumo; sistema só recebe o resumo pronto colado pelo usuário, evita duplicar processamento |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| UX-01 | Phase 3 | Complete |
| UX-03 | Phase 3 | Complete |
| DEM-01 | Phase 4 | Complete |
| DEM-02 | Phase 4 | Complete |
| DEM-03 | Phase 4 | Complete |
| DEM-04 | Phase 5 | Complete |
| DEM-05 | Phase 5 | Complete |
| UX-02 | Phase 5 | Complete |
| COORD-01 | Phase 6 | Complete |
| COORD-02 | Phase 6 | Complete |
| COORD-03 | Phase 6 | Complete |
| LEMB-01 | Phase 7 | Complete |
| LEMB-02 | Phase 7 | Complete |
| LEMB-03 | Phase 7 | Complete |
| LEMB-04 | Phase 7 | Complete |
| IA-01 | Phase 8 | Pending |
| IA-03 | Phase 8 | Pending |
| IA-04 | Phase 8 | Pending |
| FIN-01 | Phase 9 | Pending |
| FIN-03 | Phase 9 | Pending |
| FIN-02 | Phase 10 | Pending |
| FIN-04 | Phase 10 | Pending |

**Coverage:**

- v1 requirements: 26 total
- Mapped to phases: 26 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-08-02*
*Last updated: 2026-08-03 after roadmap revision (IA-02 removed/moved to Out of Scope; old Phase 8 merged into Phase 8/9→8; phases renumbered 8-11 down to 8-10)*
