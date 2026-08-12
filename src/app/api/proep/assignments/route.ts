// src/app/api/proep/assignments/route.ts
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

const createAssignmentSchema = z.object({
  edition_id: z.number().int().positive(),
  role: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const editionIdRaw = req.nextUrl.searchParams.get("edition_id");
  const editionId = editionIdRaw ? parseInt(editionIdRaw, 10) : null;
  const role = req.nextUrl.searchParams.get("role");
  let query = supabase.from("proep_assignments").select("*").order("sort_order");
  if (role) query = query.eq("role", role);
  const { data, error } = await query;
  if (error) {
    console.error("[proep_assignments GET]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  const filtered = editionId && !isNaN(editionId)
    ? (data ?? []).filter((r) => r.edition_id === editionId)
    : data ?? [];
  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const parsed = createAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("proep_assignments")
    .insert({
      edition_id: parsed.data.edition_id,
      role: parsed.data.role,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) {
    console.error("[proep_assignments POST]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const id = req.nextUrl.searchParams.get("id");
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const { error } = await supabase.from("proep_assignments").delete().eq("id", id);
  if (error) {
    console.error("[proep_assignments DELETE]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
