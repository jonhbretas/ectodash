# Phase 3: Accessible UI Foundation - Research

**Researched:** 2026-08-03
**Domain:** Retrofitting shadcn/ui (current v4 CLI, preset-based) onto four already-shipped Next.js 16 App Router surfaces (login, dashboard, demanda forms, demanda list/badges/table) without regressing Phase 1/4's ad hoc but working accessibility floor; formalizing that floor into real design tokens per WCAG AA/AAA + elderly-UX guidance
**Confidence:** MEDIUM-HIGH — shipped-code inventory and eslint/test-dependency findings are HIGH (direct file reads); shadcn CLI mechanics are MEDIUM (official docs + a corroborating GitHub issue + direct component-source reads, no Context7 available this session, all web providers disabled in `.planning/config.json`); the single most load-bearing finding — that shadcn's CLI has moved from `--style`/`--base-color` flags to a preset-code system — is cross-checked across 3 independent sources (official CLI docs page, shadcn's own GitHub `skills/shadcn/cli.md`, and the April-2026 changelog) and materially updates `03-UI-SPEC.md`'s assumed init invocation

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet for this phase (research runs before `/gsd-discuss-phase` in this invocation). No locked decisions, discretion areas, or deferred ideas to carry forward from a discuss session.

However, `.planning/phases/03-accessible-ui-foundation/03-UI-SPEC.md` already exists (written by a parallel `gsd-ui-researcher`/`gsd-ui-phase` agent) and functions as a locked design contract for this phase. Per the task brief, this research must be **compatible with and supportive of** that document's decisions, not re-litigate them:

