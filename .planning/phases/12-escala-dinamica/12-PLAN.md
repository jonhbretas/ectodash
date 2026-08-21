# Phase 12: Escala Dinâmica — Confirmação, Visualização Regional e Dashboard

## Goal

Transformar a escala de voluntários em um sistema dinâmico onde: (1) voluntários confirmam ou recusam suas alocações após publicação, (2) a visualização é organizada por região em abas com tabela horizontal tipo Gantt, e (3) um dashboard de comprometimento mostra métricas de desempenho dos voluntários.

## Context

A escala de voluntários já existe com: criação de escalas semanais, alocação automática round-robin, registro de ausências com substituição automática, e painel de disponibilidade pré-publicação. Porém:

- **Sem confirmação pós-publicação**: voluntários não podem aceitar/recusar a função asignada
- **Sem visualização regional organizada**: as escalas são listadas em sequência, sem agrupamento por região
- **Sem métricas de comprometimento**: não há dados sobre desempenho, frequência de desmarcações, etc.
- **Tabela mensal vertical**: a visão mensal mostra funções como linhas e datas como colunas, mas não é interativa nem horizontal scrollável

## Success Criteria

1. Após publicar uma escala, voluntários podem confirmar ou recusar a função asignada diretamente na tela de detalhe
2. A página principal de escalas mostra abas por região, com a tabela horizontal de alocação do tempo por função
3. O dashboard de comprometimento mostra métricas por voluntário, função e região (desmarcações, frequência, score)
4. A tabela horizontal mantém funções fixas à esquerda enquanto datas rolam para a direita

---

## Wave 1: Database — Confirmação de Alocação

### Task 1: Migration — adicionar coluna de confirmação

**Arquivo:** `supabase/migrations/0085_escala_confirmacao.sql`

Adicionar coluna `confirmacao` na tabela `escala_alocacao`:

