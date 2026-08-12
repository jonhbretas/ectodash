// src/app/api/proep/students/route.ts
// Auditoria 0063: rota com gate de acesso PROEP (coordenador_geral,
// financeiro ou cargo com o módulo) e sem eco de mensagens internas de erro.
import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const editionIdRaw = req.nextUrl.searchParams.get("edition_id");
  const editionId = editionIdRaw ? parseInt(editionIdRaw, 10) : null;
  // Fetch all then filter in JS — PostgREST misinterprets edition_id as uuid.
  const { data, error } = await supabase
    .from("proep_students")
    .select("*, proep_student_materials(material_id, drive_url, proep_materials(title))")
    .order("name");
  if (error) {
    console.error("[proep_students GET]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  const filtered = editionId && !isNaN(editionId)
    ? (data ?? []).filter((s) => s.edition_id === editionId)
    : data ?? [];
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const { data, error } = await supabase
    .from("proep_students")
    .insert({
      edition_id: body.edition_id,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      role: body.role || "participant",
    })
    .select()
    .single();
  if (error) {
    console.error("[proep_students POST]", error.message);
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
  const ALLOWED = ["name", "email", "phone", "role", "edition_id"] as const;
  const fields: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in raw) fields[key] = raw[key];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }
  fields.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("proep_students")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[proep_students PATCH]", error.message);
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
  const { error } = await supabase.from("proep_students").delete().eq("id", id);
  if (error) {
    console.error("[proep_students DELETE]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
