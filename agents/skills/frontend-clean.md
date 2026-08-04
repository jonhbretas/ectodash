# Diretrizes de Design — EctoDash (frontend-clean)

> Guia para qualquer trabalho de frontend/UX neste projeto. Leia antes de
> escrever ou alterar qualquer tela. Estas regras refletem o que já foi
> decidido e implementado — siga o padrão existente, não invente outro.

---

## 1. Contexto

O EctoDash serve **dois públicos no mesmo sistema**: voluntários jovens e
voluntários idosos de uma instituição (~70 pessoas, ~R$ 200 mil/ano). A regra
de ouro é: **moderno e denso onde ajuda a produtividade, grande e simples onde
exige atenção**. A tela principal de trabalho é a de **Demandas** (`/`), com
board kanban full-width, filtros recolhíveis e sidebar colapsável.

Pilares:
- **Acessibilidade é piso, não feature.** Nada aqui pode quebrar o conforto de
  um usuário idoso (visão reduzida, coordenação motora menor, pouca fluência
  tecnológica).
- **Dinâmico e colapsável.** Tudo que rouba espaço da área de trabalho pode ser
  recolhido (sidebar, filtros, colunas do kanban) e a preferência é persistida.
- **Server components buscam dados; client components só interagem.**
  Filtros/estado navegável vivem na URL, validados por zod.

---

## 2. Piso de acessibilidade (obrigatório em toda tela)

| Regra | Valor | Classe de exemplo |
|---|---|---|
| Alvo de toque mínimo | **56px** (44px é o mínimo WCAG; aqui usamos 56) | `min-h-14` |
| Texto de corpo mínimo | **20px** | `text-xl` |
| Texto de metadados/badge mínimo | **16px** | `text-base` — nunca menor |
| Contraste | WCAG AA (4.5:1) | zinc/blue/red/amber da paleta |
| Foco visível | sempre | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700` |
| Estado nunca só por cor | ícone + cor + rótulo de texto | badges de status/atrasada |
| Equivalente de teclado/toque | para cada gesto (drag & drop, hover) | botões ◀/▶ no kanban |

Consequências práticas:
- Controles compactos de ferramenta (colapsar coluna, remover chip) podem ser
  menores que 56px **desde que haja alternativa de 56px ou texto/tooltip
  claros** — mas texto nunca abaixo de 16px.
- Todo botão de ícone precisa de `aria-label` ou texto visível.

---

## 3. Tokens de design

Paleta travada em `src/app/globals.css` (variáveis CSS) — **não introduza
hues novos sem necessidade**:

| Papel | Valor | Uso |
|---|---|---|
| Dominante | `zinc-50` bg / `zinc-900` texto | fundo da página, texto principal |
| Superfície | `white` / borda `zinc-200`/`zinc-300` | cards, colunas, containers |
| Acento | `blue-700` (#1D4ED8) | CTAs primários, foco, item ativo do menu |
| Destrutivo | `red-700` | atrasada, erros |
| Sucesso | `green-700` | concluída |
| Aviso | `amber-700` | pendente |

Tipografia: Geist Sans. Escala usada: `text-base` (16px, meta), `text-xl`
(20px, corpo), `text-2xl` (24px, título de seção), `text-3xl` (30px, display).
Espaçamento: múltiplos de 4 (`gap-1`..`gap-4`, `p-3`, `px-6`...).

Componentes: shadcn/ui em `src/components/ui/` (Button, Select, Badge, Card,
Table...). Ícones: `lucide-react`. Botão padrão do projeto já tem
`min-h-14 text-xl` embutido — use `<Button>` em vez de `<button>` cru.

---

## 4. Padrões da tela de demandas (referência)

A tela atual (`src/app/(dashboard)/page.tsx` + `demandas/`) define o padrão
visual de todo o app:

1. **Kanban é a visão padrão** (`view ?? "kanban"`); lista e calendário são
   opt-in via `?view=lista|calendario`.
2. **Board full-width** — sem `max-w-*` no layout principal; colunas com
   `flex-1` dividem a largura igualmente.
3. **Colunas colapsáveis** — recolher uma coluna libera espaço para as demais
   (layout dinâmico). Rótulo + contagem visíveis mesmo recolhida.
4. **Cards do kanban**: título (`text-lg` semibold, `line-clamp-2`), prazo com
   ícone (vermelho + badge `Atrasada` quando atrasado), responsável com avatar
   de iniciais, chips de área/etiqueta, barra de progresso de checklist.
5. **Filtros recolhíveis** — uma linha compacta ("Filtros" + contador + chips
   removíveis); expande para os 7 selects em grid de até 4 colunas. Rótulos
   viram `aria-label`; nunca uma pilha vertical de label+select.
6. **Sidebar colapsável** — rail de ícones (w-20) com tooltips; botão
   "Recolher menu" no rodapé.
7. **Prefeferências persistidas** com o hook `src/lib/use-stored-preference.ts`
   (localStorage + `useSyncExternalStore`, hidratação-safe). **Não** use
   `setState` dentro de `useEffect` — o lint (`react-hooks/set-state-in-effect`)
   rejeita.

Layout responsivo: abaixo de `lg` colunas/cards empilham; controles que só
fazem sentido no desktop são escondidos (`hidden lg:flex`).

---

## 5. Arquitetura de dados e estado

- **Busca no servidor**: `page.tsx` (server component) lê
  `searchParams`, valida com zod (`demanda-filter-schema.ts`), consulta o
  Supabase com o client autenticado e repassa dados prontos (nomes, contagens).
- **Interação no cliente**: `router.push` com query string atualizada para
  filtros/visões (a URL é o estado); ações de escrita via server actions
  (`updateDemandaStatus`, `router.refresh()` depois).
- **Otidimismo**: estado local para resposta instantânea; o servidor reconcilia
  com `key` derivada dos dados.
- **Nunca** construir URL de busca, filtro ou query sem validação zod — input
  da URL é não confiável.
- RLS é a fronteira real de autorização; o layout apenas esconde menus por
  papel (UX-only).

---

## 6. Copywriting

- Português brasileiro, sem jargão em inglês na interface.
- Sentence case: "Nova demanda", "Marcar como concluída", não "Nova Demanda".
- Frases completas em estados vazios/erro, com ação sugerida:
  "Nenhuma demanda cadastrada ainda. Quando alguém criar uma demanda, ela vai
  aparecer aqui." + CTA.
- Confirmações de ação destrutiva só quando a ação existe (delete ainda não
  existe no escopo atual).

---

## 7. Verificação obrigatória

Antes de terminar qualquer mudança de frontend:

```bash
npm run lint        # eslint — inclui regras react-hooks
npx tsc --noEmit    # typecheck (TypeScript 7, eslint não cobre tipos)
npm run test        # vitest — 108 testes atuais
npm run build       # build de produção (Next.js 16)
```

- Texto nunca menor que 16px; alvos principais nunca menores que 56px.
- Todo ícone-botão tem rótulo acessível; todo estado tem indicador não-cromático.
- Preferências persistidas usam `useStoredPreference`, nunca efeitos.