```sql
-- Adicionar status de confirmação
ALTER TABLE escala_alocacao
  ADD COLUMN confirmacao text NOT NULL DEFAULT 'pendente'
  CHECK (confirmacao IN ('pendente', 'confirmado', 'recusado'));

-- Atualizar a função de substituição para considerar confirmações recusadas
CREATE OR REPLACE FUNCTION substituir_ausente(
  p_escala_id bigint,
  p_voluntario_ausente_id bigint
) RETURNS TABLE(
  funcao text,
  substituto_nome text,
  substituto_id bigint
) AS $$
DECLARE
  v_funcao text;
  v_localidade text;
  v_escala_status text;
BEGIN
  -- Buscar a função do ausente e dados da escala
  SELECT ea.funcao, es.localidade, es.status
  INTO v_funcao, v_localidade, v_escala_status
  FROM escala_alocacao ea
  JOIN escala_semanal es ON es.id = ea.escala_id
  WHERE ea.escala_id = p_escala_id AND ea.voluntario_id = p_voluntario_ausente_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Remover a alocação do ausente
  DELETE FROM escala_alocacao
  WHERE escala_id = p_escala_id AND voluntario_id = p_voluntario_ausente_id;

  -- Buscar substituto: voluntário ativo, não ausente, não alocado, com menos participações
  -- Considera volunteers que confirmaram OU estão pendentes (não recusados)
  RETURN QUERY
  WITH substituto AS (
    SELECT v.id, v.nome, v.epicom,
           COUNT(hf.voluntario_id) AS total_funcao
    FROM voluntarios v
    LEFT JOIN historico_funcoes_voluntario(v_localidade) hf
      ON hf.voluntario_id = v.id
      AND regexp_replace(hf.funcao, ' \d+$', '') = regexp_replace(v_funcao, ' \d+$', '')
    WHERE v.ativo = true
      AND v.data_saida IS NULL
      AND v.id != p_voluntario_ausente_id
      AND NOT EXISTS (
        SELECT 1 FROM escala_ausencia ea2
        WHERE ea2.escala_id = p_escala_id AND ea2.voluntario_id = v.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM escala_alocacao ea3
        WHERE ea3.escala_id = p_escala_id AND ea3.voluntario_id = v.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM escala_disponibilidade ed
        WHERE ed.escala_id = p_escala_id AND ed.voluntario_id = v.id AND ed.disponivel = false
      )
      -- Filtro de elegibilidade por tipo de função
      AND (
        (v_funcao LIKE 'Epicon%' AND v.epicom = true)
        OR (v_funcao LIKE 'Energizador 1%' AND EXISTS (
          SELECT 1 FROM voluntario_atividades va
          WHERE va.voluntario_id = v.id AND va.atividade = 'docente_conscienciologia'
        ))
        OR (v_funcao NOT LIKE 'Epicon%' AND v_funcao NOT LIKE 'Energizador 1%')
        OR v_funcao LIKE 'Observador Parapsíquico%'
      )
      -- Filtro por localidade (usando unidade como fallback)
      AND (v_localidade IS NULL OR v.unidade = v_localidade OR v_localidade = '')
    GROUP BY v.id, v.nome, v.epicom
    ORDER BY
      COUNT(hf.voluntario_id) ASC,
      v.nome ASC
    LIMIT 1
  )
  SELECT substituto.nome AS funcao, substituto.nome, substituto.id
  FROM substituto;

  -- Se encontrou substituto, inserir na alocação
  IF FOUND THEN
    INSERT INTO escala_alocacao (escala_id, funcao, voluntario_id, confirmacao)
    VALUES (p_escala_id, v_funcao, (SELECT id FROM substituto), 'pendente');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para confirmar/recusar alocação
CREATE OR REPLACE FUNCTION confirmar_alocacao(
  p_escala_id bigint,
  p_voluntario_id bigint,
  p_confirmacao text
) RETURNS void AS $$
BEGIN
  IF p_confirmacao NOT IN ('confirmado', 'recusado', 'pendente') THEN
    RAISE EXCEPTION 'Confirmação inválida: %', p_confirmacao;
  END IF;

  UPDATE escala_alocacao
  SET confirmacao = p_confirmacao
  WHERE escala_id = p_escala_id AND voluntario_id = p_voluntario_id;

  -- Se recusou, tentar substituir automaticamente
  IF p_confirmacao = 'recusado' THEN
    PERFORM substituir_ausente(p_escala_id, p_voluntario_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: voluntários podem confirmar suas próprias alocações
CREATE POLICY "voluntarios_confirmam_alocacao"
  ON escala_alocacao
  FOR UPDATE
  TO authenticated
  USING (
    voluntario_id = (
      SELECT p.voluntario_id FROM profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    voluntario_id = (
      SELECT p.voluntario_id FROM profiles p WHERE p.id = auth.uid()
    )
  );

-- RLS: coordenadores podem confirmar qualquer alocação
CREATE POLICY "coordenadores_confirmam_qualquer_alocacao"
  ON escala_alocacao
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('coordenador_geral', 'voluntariado')
    )
  );
```

**Acceptance Criteria:**
- [ ] Coluna `confirmacao` existe com default 'pendente'
- [ ] Valores permitidos: pendente, confirmado, recusado
- [ ] `confirmar_alocacao` atualiza o status e dispara substituição se recusado
- [ ] `substituir_ausente` ignora voluntários com confirmação 'recusado'
- [ ] RLS permite voluntário confirmar própria alocação
- [ ] RLS permite coordenador confirmar qualquer alocação
- [ ] Migração aplicada com `supabase db push --linked --yes`

---

## Wave 2: Server Actions — Confirmação e Consulta Regional

### Task 2: Atualizar actions.ts com confirmação e queries regionais

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/actions.ts`

Adicionar/atualizar:

```typescript
// ── Nova action: confirmar alocação ──────────────────────────────────

export async function confirmarAlocacao(
  escalaId: number,
  voluntarioId: number,
  confirmacao: "confirmado" | "recusado" | "pendente"
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  // Verificar se é o próprio voluntário ou coordenador
  const { data: profile } = await supabase
    .from("profiles").select("role, voluntario_id").eq("id", user.id).single();

  const isOwn = profile?.voluntario_id === voluntarioId;
  const isCoord = profile?.role === "coordenador_geral" || profile?.role === "voluntariado";

  if (!isOwn && !isCoord) {
    return { ok: false, message: "Sem permissão." };
  }

  const { error } = await supabase.rpc("confirmar_alocacao", {
    p_escala_id: escalaId,
    p_voluntario_id: voluntarioId,
    p_confirmacao: confirmacao,
  });

  if (error) return { ok: false, message: "Erro ao confirmar." };

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return { ok: true, message: `Alocação ${confirmacao}.` };
}

