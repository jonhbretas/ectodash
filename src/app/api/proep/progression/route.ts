// src/app/api/proep/progression/route.ts
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

const createProgressionSchema = z.object({
  edition_id: z.number().int().positive().nullable().optional(),
  from_role: z.string().trim().min(1).max(100),
  to_role: z.string().trim().min(1).max(100),
  requirements: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const editionIdRaw = req.nextUrl.searchParams.get("edition_id");
  const editionId = editionIdRaw ? parseInt(editionIdRaw, 10) : null;
  const { data, error } = await supabase.from("proep_progression").select("*").order("sort_order");
  if (error) {
    console.error("[proep_progression GET]", error.message);
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
  const parsed = createProgressionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("proep_progression")
    .insert({
      edition_id: parsed.data.edition_id ?? null,
      from_role: parsed.data.from_role,
      to_role: parsed.data.to_role,
      requirements: parsed.data.requirements ?? null,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) {
    console.error("[proep_progression POST]", error.message);
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
  const { error } = await supabase.from("proep_progression").delete().eq("id", id);
  if (error) {
    console.error("[proep_progression DELETE]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
