// src/app/api/proep/checklist/route.ts
// Auditoria 0063: gate de acesso PROEP + sem eco de mensagens internas.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProep } from "@/lib/role-gates";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(id: string | null, label = "id") {
  if (!id || !UUID_RE.test(id)) {
    throw NextResponse.json({ error: `${label} deve ser um UUID válido` }, { status: 400 });
  }
  return id;
}

async function guard() {
  try {
    const ctx = await requireProep();
    return ctx;
  } catch {
    return null;
  }
}

const ERR = { error: "Erro ao processar a requisição." };

const createChecklistSchema = z.object({
  day_number: z.number().int().positive(),
  role: z.string().trim().max(50).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET() {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const { data, error } = await supabase.from("proep_checklist").select("*").order("day_number").order("sort_order");
  if (error) {
    console.error("[proep_checklist GET]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const parsed = createChecklistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("proep_checklist")
    .insert({
      edition_id: null,
      day_number: parsed.data.day_number,
      role: parsed.data.role ?? "Todos",
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) {
    console.error("[proep_checklist POST]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const { id, ...raw } = body;
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }

  // Allowlist de campos atualizáveis — previne mass assignment.
  const ALLOWED = ["day_number", "role", "title", "description", "sort_order"] as const;
  const fields: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in raw) fields[key] = raw[key];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("proep_checklist")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[proep_checklist PATCH]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const id = req.nextUrl.searchParams.get("id");
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const { error } = await supabase.from("proep_checklist").delete().eq("id", id);
  if (error) {
    console.error("[proep_checklist DELETE]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