// ── Nova action: buscar escalas por região ────────────────────────────

export async function buscarEscalasPorRegiao() {
  const supabase = await createClient();

  const { data: localidades } = await supabase
    .from("voluntario_localidades")
    .select("id, nome")
    .order("nome");

  if (!localidades || localidades.length === 0) return [];

  const resultados = [];

  for (const loc of localidades) {
    const { data: escalas } = await supabase
      .from("escala_semanal")
      .select("id, data_semana, localidade, status")
      .eq("localidade", loc.nome)
      .gte("data_semana", new Date().toISOString().split("T")[0])
      .order("data_semana")
      .limit(12); // próximas 12 semanas

    if (!escalas || escalas.length === 0) continue;

    const escalaIds = escalas.map(e => e.id);
    const { data: alocacoes } = await supabase
      .from("escala_alocacao")
      .select("escala_id, funcao, voluntario_id, confirmacao, voluntarios(id, nome, unidade)")
      .in("escala_id", escalaIds);

    // Agrupar por escala
    const porEscala = new Map<number, typeof alocacoes>();
    for (const e of escalas) porEscala.set(e.id, []);
    for (const a of alocacoes ?? []) porEscala.get(a.escala_id)?.push(a);

    resultados.push({
      localidade: loc.nome,
      escalas: escalas.map(e => ({
        ...e,
        alocacoes: (porEscala.get(e.id) ?? []).map(a => {
          const vol = Array.isArray(a.voluntarios) ? a.voluntarios[0] : a.voluntarios;
          return {
            funcao: a.funcao,
            voluntario_id: a.voluntario_id,
            voluntario_nome: vol?.nome ?? "?",
            confirmacao: a.confirmacao ?? "pendente",
          };
        }),
      })),
    });
  }

  return resultados;
}

// ── Nova action: buscar dados do dashboard de comprometimento ─────────

export async function buscarDadosComprometimento() {
  const supabase = await createClient();

  // 1. Histórico de funções por voluntário
  const { data: historico } = await supabase.rpc("historico_funcoes_voluntario", {
    p_localidade: null,
  });

  // 2. Total de escalas por região
  const { data: escalasPorRegiao } = await supabase
    .from("escala_semanal")
    .select("localidade, id, status")
    .neq("status", "cancelada");

  // 3. Ausências
  const { data: ausencias } = await supabase
    .from("escala_ausencia")
    .select("voluntario_id, escala_id, motivo, voluntarios(id, nome)");

  // 4. Confirmações e recusas
  const { data: alocacoes } = await supabase
    .from("escala_alocacao")
    .select("voluntario_id, funcao, confirmacao, escala_id, voluntarios(id, nome)");

  // Processar dados
  const voluntarios = new Map<number, {
    nome: string;
    total_alocacoes: number;
    confirmacoes: number;
    recusas: number;
    ausencias: number;
    funcoes: Map<string, number>;
    regioes: Set<string>;
  }>();

  // Processar alocações
  for (const a of alocacoes ?? []) {
    const vol = Array.isArray(a.voluntarios) ? a.voluntarios[0] : a.voluntarios;
    if (!vol) continue;

    const existing = voluntarios.get(a.voluntario_id) ?? {
      nome: vol.nome,
      total_alocacoes: 0,
      confirmacoes: 0,
      recusas: 0,
      ausencias: 0,
      funcoes: new Map(),
      regioes: new Set(),
    };

    existing.total_alocacoes++;
    if (a.confirmacao === "confirmado") existing.confirmacoes++;
    if (a.confirmacao === "recusado") existing.recusas++;

    const funcaoBase = a.funcao.replace(/ \d+$/, "");
    existing.funcoes.set(funcaoBase, (existing.funcoes.get(funcaoBase) ?? 0) + 1);

    voluntarios.set(a.voluntario_id, existing);
  }

  // Processar ausências
  for (const aus of ausencias ?? []) {
    const vol = Array.isArray(aus.voluntarios) ? aus.voluntarios[0] : aus.voluntarios;
    if (!vol) continue;

    const existing = voluntarios.get(aus.voluntario_id) ?? {
      nome: vol.nome,
      total_alocacoes: 0,
      confirmacoes: 0,
      recusas: 0,
      ausencias: 0,
      funcoes: new Map(),
      regioes: new Set(),
    };

    existing.ausencias++;
    voluntarios.set(aus.voluntario_id, existing);
  }

  // Montar resultado
  const resultado = Array.from(voluntarios.values()).map(v => ({
    nome: v.nome,
    total_alocacoes: v.total_alocacoes,
    confirmacoes: v.confirmacoes,
    recusas: v.recusas,
    ausencias: v.ausencias,
    taxa_confirmacao: v.total_alocacoes > 0
      ? Math.round((v.confirmacoes / v.total_alocacoes) * 100)
      : 0,
    taxa_ausencia: v.total_alocacoes > 0
      ? Math.round((v.ausencias / v.total_alocacoes) * 100)
      : 0,
    funcoes: Object.fromEntries(v.funcoes),
    score_compromisso: calcularScore(v),
  }));

  // Ordenar por score decrescente
  resultado.sort((a, b) => b.score_compromisso - a.score_compromisso);

  return {
    voluntarios: resultado,
    resumo: {
      total_alocacoes: alocacoes?.length ?? 0,
      total_confirmacoes: alocacoes?.filter(a => a.confirmacao === "confirmado").length ?? 0,
      total_recusas: alocacoes?.filter(a => a.confirmacao === "recusado").length ?? 0,
      total_ausencias: ausencias?.length ?? 0,
    },
  };
}