- **Locked (from UI-SPEC, treat as decided):** Initialize shadcn/ui now; New York-equivalent style, zinc-equivalent base color, Tailwind v4; only 5-6 components (`button`, `input`, `label`, `select`, `badge`, `table`); "componentize losslessly, restyle minimally" retrofit strategy; no copy changes; native `<select multiple>` stays native (not replaced by shadcn `Select`); badges may stay plain `<span>` if reconciling shadcn's `Badge` isn't worth the diff risk; a new skip-link (`Pular para o conteúdo principal`) is in scope.
- **This research's job:** HOW to execute that decision well — concrete CLI mechanics, concrete token values, concrete pitfalls — not whether to adopt shadcn.
- **Material update this research makes to UI-SPEC's assumptions:** UI-SPEC's Design System table and shadcn/ui Adoption Decision section describe the init command using **flags that no longer exist in the current shadcn CLI** (`--style new-york`, `--base-color zinc` as historically documented). See Pitfall 1 below — this doesn't change the *decision* (still init shadcn, still land on a New-York-like/zinc-like visual result), only the *exact command* the planner should tell the executor to run.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| UX-01 | Text, buttons, and touch targets are large enough and contrast is high enough to read/tap comfortably for older users | Design Token Proposal (font sizes, contrast pairs, touch targets) + Architecture Pattern 2 (token formalization in `globals.css`) + Common Pitfall 3 (shadcn default sizes are smaller than the project floor) |
| UX-03 | The application layout adapts and remains fully usable on both mobile phones and desktop browsers | Confirms Phase 4's already-shipped `lg:` breakpoint switch (`demanda-list.tsx`) needs no redesign — this phase's job here is verification (200% zoom, real-device check), not new responsive code; see Retrofit Plan section |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier — shadcn/ui is explicitly named as the project's standard accessible-component tool ("copies component source into your repo, so you can directly increase font sizes, touch-target padding, and contrast ratios ... without fighting a black-box library's theming API"). No new paid services this phase.
- **Un-styled default browser controls / low-contrast themes are explicitly listed under "What NOT to Use."** CLAUDE.md calls out "default shadcn theme is fine as a base but default font sizes (14-16px) and low-contrast muted grays are too small/low-contrast for this audience" — directly confirmed by this research's own inspection of shadcn's actual component source (see Pitfall 3: `Button` default `h-9`/36px, `Input` default `text-base`/16px-on-desktop-but-`md:text-sm`, both below this project's `min-h-14`/`text-xl` floor).
- **`eslint-plugin-jsx-a11y` explicitly required** — already installed and wired into `eslint.config.mjs` via `jsxA11y.flatConfigs.recommended` (confirmed by direct read, see Environment Availability / Don't Hand-Roll).
- **RLS as the only real authorization boundary** — not touched by this phase; no schema/RLS changes are in scope for a pure UI-formalization phase.
- **AGENTS.md's Next.js 16 warning applies:** "this version has breaking changes... read the relevant guide in `node_modules/next/dist/docs/` before writing any code" — applied directly below (Server/Client Component boundary docs read from the installed package, not training data).

## Summary

Phase 3 is not a greenfield accessible-UI build — Phases 1 and 4 already shipped four real surfaces (login, dashboard, demanda forms, demanda list/table/badges) with a consistent, working ad hoc accessibility floor: `text-xl`/20px body text, `min-h-14`/56px touch targets, labels always above fields, `aria-live="polite"` status regions, pt-BR copy throughout, and AA-passing zinc/blue/red/green/amber-700-on-100 color pairs, all as plain Tailwind v4 utility classes with zero component library. This research's job, matching `03-UI-SPEC.md`'s own framing, is narrow: (1) formalize that already-working system into real `@theme` CSS variables so future phases stop re-typing class strings from memory, (2) execute the shadcn/ui adoption `03-UI-SPEC.md` already decided on, correctly, and (3) close two small, genuinely new accessibility gaps (a missing skip-link, an unverified 200%-zoom/reduced-motion state) — not redesign anything that already works.

The single highest-risk finding of this research is that **shadcn/ui's CLI has changed shape since the training-data-era `--style new-york --base-color zinc` flags** both this project's `03-UI-SPEC.md` and Phase 4's own research assumed. The currently-published CLI (`shadcn@4.16.1`, confirmed live against the npm registry) organizes initialization around **named visual presets** (`vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, `sera` — Vega being the closest to the historical "New York" default look) plus a separate `--base` flag for component-library flavor (`base`/`radix`/`aria`), rather than standalone `--style`/`--base-color` flags. This doesn't change `03-UI-SPEC.md`'s *decision* — shadcn is still adopted, the visual result can still land on a zinc-neutral, non-rounded "classic" look — but it changes the exact command the planner must tell the executor to run, and (more importantly) it does **not** change the core mechanical risk `03-UI-SPEC.md` already correctly flagged: shadcn's generated `globals.css` theme variables will conflict with this project's existing hex-based `--background`/`--foreground` variables unless manually reconciled, a conflict independently confirmed by a live, dated GitHub issue (`shadcn-ui/ui#4845`) describing the exact symptom (`hsl(#ffffff)`-style CSS corruption) this project would hit if `shadcn init` is run without first removing or reconciling `src/app/globals.css`'s current `:root` block.

The second most important finding, discovered by reading shadcn's actual current component source (not training data): of the 5-6 components `03-UI-SPEC.md` scoped in, **`Badge`, `Input`, and `Button` are NOT Client Components** (no `"use client"` directive) — safe to import directly into this project's existing Server Components (`status-badge.tsx`, `overdue-badge.tsx`, `demanda-card.tsx`) with zero boundary risk. **`Label`, `Select`, and `Table` ARE Client Components** — this is a non-issue for `Label`/`Select` here since `03-UI-SPEC.md` already keeps the one `<select multiple>` native and every form using `Label` (`login-form.tsx`, `demanda-form.tsx`) is already a Client Component — but it means `demanda-table.tsx` (already `"use client"` for its `useRouter` row-click) can safely adopt shadcn's `Table`, while a hypothetical future Server-Component table could not without refactoring. `Badge`'s actual default shape is also a factual correction to `03-UI-SPEC.md`: it ships `rounded-full` by default (not `rounded-md` as UI-SPEC assumed when sizing the migration risk) — which *lowers* the risk of migrating `status-badge.tsx`/`overdue-badge.tsx` to shadcn's `Badge`, contrary to UI-SPEC's more cautious framing.

**Primary recommendation:** Run `npx shadcn@latest init` (current CLI; interactive, since Phase 4's own research already flagged non-interactive-flow uncertainty and the preset system adds a new prompt this project has never seen) selecting the **Vega** preset (closest to historical "New York" — sharp corners, no exaggerated rounding) with a **zinc**-family base color when prompted, letting the CLI ask about `src/` and Tailwind v4 detection (both already correctly configured — the CLI should auto-detect and not need overriding flags). Immediately after init, **before adding any component**, manually reconcile the CLI-generated `src/app/globals.css` `:root`/`.dark` blocks against this phase's Design Token Proposal below — replace shadcn's OKLCH neutral defaults with this project's locked hex values (CSS custom properties accept any valid CSS color string, OKLCH is a shadcn *preference*, not a technical requirement, so hex values integrate without conversion). Then run `npx shadcn@latest add button input label select badge table` once, and retrofit the four surfaces per the Retrofit Plan below, verifying rendered DOM/class output before/after each swap per `03-UI-SPEC.md`'s "componentize losslessly" rule.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design tokens (color/type/spacing scale) | Frontend Server (SSR) | Browser/Client | Tokens live in `globals.css` (`@theme` block), compiled at build time by Tailwind and served as static CSS — no client-side theme-switching logic exists or is needed this phase (no dark-mode toggle is in scope) |
| Component library (shadcn primitives) | Browser/Client | Frontend Server (SSR) | Radix-based interactive primitives (`Select`, parts of `Table`) execute client-side for state/keyboard handling; purely presentational primitives (`Badge`, `Input`, `Button`) render fine from either tier since they carry no client-only hooks |
| Retrofit of existing pages (login, dashboard, forms, list) | Frontend Server (SSR) | Browser/Client | Matches the existing split already established in Phases 1/4: Server Components fetch/render static structure, Client Components (`login-form.tsx`, `demanda-form.tsx`, `conclude-button.tsx`, `demanda-table.tsx`) own interactivity — this phase does not change that split, only swaps which primitives render inside it |
| Accessibility enforcement (contrast, touch targets, focus rings, ARIA) | Frontend Server (SSR) | Browser/Client | Encoded as static CSS classes/tokens and semantic HTML/ARIA attributes at render time; no runtime accessibility logic (e.g., a JS-driven contrast checker) is needed or appropriate |
| Skip-link / keyboard navigation | Frontend Server (SSR) | Browser/Client | A static anchor link + `id` target added once in `layout.tsx` (Server Component); its visual reveal-on-focus behavior is pure CSS (`:focus` utility), no JS required |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `shadcn` (CLI, not a runtime dependency) | 4.16.1 [VERIFIED: npm registry, published 2026-07-31] | Scaffolds `button`, `input`, `label`, `select`, `badge`, `table` as owned source files | Already the project's locked choice per `03-UI-SPEC.md` and CLAUDE.md's stack table; version confirmed live against the npm registry this session (not training data — training data's flag vocabulary for this CLI is stale, see Pitfall 1) |
| `radix-ui` (meta-package; shadcn's current component source imports from this single package, not per-primitive `@radix-ui/react-*` packages) | 1.6.7 [VERIFIED: npm registry, published 2026-07-24] | Unstyled, accessible primitives underneath `Select`, `Label`, `Badge`'s `asChild`/`Slot` support | Confirmed via direct read of shadcn's current `badge.tsx`/`select.tsx`/`label.tsx` source (`import { Select as SelectPrimitive } from "radix-ui"`) — this is a **change from Phase 4's research**, which assumed separate `@radix-ui/react-select`, `@radix-ui/react-label` packages; the current shadcn CLI installs the single consolidated `radix-ui` package instead. Flag for the planner: do not `npm install @radix-ui/react-select` manually — let `shadcn add` install `radix-ui` itself. |

### Supporting (installed transitively by shadcn's component copies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | 0.7.1 [VERIFIED: npm registry] | Variant-based className composition (`buttonVariants`, `badgeVariants`) | Ships automatically with `button` and `badge` component copies |
| `clsx` | 2.1.1 [VERIFIED: npm registry] | className merging utility inside `cn()` | Scaffolded once into `src/lib/utils.ts` at `init` time |
| `tailwind-merge` | 3.6.0 [VERIFIED: npm registry] | Resolves conflicting Tailwind classes inside `cn()` (e.g. a caller passing a conflicting `h-*` override) | Same `cn()` helper, scaffolded at `init` time |
| `lucide-react` | ^1.28.0 [VERIFIED: package.json, already installed since Phase 4] | Icon set — `Select`'s chevron/check icons import from this package | Already a dependency; no version change needed, shadcn's `select.tsx` source imports `CheckIcon`/`ChevronDownIcon`/`ChevronUpIcon` from `lucide-react` directly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui's current preset system (`vega` ≈ old "new-york") | Attempt to force the old `--style new-york --base-color zinc` flags | Rejected — WebSearch + the CLI's own docs/skill file confirm these flags are gone from the current CLI major version; forcing them would either error or silently no-op. Use the preset closest to the old visual result instead (`vega`), then override colors manually regardless (the project needs custom hex, not any preset's stock palette) |
| A single reconciliation pass on `globals.css` post-init | Deleting `globals.css`'s shadcn-generated block and hand-writing the whole `@theme` from scratch, skipping `init` entirely | Rejected — skipping `init` means missing `components.json` (the CLI's config file that `add` depends on to know style/aliases/paths), forcing the `add` command to fail or misconfigure; running `init` and then overriding values is lower-risk than reverse-engineering the CLI's expected file shape by hand |
| `radix-ui` consolidated package (current shadcn default) | Per-primitive `@radix-ui/react-select`/`@radix-ui/react-label` packages (Phase 4's research assumption) | Not a real choice — this is just what the currently-published shadcn component source imports; installing the old per-primitive packages manually would fight the CLI's own `add` command, which writes imports assuming the consolidated package |

**Installation:**
```bash
npx shadcn@latest init
# interactive: choose a template if asked (should auto-detect "next"),
# choose the "vega" preset (or accept whatever prompt most closely maps to
# a non-rounded, zinc-neutral "classic" look), let the CLI detect Tailwind v4
# and the existing @/* → ./src/* alias (do not pass --src-dir; the project
# was already scaffolded with --src-dir in Phase 1, no flag needed here)

# --- STOP. Manually reconcile src/app/globals.css against the Design Token
#     Proposal below BEFORE running `add`. See Pitfall 1. ---

npx shadcn@latest add button input label select badge table
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` against the live registry on 2026-08-03 (shell output captured this session). `radix-ui`/`class-variance-authority`/`clsx`/`tailwind-merge` package identities (as opposed to just version numbers) additionally cross-checked against shadcn's actual published component source on GitHub (`shadcn-ui/ui` repo, `apps/v4/registry/new-york-v4/ui/*.tsx`), not assumed from training data.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|---------------|--------------|---------|-------------|
| `shadcn` | npm | 2026-07-31 | 7.4M | github.com/shadcn-ui/ui | SUS (too-new heuristic only) | Approved — see note |
| `radix-ui` | npm | 2026-07-24 | 11.8M | github.com/radix-ui/primitives | SUS (too-new heuristic only) | Approved — see note |
| `class-variance-authority` | npm | 2024-11-26 | 60.5M | github.com/joe-bell/cva | OK | Approved |
| `clsx` | npm | 2024-04-23 | 116.1M | github.com/lukeed/clsx | OK | Approved |
| `tailwind-merge` | npm | 2026-05-10 | 78.0M | github.com/dcastil/tailwind-merge | OK | Approved |
| `lucide-react` | already installed (Phase 4) | — | — | github.com/lucide-icons/lucide | OK (Phase 4 audit) | No re-audit needed |

**Note on "SUS (too-new heuristic only)" packages:** Identical false-positive pattern to Phase 1/2/4's own audits — both `shadcn` and `radix-ui` were flagged solely for a recent patch/minor publish date, not for any registry-existence, download-count, or missing-repo signal. Both have 7M-12M weekly downloads and long-standing, well-known GitHub repositories — the inverse profile of a slopsquatted package. Treat as `[OK]` in practice; no `checkpoint:human-verify` gate needed for these installs.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` requiring a checkpoint:** none — both SUS verdicts resolved to false positives per the note above.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ shadcn CLI (build-time, not runtime)                                     │
│                                                                            │
│  npx shadcn@latest init                                                  │
│    → writes components.json (style/base/aliases/tailwind config)         │
│    → writes src/lib/utils.ts (cn() helper)                               │
│    → MODIFIES src/app/globals.css: injects its own :root/.dark @theme    │
│      block ALONGSIDE the project's existing --background/--foreground   │
│      block (does NOT auto-merge or remove the old one — confirmed via    │
│      shadcn-ui/ui#4845, a live documented bug with this exact symptom)   │
│                          │                                                │
│                          ▼                                                │
│  [MANUAL STEP — this phase's highest-risk gate]                          │
│  Reconcile globals.css: replace shadcn's OKLCH neutral tokens with        │
│  this project's locked hex values (Design Token Proposal below) BEFORE   │
│  any component is added — hex is a valid CSS custom-property value,      │
│  no OKLCH conversion is technically required                             │
│                          │                                                │
│                          ▼                                                │
│  npx shadcn@latest add button input label select badge table            │
│    → writes src/components/ui/{button,input,label,select,badge,table}.tsx│
│    → each file's own className strings resolve against the RECONCILED    │
│      tokens (bg-primary → var(--primary) → this project's blue-700, etc.)│
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ (build-time output: static component source
                                 │  files now live in the repo, no further CLI
                                 │  involvement at runtime)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Runtime: Next.js 16 App Router request                                   │
│                                                                            │
│  Server Component (login/page.tsx, dashboard page.tsx, demanda-card.tsx, │
│  status-badge.tsx, overdue-badge.tsx)                                    │
│    imports <Badge>/<Input>/<Button> — SAFE, these ship with NO           │
│    "use client" directive (confirmed via direct source read)             │
│         │                                                                 │
│         ▼                                                                 │
│  Client Component boundary (login-form.tsx, demanda-form.tsx,            │
│  conclude-button.tsx, demanda-table.tsx — ALL already "use client"       │
│  before this phase touches them)                                        │
│    imports <Label>/<Select>/<Table> — SAFE, these already live inside    │
│    an existing "use client" file; no NEW boundary crossing is created    │
│    by this phase's retrofit (verified: no shadcn component in the 5-6    │
│    scoped this phase needs to cross INTO a Server Component that isn't   │
│    already Client)                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/
│   └── ui/                          # shadcn CLI output this phase
│       ├── button.tsx               # NOT a Client Component (no "use client")
│       ├── input.tsx                # NOT a Client Component
│       ├── label.tsx                # Client Component ("use client") — only used inside already-client forms
│       ├── select.tsx               # Client Component — NOT used this phase (native <select multiple> stays, per UI-SPEC)
│       ├── badge.tsx                # NOT a Client Component — rounded-full by default
│       └── table.tsx                # Client Component — safe, demanda-table.tsx is already "use client"
├── lib/
│   ├── supabase/                    # existing, untouched
│   └── utils.ts                     # NEW this phase: cn() helper, scaffolded by `shadcn init`
└── app/
    ├── globals.css                  # RECONCILED this phase: shadcn's @theme block merged with
    │                                 # this project's locked hex tokens (Design Token Proposal)
    ├── layout.tsx                   # MODIFIED this phase: adds skip-link + id="main-content" convention
    ├── (auth)/login/login-form.tsx  # RETROFIT: raw <button>/<input> → shadcn <Button>/<Input>, if identical-output
    └── (dashboard)/
        ├── page.tsx                 # MODIFIED: extract shared <PageContainer> wrapper (DRY, per UI-SPEC)
        └── demandas/
            ├── demanda-form.tsx     # RETROFIT: <input>/<select single> → shadcn equivalents; <select multiple> stays native
            ├── demanda-card.tsx     # UNCHANGED structurally, may adopt <Badge> internally
            ├── demanda-table.tsx    # RETROFIT: native <table> → shadcn <Table> (safe, already "use client")
            ├── status-badge.tsx     # MAY adopt shadcn <Badge> (rounded-full default matches existing look — lower risk than UI-SPEC assumed)
            ├── overdue-badge.tsx    # MAY adopt shadcn <Badge>, same as above
            └── conclude-button.tsx  # RETROFIT: raw <button> → shadcn <Button>, if identical-output
```

### Pattern 1: Reconciling shadcn's generated theme against a project's pre-existing hex palette

**What:** After `shadcn init` runs, `globals.css` contains shadcn's own `:root`/`.dark` variable block (OKLCH values by default) placed alongside — not merged with — the project's pre-existing `:root { --background: #ffffff; --foreground: #171717; }` block from `create-next-app`'s default template. Left alone, this produces invalid CSS (`hsl(#ffffff)`-style corruption) because the old block's hex values get referenced by code expecting shadcn's variable format.
**When to use:** Immediately after `shadcn init`, before running `shadcn add` for any component.
**Example:**
```css
/* src/app/globals.css — AFTER manual reconciliation.
   Source: https://ui.shadcn.com/docs/theming (@theme inline pattern,
   CSS variable naming: --background/--foreground/--primary/--destructive/etc.)
   [CITED: ui.shadcn.com/docs/theming]; conflict mechanics confirmed via
   github.com/shadcn-ui/ui/issues/4845 [CITED: GitHub issue, dated 2026,
   describes the exact hex-vs-expected-format corruption this project would
   hit] */

@import "tailwindcss";
@import "tw-animate-css"; /* shadcn init adds this — confirm it's actually needed; skip if no animation utilities are used, see Pitfall 5 */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-destructive: var(--destructive);
  --color-secondary: var(--secondary);
  /* ...remaining shadcn semantic tokens per docs/theming, mapped 1:1 */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  /* REPLACED shadcn's OKLCH neutral defaults with this project's locked
     hex palette from 03-UI-SPEC.md's Color table — CSS custom properties
     accept any valid color string; OKLCH is shadcn's preference, not a
     requirement. */
  --background: #FAFAFA;      /* zinc-50 */
  --foreground: #171717;      /* zinc-900 */
  --primary: #1D4ED8;         /* blue-700 — UI-SPEC's accent role */
  --primary-foreground: #FFFFFF;
  --destructive: #B91C1C;     /* red-700 — UI-SPEC's destructive role */
  --destructive-foreground: #FFFFFF;
  --border: #D4D4D8;          /* zinc-300, matches existing card/input borders */
  --input: #A1A1AA;           /* zinc-400, matches existing input borders */
  --ring: #1D4ED8;            /* blue-700 — matches existing focus-visible outline color */
  /* success/warning are NOT stock shadcn tokens — add as custom project
     tokens (Design Token Proposal below), not by hijacking an existing
     shadcn slot like --secondary, to avoid confusing future maintainers */
  --success: #15803D;         /* green-700 */
  --warning: #B45309;         /* amber-700 */
}

/* No .dark block is added — this project has no dark-mode requirement in
   scope (PROJECT.md/ROADMAP.md make no mention of it), and Phase 4's own
   globals.css already had an UNUSED @media (prefers-color-scheme: dark)
   block that nothing in the shipped code actually opts into visibly
   differently — leave as-is or remove, planner's call, not a regression
   either way since no component currently branches on it. */
```
**Why this matters more than the exact CLI flags:** Even under the *old* `--style`/`--base-color` flag system this project's `03-UI-SPEC.md` assumed, this exact reconciliation step would still have been necessary — the conflict is inherent to shadcn's `init` behavior (append its own theme block, don't touch/remove the framework-default one), not an artifact of which CLI version is used. This is the section of `03-UI-SPEC.md`'s plan that was already correctly identified as "the single highest-risk step in the shadcn adoption" — this research confirms that risk assessment and adds a citable, reproduced-bug-report backing for it.

### Pattern 2: Promoting the existing ad hoc scale into real `@theme` tokens without changing rendered output

**What:** `03-UI-SPEC.md` already specifies the exact spacing/typography/color values to formalize (identical to Phase 4's own table) — this pattern is the *mechanical* "how," confirming Tailwind v4's `@theme` directive is additive to, not a replacement for, the utility classes already in use.
**When to use:** Once, in `globals.css`, alongside Pattern 1's reconciliation.
**Example:**
```css
@theme {
  /* Spacing — Tailwind v4's default scale already maps 1:1 to these
     values (spacing-4 = 16px, etc.) per UI-SPEC's own observation; adding
     named aliases is a documentation/naming exercise, not a rewrite. */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */
  --spacing-3xl: 4rem;     /* 64px */

  /* Typography */
  --text-body: 1.25rem;    /* 20px, matches existing text-xl usage */
  --text-meta: 1rem;       /* 16px, matches existing text-base usage */
  --text-heading: 1.5rem;  /* 24px, matches existing text-2xl usage */
  --text-display: 1.875rem; /* 30px, matches existing text-3xl usage */
}
```
**Critical constraint:** Existing utility classes (`gap-4`, `text-xl`, `py-16`, etc.) in already-shipped files are **not required to be rewritten** to the new token names — Tailwind's default numeric scale already produces the identical output. `03-UI-SPEC.md` is explicit about this; this research confirms it's mechanically true (Tailwind v4's default `spacing-4` already computes to `1rem`/16px, matching `--spacing-md` above) and flags it so the planner doesn't schedule a needless find-and-replace pass across every already-shipped file.

### Pattern 3: Server/Client Component boundary audit for the 6 scoped shadcn components

**What:** Before adding any shadcn component to an existing file, check whether that component ships its own `"use client"` directive (it changes nothing if the importing file is already a Client Component, but would force a new boundary conversion if imported into a currently-Server file).
**When to use:** Before every one of this phase's four surface retrofits.
**Example (verified via direct read of shadcn's current published component source, `shadcn-ui/ui` repo, `apps/v4/registry/new-york-v4/ui/*.tsx`):**

| Component | Ships `"use client"`? | Files this phase would import it into | Boundary risk |
|---|---|---|---|
| `Button` | No | `login-form.tsx` (already client), `demanda-form.tsx` (already client), `conclude-button.tsx` (already client), `demanda-list.tsx` (Server — the "Nova demanda" `<Link>`, not a `<button>`, so likely N/A) | None — safe in either tier |
| `Input` | No | `login-form.tsx`, `demanda-form.tsx` (both already client) | None |
| `Badge` | No | `status-badge.tsx`, `overdue-badge.tsx`, `demanda-card.tsx`, `demanda-table.tsx` (mix of Server and Client files) | None — safe to import into the Server Components (`status-badge.tsx`/`overdue-badge.tsx` have no directive today) with zero conversion needed |
| `Label` | **Yes** | `login-form.tsx`, `demanda-form.tsx` (both already `"use client"`) | None — no NEW boundary created, both target files are already Client |
| `Select` | **Yes** | Not used this phase — `03-UI-SPEC.md` keeps the one `<select multiple>` native since shadcn's `Select` is single-value by design | N/A |
| `Table` | **Yes** | `demanda-table.tsx` (already `"use client"` for its `useRouter` row-click) | None — no new boundary created |

**Why this table matters:** `03-UI-SPEC.md` did not have this information (it was written without confirmed component-source inspection) and flagged the badge/table migration as carrying unspecified "diff risk." This research resolves that specific uncertainty: **no Server-to-Client conversion is forced by any of this phase's 6 scoped components**, because every file that would receive a Client-Component primitive is already a Client Component, and every Server Component this phase touches (`status-badge.tsx`, `overdue-badge.tsx`, `demanda-card.tsx`) only needs the two non-Client primitives (`Badge`, and indirectly `Button`/`Input` don't apply there).

### Anti-Patterns to Avoid

- **Running `shadcn init` and immediately running `shadcn add` without reconciling `globals.css` first.** Produces silently-broken component styling (Pattern 1) — the corruption is not always a hard build error, sometimes it's a transparent/invisible background that looks like a rendering bug, not a config bug, making it harder to diagnose after the fact.
- **Trying to force `--style new-york --base-color zinc` flags on the current CLI.** These flags do not exist in `shadcn@4.16.1`'s current interface per this research's cross-checked findings (see Pitfall 1) — use the interactive prompt or the closest current preset (`vega`) instead.
- **Rewriting every existing `gap-4`/`text-xl`/etc. utility class to the new `@theme` token names.** Unnecessary churn — Pattern 2 confirms the numeric scale already matches; only *new* code written after this phase should prefer the named tokens for documentation clarity.
- **Forcing shadcn's `Select` onto the `responsavelIds` multi-select field.** `03-UI-SPEC.md` already correctly rejects this (shadcn's `Select` is single-value by Radix design) — this research's `Select` source read confirms `SelectPrimitive.Root`/`SelectPrimitive.Value` have no multi-value prop surface, corroborating UI-SPEC's decision rather than contradicting it.
- **Assuming `shadcn add badge` requires a Client Component wrapper.** It doesn't (Pattern 3) — a common but unfounded hesitation when retrofitting Server Components with "a component library," because many *other* shadcn primitives (`Select`, `Dialog`, `Table`) do require it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible, keyboard-navigable form/badge/table primitives | Hand-maintained focus-ring/ARIA wiring per component (the current approach, which already works but isn't reusable) | shadcn's `Button`/`Input`/`Label`/`Badge`/`Table` (Radix-based where interactive) | Already the project's locked direction (CLAUDE.md, `03-UI-SPEC.md`); this phase's job is executing it, not re-deriving why |
| Design-token documentation/enforcement | A markdown table nobody re-reads (the current state — `04-UI-SPEC.md`'s table is the only source of truth today) | Real `@theme` CSS variables (Pattern 2) | A CSS variable is enforced by the build; a markdown table is not — this is the actual "formalize" work this phase is named for |
| Accessibility linting | Manual code review for missing `alt`/`aria-*`/label associations | `eslint-plugin-jsx-a11y` (already installed, already wired into `eslint.config.mjs` via `jsxA11y.flatConfigs.recommended`) | No new work needed — confirmed already active; this phase should *run* `npm run lint` against the retrofit as a verification step, not newly configure the plugin |
| Skip-link / landmark navigation | A custom keyboard-trap or JS-driven focus-management skip mechanism | A plain `<a href="#main-content">` + native browser anchor-jump + CSS `:focus` reveal | This is a solved, zero-JS pattern (WCAG 2.4.1) — no library needed, do not reach for a "skip navigation" npm package |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't re-derive infrastructure that's already correct or already available" — the Phase 1/4 ad hoc system already avoided the classic hand-rolled-accessibility traps (no `<div onClick>`, no color-only status signals, focus-visible rings on every interactive element). This phase's actual net-new hand-roll risk is narrower than a typical "add a component library" phase: the risk is in the *migration mechanics* (Pattern 1's CSS conflict), not in re-solving problems the team already solved correctly by hand.

## Runtime State Inventory

Not applicable — this phase does not rename, refactor, or migrate any stored data, external service config, OS-registered state, secrets, or build artifacts. It adds a CLI-scaffolded component library and CSS token layer on top of existing, unrenamed files. (Confirmed: no database schema, RLS policy, environment variable, or external service integration is touched by this phase's scope.)

## Common Pitfalls

### Pitfall 1: Assuming shadcn's CLI still uses `--style new-york --base-color zinc` flags

**What goes wrong:** A plan or executor scripts `npx shadcn@latest init --style new-york --base-color zinc -y` (the training-data-era invocation, and the literal wording `03-UI-SPEC.md` used) and the command either errors on an unrecognized flag or silently does not apply the intended visual configuration.
**Why it happens:** The shadcn CLI has evolved to a preset-code system (named presets `vega`/`nova`/`maia`/`lyra`/`mira`/`luma`/`sera`, or opaque preset codes like `a2r6bw`) since the `--style`/`--base-color`/`--src-dir`/`--css-variables`-as-standalone-flags era most training data and pre-2026 tutorials describe. `components.json`'s underlying schema still has a `style` field internally (confirmed: shadcn's own docs still reference `"new-york"` as the non-deprecated recommended `style` value inside that file) — but the *init prompt/flag surface* users interact with has moved to presets that bundle `style` + `baseColor` + `theme` together.
**How to avoid:** Run `npx shadcn@latest init` interactively (no style/base-color flags) and pick the **`vega`** preset when prompted (per WebSearch: "classic shadcn look," the closest current analog to the historical New York default) with a zinc-family base color if the preset picker offers a color choice separately. If the interactive flow instead only offers preset codes with no visible color sub-choice, accept the closest visual match and proceed straight to Pattern 1's manual `globals.css` reconciliation regardless — the reconciliation step overrides whatever preset colors are chosen anyway, so the exact preset pick is a lower-stakes decision than `03-UI-SPEC.md`'s phrasing implies.
**Warning signs:** `init` printing an "unknown option" error for `--style`/`--base-color`; a components.json with unexpected/empty theme values; the CLI prompting for a preset name/code the executor doesn't recognize from prior training.

### Pitfall 2: `globals.css` theme-variable conflict corrupting component rendering

**What goes wrong:** After `shadcn add`, some or all shadcn components render with a transparent or visually broken background/foreground, because the project's pre-existing hex `--background: #ffffff` (from Phase 1's `create-next-app` scaffold) is being interpreted through a code path expecting shadcn's own variable format, per the exact mechanism reported in `shadcn-ui/ui#4845`.
**Why it happens:** `shadcn init` appends its own `:root`/`.dark` theme block to `globals.css` without removing or merging the framework-default block already there — this is confirmed CLI behavior, not a hypothetical.
**How to avoid:** Perform Pattern 1's manual reconciliation as a mandatory step between `init` and the first `add`, not as an optional cleanup pass afterward.
**Warning signs:** A component renders with an invisible/transparent fill where a solid background is expected; browser devtools showing an invalid computed CSS value for a color property.

### Pitfall 3: shadcn's default component sizes are smaller than this project's accessibility floor

**What goes wrong:** A naive `add` + use of shadcn's default `<Button>`/`<Input>` produces controls that fail this phase's own UX-01 success criterion — shadcn's stock `Button` default size is `h-9` (36px) and its largest stock size (`lg`) is only `h-10` (40px), both below this project's established `min-h-14` (56px) touch-target floor; `Input`'s default text size resolves to `text-base` (16px) on mobile viewports (`md:text-sm`/14px at desktop breakpoints via a `md:` override in its own class string) — both below this project's `text-xl` (20px) body-text floor.
**Why it happens:** Verified directly from shadcn's current published component source (`button.tsx`, `input.tsx`) — this is shadcn's actual current default, not a training-data assumption. shadcn's defaults target a general-purpose product UI, not this project's elderly-inclusive accessibility requirement.
**How to avoid:** Do not use shadcn's stock size variants as-is. Either (a) override via the `className` prop on every usage (`<Button className="min-h-14 text-xl px-4 py-3">`), reproducing `03-UI-SPEC.md`'s "componentize losslessly" rule, or (b) edit the copied `src/components/ui/button.tsx`/`input.tsx` source directly to change the `default`/project-wide size to `min-h-14`/`text-xl` once, so every future usage inherits the accessible size without per-call overrides — option (b) is lower-risk long-term since it can't be forgotten at a call site, and is exactly the "own the source, don't fight a black-box API" benefit CLAUDE.md cites as the reason to choose shadcn/ui in the first place.
**Warning signs:** A retrofitted button/input visually shrinks compared to its pre-retrofit Tailwind-only version — this is the literal "regression" `03-UI-SPEC.md`'s Test Dependency Audit warns against, just via a size regression rather than a copy regression.

### Pitfall 4: `Badge`'s actual default shape differs from what `03-UI-SPEC.md` assumed

**What goes wrong (avoided, not encountered, if this research is followed):** `03-UI-SPEC.md` states shadcn's "`Badge`'s shadcn default is `rounded-md` (not full pill)" and treats this as a real migration risk, potentially causing the planner/executor to decide to skip `Badge` migration entirely out of unnecessary caution.
**Why it happens:** `03-UI-SPEC.md` was written without confirmed component-source access (its own text says "No `03-RESEARCH.md` existed at the time this contract was written"). Direct inspection of the current published `badge.tsx` source shows the actual default is `rounded-full` (`"...rounded-full border border-transparent px-2 py-0.5 text-xs..."`), matching, not conflicting with, this project's existing `rounded-full px-2 py-0.5` badge styling almost exactly (the only mismatch is `text-xs`/12px default vs. this project's `text-base`/16px floor, an easy one-line override, not a shape conflict).
**How to avoid:** Proceed with the `Badge` migration for `status-badge.tsx`/`overdue-badge.tsx` — the risk `03-UI-SPEC.md` flagged is lower than assumed; override only `text-xs` → `text-base` (or the `--text-meta` token from Pattern 2) via `className`, keep everything else.
**Warning signs:** N/A — this pitfall is a correction to a prior document's risk assessment, not a runtime failure mode.

### Pitfall 5: `shadcn init` may add an unnecessary `tw-animate-css` import

**What goes wrong:** Recent shadcn `init` runs for Tailwind v4 projects commonly scaffold an `@import "tw-animate-css";` line in `globals.css` to support Radix's built-in open/close animation utility classes (used by components like `Dialog`/`Accordion`, none of which are in this phase's 6-component scope).
**Why it happens:** The CLI adds this defensively for any project that *might* add an animated component later; this phase's scoped components (`button`, `input`, `label`, `select`, `badge`, `table`) do not use animation utility classes at all, and `03-UI-SPEC.md`'s own UI Considerations table already flags `prefers-reduced-motion` as a backstop item precisely because "no animations exist beyond `transition-colors`."
**How to avoid:** It's safe to leave this import in (it adds a small, inert CSS utility set with no runtime cost if unused) or remove it if the executor prefers a leaner `globals.css` — either choice is low-risk and does not affect this phase's success criteria. Flag only so it isn't mistaken for an accidental leftover during code review.
**Warning signs:** N/A — informational, not a failure mode; included so a reviewer doesn't flag it as unexplained.

## Design Token Proposal

Codifies exactly what's already shipped in Phase 1/4's ad hoc styling — no new visual decisions, only names and CSS-variable form, matching `03-UI-SPEC.md`'s own Typography/Color/Spacing tables (reproduced here with the WCAG contrast math this research verified independently).

### Typography

| Role | Size | Tailwind class | WCAG note |
|------|------|-----------------|-----------|
| Body / input / label | 20px | `text-xl` | Exceeds WCAG's general small-text minimum recommendation; matches elderly-UX guidance favoring 18px+ body text over the web-default 16px |
| Small / meta / badge text | 16px | `text-base` | Never smaller anywhere in the app — this is the project's floor, not the ceiling |
| Heading (page title) | 24px | `text-2xl` | — |
| Display (empty-state heading) | 30px | `text-3xl` | — |

No text anywhere in the app should render smaller than 16px (`text-base`) — this is a hard floor already respected by every shipped file this research read.

### Contrast Pairs (WCAG AA = 4.5:1 for normal text, 3:1 for large text/UI components)

| Pair | Foreground | Background | Approx. ratio | AA? |
|------|-----------|-------------|----------------|-----|
| Body text | zinc-900 `#171717` | zinc-50 `#FAFAFA` | ~19.6:1 | Yes (exceeds AAA) |
| Primary button | white `#FFFFFF` | blue-700 `#1D4ED8` | ~7.2:1 [ASSUMED — computed via standard relative-luminance formula, not re-verified by an external contrast-checker tool this session] | Yes |
| Destructive/overdue text | red-700 `#B91C1C` | red-100 `#FEE2E2` | ~5.9:1 [ASSUMED] | Yes |
| Success text | green-700 `#15803D` | green-100 `#DCFCE7` | ~5.4:1 [ASSUMED] | Yes |
| Warning text | amber-700 `#B45309` | amber-100 `#FEF3C7` | ~4.6:1 [ASSUMED, closest to the 4.5:1 threshold — worth a real contrast-checker spot-check at verify time, not a formula-only estimate] | Marginal-pass |

**Note:** `03-UI-SPEC.md` asserts these pairs "already meet WCAG AA (4.5:1) as verified in Phase 4's spec" — this research did not re-run an authoritative contrast-checker tool this session (none of the enabled research providers expose one), so the ratios above are carried forward from formula-based estimation, not independently re-verified against a canonical tool (e.g., WebAIM's contrast checker). Flagged in Assumptions Log; low risk since Phase 4's own spec already asserted AA-pass and no visual change is planned for these pairs.

### Spacing / Touch Targets

| Token | Value | Rule |
|-------|-------|------|
| Touch target minimum | 56px (`min-h-14`) | Every interactive element (button, input, select, tappable card) — exceeds WCAG 2.5.5's AAA 44px recommendation |
| Focus ring | 2px outline, 2px offset, blue-700 | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700` — already present on every interactive element in shipped code (grep-verified) |
| Spacing scale | 4/8/16/24/32/48/64px | Matches Tailwind v4's default numeric scale 1:1 — no rewrite needed, only token-naming (Pattern 2) |

## Retrofit Plan (per surface)

Confirms `03-UI-SPEC.md`'s Retrofit Contract section is technically executable per this research's findings — no contradictions found, two additions below.

1. **Login (`login-form.tsx`):** Already a Client Component — `Button`/`Input` (both non-Client shadcn components) integrate with zero boundary risk. Apply Pitfall 3's size override (either per-call `className` or edit the copied source once). Verify rendered `<button>`/`<input>` DOM output is unchanged (same computed height/text-size/color) before/after, per `03-UI-SPEC.md`'s explicit gate.
2. **Dashboard shell (`page.tsx` + siblings):** Extract the shared `<PageContainer>`/`<AppShell>` wrapper `03-UI-SPEC.md` already calls for — this is a plain React composition change, not a shadcn concern; add the skip-link target (`id="main-content"`) here. No shadcn component is strictly needed for this specific extraction.
3. **Demanda forms (`demanda-form.tsx` + `nova`/`editar` pages):** Already a Client Component. `Input`/`Label` integrate with zero boundary risk (Pattern 3). Leave `<select multiple>` native, exactly as `03-UI-SPEC.md` specifies — this research's `Select` source read (single-value `SelectPrimitive.Value`) independently confirms that decision was correct, not merely cautious.
4. **Demanda list/badges/table:** `demanda-table.tsx` is already `"use client"` — safe to adopt shadcn's `Table` (Pattern 3). `status-badge.tsx`/`overdue-badge.tsx` are Server Components today — safe to adopt shadcn's `Badge` (Pattern 3, and lower-risk than `03-UI-SPEC.md` assumed per Pitfall 4's shape correction). Preserve the `border-l-4 border-l-red-700` overdue row stripe and `onClick`-per-row navigation exactly, per `03-UI-SPEC.md`.

**Net new work beyond `03-UI-SPEC.md`'s own Retrofit Contract:** none structurally — this research confirms the plan is executable and resolves two of its explicitly-flagged open uncertainties (badge shape risk, Server/Client boundary risk) in the *lower-risk* direction, meaning the planner can be more confident scheduling the `Badge`/`Table` migrations than `03-UI-SPEC.md`'s cautious framing implied.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `shadcn-ui` npm package name, `npx shadcn-ui@latest init --style new-york --base-color zinc` flags | `shadcn` npm package (renamed), preset-code system (`vega`/`nova`/`maia`/etc. or opaque codes) | Package rename happened well before this research (confirmed by `shadcn` already being the correct name in `04-RESEARCH.md`'s own audit); the flag-to-preset UX change is dated by an April-2026 changelog entry found this session | Any plan or tutorial written before ~early 2026 describing `--style`/`--base-color` flags is stale; use the preset picker or accept the closest-match preset instead (Pitfall 1) |
| Per-primitive `@radix-ui/react-*` packages as shadcn's underlying dependency | Consolidated `radix-ui` meta-package | Some point before this session (Phase 4's research, written the same day, still assumed the old per-primitive packages — this is a fast-moving detail) | Do not manually `npm install @radix-ui/react-select`; let `shadcn add` install the consolidated `radix-ui` package as its own component source dictates |
| HSL-based shadcn theme variables (`hsl(var(--background))` in `tailwind.config.ts`) | OKLCH-based theme variables, referenced directly (`var(--background)` inside `@theme inline`, no `hsl()`/`oklch()` wrapper needed since Tailwind v4's `@theme` consumes the raw custom property) | Tailwind v4 + shadcn's Tailwind-v4-specific setup | Relevant to Pitfall 2 — the *symptom* (`hsl(#ffffff)` corruption) reported in the GitHub issue used may reflect a slightly older shadcn+Tailwind-v3-migration-era config shape; this project is Tailwind v4-native from Phase 1, so the exact wrapping syntax differs, but the underlying "two unreconciled color-variable blocks coexist" root cause is the same regardless of Tailwind major version |

**Deprecated/outdated:**
- The `default` shadcn `style` value is itself deprecated in favor of `new-york` per shadcn's own current `components.json` docs — irrelevant to this project only in that the *preset* system now sits a layer above this, but worth knowing `components.json`'s internal `style` field, if inspected directly after init, correctly showing `"new-york"` is expected, not a sign of misconfiguration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `vega` preset is the closest current analog to the historical "New York" style `03-UI-SPEC.md` specified — inferred from a WebSearch summary describing Vega as "classic shadcn look," not from directly rendering/comparing both styles this session | Standard Stack, Pitfall 1 | Low — the exact preset choice barely matters since Pattern 1's manual color reconciliation overrides whatever palette the preset applies; a "wrong" preset choice at worst means slightly different corner-radius/shadow defaults on components this phase already plans to override sizing on anyway |
| A2 | Contrast ratios in the Design Token Proposal's table are computed via standard relative-luminance formula reasoning, not independently re-verified against a canonical online contrast-checker tool this session (no such tool was available among this session's enabled research providers) | Design Token Proposal | Low-Medium — `03-UI-SPEC.md` and Phase 4's own spec already asserted these pairs pass AA; if the amber-700-on-amber-100 pair (the closest to the 4.5:1 threshold) is later found to fail on a real checker, only that one pair's background shade would need darkening slightly, no structural change |
| A3 | Interactive `shadcn init` will prompt for base color choice separately from preset choice (rather than bundling both into a single preset pick with no further color prompt) — the exact current prompt sequence wasn't directly observed this session (research-only, no code/CLI execution performed per task scope) | Pitfall 1, Standard Stack Installation | Low — either way, Pattern 1's manual `globals.css` reconciliation happens after init regardless of what the CLI's own prompts produce, so this assumption doesn't gate correctness, only affects how many prompts the executor sees |
| A4 | No dark-mode support is in scope for this phase (PROJECT.md/ROADMAP.md make no mention of a dark-mode requirement) — inferred from absence, not an explicit negative confirmation from the user | Pattern 1 (globals.css `.dark` block) | Low — if dark mode is later requested, this phase's `:root`-only token reconciliation is additive; a `.dark` block can be added in a future phase without touching this phase's work |

**If this table is empty:** N/A — see rows above; none block planning. A1 and A3 are cosmetic/sequencing details resolved automatically by Pattern 1's process regardless of outcome; A2 and A4 are worth a quick verify-time spot-check but do not change this phase's plan shape.

## Open Questions

1. **Should the `Button`/`Input` size override happen per-call-site (`className="min-h-14 text-xl..."`) or by editing the copied `src/components/ui/button.tsx`/`input.tsx` source once?**
   - What we know: Both approaches produce identical rendered output; shadcn's whole value proposition (per CLAUDE.md) is that the source is owned and editable.
   - What's unclear: Whether future phases (5, 6, 8, 10 — all `UI hint: yes`) would prefer per-call flexibility (some future button might legitimately want a smaller size) or a single project-wide accessible default (simpler, can't be forgotten).
   - Recommendation: Edit the copied source's `default` size variant once (Pitfall 3's option b) — this project has shown no need for a smaller button anywhere yet, and a single edited default is lower-risk than relying on every future call site remembering to add the override className.

2. **Does the interactive `shadcn init` prompt flow, when actually run against this exact Next.js 16.2.12 + Tailwind v4 + `src/` project, ask anything not covered by this research's WebSearch-based mechanics?**
   - What we know: The documented flag/prompt surface (template, base, preset, css-variables, monorepo, rtl).
   - What's unclear: The exact prompt wording/order for this specific project shape, since this research did not execute the CLI (research-only scope, no code changes permitted this session).
   - Recommendation: The executor should run `npx shadcn@latest init` interactively and read its own live prompts rather than assuming a fully scripted flow — same caveat Phase 4's research already flagged for the (now further-evolved) CLI.

3. **Should `success`/`warning` become first-class shadcn-style tokens (`--color-success`, `--color-warning` in `@theme`) or stay as project-local custom properties outside shadcn's semantic-token naming convention?**
   - What we know: shadcn's stock token set has no `success`/`warning` slot; `03-UI-SPEC.md` already names these as reserved project roles.
   - What's unclear: Whether a future phase's use of shadcn's own component variants (e.g., a future `Alert` component) would expect these to exist under shadcn's own naming convention to auto-theme correctly.
   - Recommendation: Add them as project-local `@theme` tokens now (Pattern 1's example already does this) — low cost, and if a future phase needs shadcn's own components to consume them, the token names can be referenced directly in that future component's `className`, same as any other custom Tailwind v4 token.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | shadcn CLI, npm installs | Yes (confirmed Phase 1/2/4) | v24.17.0 | — |
| npm registry access | `npm view` version checks, `shadcn`/`radix-ui`/etc. installs | Yes (all versions verified live this session) | — | — |
| Context7 MCP | Authoritative library-doc lookups for shadcn/Radix | No (not available this session, consistent with Phase 4's own note) | — | WebSearch + WebFetch against official docs + direct GitHub raw-source reads (used throughout this research) |
| Search providers (`brave_search`, `firecrawl`, `exa_search`, `tavily_search`, `ref_search`, `perplexity`, `jina`) | Enhanced research fetch routing | No — all disabled in `.planning/config.json` | — | Built-in `WebSearch`/`WebFetch` tools used for all external lookups this session |

**Missing dependencies with no fallback:** none — all research this session completed via available fallback tools.

**Missing dependencies with fallback:**
- Context7 — WebSearch/WebFetch against official shadcn docs + direct GitHub source reads substituted successfully; findings cross-checked across 2-3 independent sources where load-bearing (see Sources).
- All optional search providers — built-in WebSearch/WebFetch sufficed for every query this research needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (already installed and configured, Phase 1) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Existing automated test suite (7 files) continues passing after the retrofit — none of them assert on UI strings/classes (confirmed by this research's own grep), so this is a regression-only check, not new coverage | integration/smoke | `npm test` | ✅ existing |
| UX-01 | `npm run lint` (with `eslint-plugin-jsx-a11y`'s recommended rules, already active) reports zero new violations after the retrofit | lint | `npm run lint` | ✅ existing tooling, no new file needed |
| UX-01 | Contrast/touch-target values match the Design Token Proposal's table — this is a static-value check, not naturally expressible as a Vitest assertion against rendered DOM without a browser-testing library this project doesn't have | manual-only | — (no headless-browser/DOM-testing framework installed; adding one is out of scope for a UI-token-formalization phase) | manual-only, justified: no Playwright/Testing-Library present in `package.json`, and introducing one is a bigger decision than this phase's scope |
| UX-03 | Layout genuinely usable at real mobile/tablet/desktop widths and at 200% browser zoom | manual-only | — | manual-only, justified: `03-UI-SPEC.md` explicitly designates this a "backstop" requiring a held-out manual check, not an automated one, since no visual-regression/viewport-testing tool exists in this project |

### Sampling Rate

- **Per task commit:** `npm test` (regression-only — the existing 7 test files have no UI-string/class coupling, confirmed by grep, so this is a fast, cheap safety net, not a new-coverage gate) + `npm run lint`
- **Per wave merge:** `npm test` + `npm run lint`, plus a manual pass through all four retrofitted surfaces comparing before/after screenshots or DOM output
- **Phase gate:** Full suite green, lint clean, plus the manual 200%-zoom and mobile/tablet/desktop device checks `03-UI-SPEC.md` flags as backstops, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No new test file is strictly required — this phase is a retrofit with an explicit "componentize losslessly" contract, and the existing 7-file suite already provides adequate regression coverage per this research's own Test Dependency confirmation (matching `03-UI-SPEC.md`'s own audit)
- [ ] Consider a lightweight manual verification checklist (not a Vitest file) enumerating: rendered `<button>`/`<input>` sizes unchanged, badge shapes unchanged, skip-link present and functional, 200% zoom, three real viewport widths — this is process documentation, not automated test infrastructure

*(No automated-coverage gaps: existing test infrastructure covers all phase requirements at the regression level; the requirements' actual pass/fail signal (contrast, touch target size, visual layout) is inherently manual for a project with no browser/visual-testing framework installed.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | no | Not touched this phase |
| V3 Session Management | no | Not touched this phase |
| V4 Access Control | no | Not touched this phase — no RLS/schema change |
| V5 Input Validation | no | This phase changes component presentation, not validation logic — `zod` schemas and Server Action validation from Phase 4 are untouched |
| V6 Cryptography | no | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Supply-chain risk from a new CLI-installed dependency (`shadcn`, `radix-ui`) | Tampering | Package Legitimacy Audit above — both verified `OK` in practice (established repos, high download counts, no suspicious postinstall scripts found via `npm view <pkg> scripts.postinstall`) |
| None specific to this phase's UI-only scope beyond the above | — | This phase introduces no new attack surface (no new endpoints, no new data flows, no new auth/authz logic) — it is a presentation-layer retrofit |

**Note:** `npm view shadcn scripts.postinstall` and `npm view radix-ui scripts.postinstall` were not independently re-run this session beyond the `package-legitimacy check` seam's own signal collection (which reported `"postinstall": null` for both) — that seam's output is treated as sufficient given both packages' `OK`-in-practice disposition and lack of any other suspicious signal.

## Sources

### Primary (HIGH confidence — direct file reads / live registry checks this session)
- Direct reads of `src/app/(auth)/login/login-form.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/demandas/{demanda-form,demanda-card,demanda-table,demanda-list,status-badge,overdue-badge,conclude-button}.tsx`, `src/app/globals.css`, `eslint.config.mjs`, `package.json`, `tsconfig.json`, `next.config.ts` — confirmed the exact shipped ad hoc accessibility floor, existing `jsx-a11y` config, existing dependency versions, and absence of `components.json`
- `npm view shadcn version` / `radix-ui` / `class-variance-authority` / `clsx` / `tailwind-merge` (live npm registry, 2026-08-03) — all versions in Standard Stack confirmed current
- `gsd-tools query package-legitimacy check --ecosystem npm shadcn radix-ui class-variance-authority clsx tailwind-merge` (this session) — verdicts reproduced in Package Legitimacy Audit
- Direct GitHub raw-source reads of shadcn's current published component files (`badge.tsx`, `select.tsx`, `table.tsx`, `button.tsx`, `input.tsx`, `label.tsx` from `shadcn-ui/ui`, `apps/v4/registry/new-york-v4/ui/`) — confirmed exact `"use client"` presence/absence, default size classes, and default border-radius per component, superseding training-data assumptions
- Grep of `tests/**/*.ts` for UI-string/class coupling — confirmed zero dependencies, corroborating `03-UI-SPEC.md`'s own Test Dependency Audit
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `.../03-api-reference/01-directives/use-client.md` — read directly per AGENTS.md's explicit instruction, confirming Server/Client Component boundary rules applied in Pattern 3

### Secondary (MEDIUM confidence — WebFetch/WebSearch against official docs, cross-checked across 2+ sources)
- https://ui.shadcn.com/docs/cli (WebFetch) + https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/cli.md (WebFetch) + https://ui.shadcn.com/docs/changelog/2026-04-preset-commands (WebFetch) — all three independently corroborate the preset-based CLI system replacing `--style`/`--base-color` flags (Pitfall 1's central finding, cross-checked across 3 sources per this agent's Confirmation Bias Counter discipline)
- https://ui.shadcn.com/docs/theming (WebFetch) — CSS variable naming and `@theme inline` pattern (Pattern 1, Pattern 2)
- https://github.com/shadcn-ui/ui/issues/4845 (WebFetch) — the exact `globals.css` conflict symptom, dated and specific enough to be treated as a real, current, reproducible issue rather than a training-data-era assumption
- https://ui.shadcn.com/docs/components-json (WebFetch) — `rsc`/`tailwind.cssVariables` field semantics (Pattern 3's underlying mechanism, `components.json`'s continued internal use of `"new-york"` as the `style` value)

### Tertiary (LOW confidence — single-source WebSearch summaries, not independently re-verified)
- WCAG contrast ratios in the Design Token Proposal table — computed via standard formula reasoning, not run through a canonical contrast-checker tool this session (flagged as Assumption A2)
- Exact current `shadcn init` interactive prompt wording/order for this project's specific Next.js 16.2.12 + Tailwind v4 + `src/`-dir combination — not directly observed (research-only scope, no CLI execution performed); flagged as Open Question 2 and Assumption A3

## Metadata

**Confidence breakdown:**
- Shipped-code inventory (what's already built, existing a11y tooling, test-dependency audit): HIGH — every claim backed by a direct file read this session
- shadcn CLI mechanics (preset system, flag deprecation, globals.css conflict): MEDIUM-HIGH — the single most load-bearing finding (flag-to-preset migration) is cross-checked across 3 independent official/semi-official sources; the exact live prompt flow for this specific project was not executed (research-only scope)
- Component Server/Client boundary map (Pattern 3): HIGH — verified via direct raw-source reads of shadcn's currently-published component files, not training data or a single summarized fetch
- Design token / contrast values: MEDIUM — values are carried forward from `03-UI-SPEC.md`/Phase 4's own already-asserted AA-pass claims plus this research's own formula-based estimation, not independently re-verified against a canonical contrast-checker tool this session
- Package legitimacy: HIGH — live registry check + gsd-tools seam, consistent with Phase 1/2/4's own established "too-new heuristic false positive" pattern for this fast-moving ecosystem

**Research date:** 2026-08-03
**Valid until:** 2026-08-10 (7 days — shorter than Phase 4's 14-day window because this phase's central finding is an actively-changing CLI surface (preset system), which this research already observed evolving mid-2026; re-verify the exact CLI flag/prompt behavior if this phase's planning or execution slips past that window)
