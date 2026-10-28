import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "coordenador_geral",
  private: true,
  duplicates: [] as { id: number; titulo: string; prazo: string | null; area: string | null; projeto: string | null }[],
  writes: [] as { table: string; op: string; payload: unknown }[],
  reads: [] as string[],
  filters: [] as unknown[][],
  searchError: false,
  user: { id: "coord-1" } as { id: string } | null,
  send: vi.fn(),
  ai: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/send-comment-email", () => ({ sendCommentEmail: state.send }));
vi.mock("@/lib/ai/ai-client", () => ({ chatCompletion: state.ai, wrapUserContent: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn(function () { return { emails: { send: state.send } }; }) }));

function client() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from(table: string) {
      state.reads.push(table);
      let writing = false;
      const chain = {
        select() { return chain; },
        eq(...args: unknown[]) { state.filters.push([table, ...args]); return chain; },
        neq() { return chain; },
        or() { return chain; },
        ilike() { return chain; },
        order() { return chain; },
        update(payload: unknown) { writing = true; state.writes.push({ table, op: "update", payload }); return chain; },
        insert(payload: unknown) { writing = true; state.writes.push({ table, op: "insert", payload }); return chain; },
        async single() {
          return { data: table === "profiles" ? { role: state.role } : writing ? { id: 42 } : { id: 42, titulo: "Privada", restrita_coordenacao_geral: state.private }, error: null };
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(resolve({ data: table === "demandas" ? state.duplicates : [], error: state.searchError ? { message: "offline" } : null }));
        },
      };
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client() }));

const { criarTarefaCoordenacao } = await import("@/app/(dashboard)/demandas/quick-create-actions");
const { comentarDemanda } = await import("@/app/(dashboard)/demandas/checklist-actions");
const { corrigirDemandaComIa } = await import("@/app/(dashboard)/demandas/actions");
const { GET } = await import("@/app/api/cron/reminders/route");

beforeEach(() => {
  state.role = "coordenador_geral";
  state.private = true;
  state.user = { id: "coord-1" };
  state.duplicates = [];
  state.writes = []; state.reads = []; state.filters = [];
  state.searchError = false;
  vi.clearAllMocks();
});

describe("closed coordination workspace", () => {
  it("creates a title-only task with privacy forced on the server", async () => {
    const result = await criarTarefaCoordenacao({ titulo: "  Planejar reunião  ", status: "pendente" });
    expect(result.ok).toBe(true);
    expect(state.writes).toEqual([{ table: "demandas", op: "insert", payload: {
      titulo: "Planejar reunião", status: "pendente", prazo: null, area: null, projeto: null, restrita_coordenacao_geral: true,
    } }]);
    expect(state.send).not.toHaveBeenCalled();
  });

  it.each(["voluntario_comum", "coordenador_area", "financeiro"])("rejects direct creation by %s", async (role) => {
    state.role = role;
    expect((await criarTarefaCoordenacao({ titulo: "Teste", status: "pendente" })).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("does not write when duplicate checking fails", async () => {
    state.searchError = true;
    expect((await criarTarefaCoordenacao({ titulo: "Teste", status: "pendente" })).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("asks to merge before writing and preserves populated fields", async () => {
    state.duplicates = [{ id: 7, titulo: "Reunião", prazo: "2026-12-01", area: null, projeto: "Existente" }];
    const input = { titulo: "Reunião", prazo: "2026-10-28", area: "Gestão", projeto: "Novo", status: "pendente" as const };
    expect((await criarTarefaCoordenacao(input)).duplicates).toEqual([{ id: 7, titulo: "Reunião" }]);
    expect(state.writes).toEqual([]);
    expect((await criarTarefaCoordenacao({ ...input, mesclarId: 7 })).ok).toBe(true);
    expect(state.writes).toEqual([{ table: "demandas", op: "update", payload: { prazo: "2026-12-01", area: "Gestão", projeto: "Existente" } }]);
  });

  it("stores private mentions without even looking up recipients", async () => {
    const form = new FormData(); form.set("conteudo", "@maria veja esta tarefa confidencial");
    expect((await comentarDemanda(42, { ok: false, message: "" }, form)).ok).toBe(true);
    expect(state.writes[0].table).toBe("demanda_comentarios");
    expect(state.reads).not.toContain("profiles");
    expect(state.send).not.toHaveBeenCalled();
  });

  it("blocks sending private task content to an AI provider", async () => {
    expect((await corrigirDemandaComIa(42)).ok).toBe(false);
    expect(state.ai).not.toHaveBeenCalled();
    expect(state.reads).not.toContain("demanda_comentarios");
  });

  it("excludes private tasks from the admin reminder query", async () => {
    vi.stubEnv("CRON_SECRET", "coordination-test");
    try {
      const response = await GET({ headers: new Headers({ authorization: "Bearer coordination-test" }) } as Parameters<typeof GET>[0]);
      expect(response.status).toBe(200);
      expect(state.filters).toContainEqual(["demandas_com_status", "restrita_coordenacao_geral", false]);
      expect(state.send).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
});