function calcularScore(vol: {
  total_alocacoes: number;
  confirmacoes: number;
  recusas: number;
  ausencias: number;
}): number {
  if (vol.total_alocacoes === 0) return 0;

  const taxaConfirmacao = vol.confirmacoes / vol.total_alocacoes;
  const taxaAusencia = vol.ausencias / vol.total_alocacoes;
  const taxaRecusa = vol.recusas / vol.total_alocacoes;

  // Score: 0-100, maior = mais comprometido
  // Fatores: confirmação (+), ausência (-), recusa (-)
  const score = (
    taxaConfirmacao * 60 +           // 60% peso para confirmações
    (1 - taxaAusencia) * 25 +        // 25% peso para presença
    (1 - taxaRecusa) * 15            // 15% peso para não-recusa
  ) * 100;

  return Math.round(Math.max(0, Math.min(100, score)));
}
```

**Acceptance Criteria:**
- [ ] `confirmarAlocacao` funciona para voluntário (própria alocação) e coordenador (qualquer)
- [ ] `buscarEscalasPorRegiao` retorna escalas futuras agrupadas por localidade
- [ ] `buscarDadosComprometimento` calcula métricas corretas
- [ ] Score de compromisso reflete confirmações, ausências e recusas
- [ ] Todas as actions usam SECURITY DEFINER via RPC
- [ ] `revalidatePath` chamado corretamente após mutations

---

## Wave 3: Componente de Confirmação

### Task 3: Painel de confirmação para escala publicada

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/confirmacao-panel.tsx`

Componente client-side que aparece quando a escala está `publicada` e o voluntário tem alocação:

```tsx
"use client";
// Mostra para cada alocação do voluntário:
// - Badge de status (pendente/confirmado/recusado)
// - Botões "Confirmar" e "Recusar"
// - Para coordenador: toggle de confirmação de qualquer voluntário
// - Se recusou: mensagem de que busca substituto automaticamente
```

**Acceptance Criteria:**
- [ ] Painel aparece apenas quando status da escala é `publicada`
- [ ] Voluntário vê suas próprias alocações com botões de confirmação
- [ ] Coordenador vê todos os voluntários com possibilidade de confirmar
- [ ] Badge visual: pendente (amarelo), confirmado (verde), recusado (vermelho)
- [ ] Ao recusar, mensagem confirma que busca substituto automaticamente
- [ ] Loading states em todos os botões

### Task 4: Atualizar detail page para incluir painel de confirmação

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/[id]/page.tsx`

- Buscar `confirmacao` das alocações
- Passar dados para `EscalaTable` e `ConfirmacaoPanel`
- Mostrar `ConfirmacaoPanel` quando escala é `publicada`

**Acceptance Criteria:**
- [ ] Dados de confirmação são buscados e passados para componentes
- [ ] `ConfirmacaoPanel` renderiza quando status é `publicada`
- [ ] `EscalaTable` mostra badge de confirmação ao lado de cada voluntário

---

## Wave 4: Tabela Horizontal (Gantt-style)

### Task 5: Componente de tabela horizontal com scroll

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/escala-timeline.tsx`

Tabela horizontal onde:
- **Coluna fixa esquerda**: Funções (Epicon, Energizador, etc.)
- **Colunas roláveis**: Datas (próximas semanas)
- **Células**: Nome do voluntário + badge de confirmação
- **Sticky header**: Datas ficam fixas no topo ao rolar

```tsx
"use client";
// Layout:
// | Função (sticky) | Sem 1 | Sem 2 | Sem 3 | ... | Sem 12 |
// | Epicon          | João  | Maria | João  | ... | Pedro  |
// | Energizador 1   | Ana   | Pedro | Ana   | ... | João   |
// | ...
//
// - Função coluna: sticky left-0, z-10
// - Datas: scroll horizontal, sticky top-0
// - Células: badge de confirmação (verde/vermelho/amarelo)
// - Hover: destaca linha e coluna
// - Empty cells: "—" cinza
```

**Acceptance Criteria:**
- [ ] Tabela renderiza com função como primeira coluna sticky
- [ ] Scroll horizontal funciona para 12+ semanas
- [ ] Scroll vertical funciona para todas as funções
- [ ] Datas no header são sticky no topo
- [ ] Células mostram nome do voluntário ou "—" se vazio
- [ ] Badges de confirmação (confirmado=verde, recusado=vermelho, pendente=amarelo)
- [ ] Hover effect destaca linha e coluna
- [ ] Responsivo: funciona em mobile com scroll

### Task 6: Página de escala regional com abas

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/page.tsx` (atualizar)

Transformar a página principal:
- Buscar escalas por região via `buscarEscalasPorRegiao()`
- Renderizar abas (tabs) com nome de cada região
- Cada aba mostra a tabela horizontal (`EscalaTimeline`)
- Aba "Todas" mostra todas as regiões combinadas

**Acceptance Criteria:**
- [ ] Abas são geradas dinamicamente a partir das localidades cadastradas
- [ ] Aba "Todas" mostra visão consolidada
- [ ] Cada aba renderiza `EscalaTimeline` com dados daquela região
- [ ] Aba ativa é destacada visualmente
- [ ] Se não há escalas para uma região, mostra mensagem amigável
- [ ] Navegação funciona via query params (persiste ao recarregar)

---

## Wave 5: Dashboard de Comprometimento

### Task 7: Página do dashboard de comprometimento

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/comprometimento/page.tsx`

Dashboard com:

```tsx
// Layout:
// ┌─────────────────────────────────────────────────────┐
// │ Resumo Geral                                        │
// │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
// │ │Total│ │Conf │ │Recus│ │Ausên│                     │
// │ │Aloc │ │ %   │ │ %   │ │ %   │                     │
// │ └─────┘ └─────┘ └─────┘ └─────┘                   │
// ├─────────────────────────────────────────────────────┤
// │ Score de Compromisso por Voluntário                 │
// │ ┌─────────────────────────────────────────────────┐ │
// │ │ Maria    ████████████████████░░░░  85%  🟢     │ │
// │ │ João     ████████████████░░░░░░░░  72%  🟡     │ │
// │ │ Pedro    ████████████░░░░░░░░░░░░  58%  🟠     │ │
// │ └─────────────────────────────────────────────────┘ │
// ├─────────────────────────────────────────────────────┤
// │ Distribuição de Funções                             │
// │ ┌─────────────────────────────────────────────────┐ │
// │ │ Epicon:        3 vol (Maria, João, Pedro)      │ │
// │ │ Energizador:   5 vol (Ana, Carlos, ...)        │ │
// │ │ Monitoria:     4 vol (Lucia, Paulo, ...)       │ │
// │ └─────────────────────────────────────────────────┘ │
// ├─────────────────────────────────────────────────────┤
// │ Top Ausências                                       │
// │ ┌─────────────────────────────────────────────────┐ │
// │ │ 1. João Silva    — 5 ausências (32%)           │ │
// │ │ 2. Pedro Santos  — 3 ausências (25%)           │ │
// │ │ 3. Ana Oliveira  — 2 ausências (18%)           │ │
// │ └─────────────────────────────────────────────────┘ │
// └─────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Cards de resumo: total de alocações, confirmações, recusas, ausências
- [ ] Lista de voluntários com score de compromisso (barra de progresso)
- [ ] Distribuição de funções com contagem de voluntários
- [ ] Ranking de ausências (top voluntários com mais faltas)
- [ ] Filtro por período (último mês, 3 meses, 6 meses, 1 ano)
- [ ] Acesso: coordenador_geral, voluntariado
- [ ] Layout responsivo (cards em grid)

### Task 8: Adicionar link no menu e breadcrumb

**Arquivo:** `src/app/(dashboard)/nav-items.ts`

Adicionar item de menu "Comprometimento" na seção de voluntários/escala.

**Acceptance Criteria:**
- [ ] Link "Comprometimento" aparece no menu lateral
- [ ] Ícone apropriado (BarChart3 ou similar)
- [ ] Acesso restrito a coordenador_geral e voluntariado
- [ ] Breadcrumb funciona na página de comprometimento

---

## Wave 6: Integração e Polish

### Task 9: Atualizar escala-table.tsx com badges de confirmação

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/escala-table.tsx`

- Adicionar coluna de confirmação quando status é `publicada`
- Mostrar badge (pendente/confirmado/recusado) ao lado de cada voluntário
- Para coordenador: botão de toggle confirmação inline

**Acceptance Criteria:**
- [ ] Badge aparece apenas quando escala está `publicada`
- [ ] Coordenador pode toggle confirmação de qualquer voluntário
- [ ] Visual consistente com o resto do sistema

### Task 10: Atualizar mensal/page.tsx com dados de confirmação

**Arquivo:** `src/app/(dashboard)/voluntarios/escala/mensal/page.tsx`

- Buscar dados de confirmação das alocações
- Mostrar mini-badge de confirmação nas células da tabela mensal

**Acceptance Criteria:**
- [ ] Células da tabela mensal mostram badge de confirmação
- [ ] Legenda explicativa dos badges

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/0085_escala_confirmacao.sql` | Nova migration: coluna confirmacao, RPCs, RLS |
| `src/app/(dashboard)/voluntarios/escala/actions.ts` | Novas actions: confirmarAlocacao, buscarEscalasPorRegiao, buscarDadosComprometimento |
| `src/app/(dashboard)/voluntarios/escala/confirmacao-panel.tsx` | Novo componente: painel de confirmação |
| `src/app/(dashboard)/voluntarios/escala/escala-timeline.tsx` | Novo componente: tabela horizontal Gantt |
| `src/app/(dashboard)/voluntarios/escala/page.tsx` | Atualizar: abas por região + timeline |
| `src/app/(dashboard)/voluntarios/escala/[id]/page.tsx` | Atualizar: incluir ConfirmacaoPanel |
| `src/app/(dashboard)/voluntarios/escala/escala-table.tsx` | Atualizar: badges de confirmação |
| `src/app/(dashboard)/voluntarios/escala/mensal/page.tsx` | Atualizar: badges de confirmação |
| `src/app/(dashboard)/voluntarios/escala/comprometimento/page.tsx` | Nova página: dashboard |
| `src/app/(dashboard)/nav-items.ts` | Atualizar: link de comprometimento |

## Dependencies

- Migration 0084 (escala_disponibilidade) já aplicada
- Tabela `voluntario_localidades` com dados
- Tabela `escala_alocacao` com dados existentes

## Verification

1. Criar escala → gerar alocação → publicar → voluntário confirma → badge atualiza
2. Publicar escala → voluntário recusa → substituto buscado automaticamente
3. Página principal mostra abas por região com tabela horizontal
4. Tabela horizontal: scroll funciona, funções sticky à esquerda
5. Dashboard mostra métricas corretas
6. Acesso restrito: voluntário comum não acessa dashboard
