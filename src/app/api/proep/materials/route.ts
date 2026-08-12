// src/app/api/proep/materials/route.ts
// Auditoria 0063: gate de acesso PROEP + sem eco de mensagens internas.
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
  const category = req.nextUrl.searchParams.get("category");
  let query = supabase.from("proep_materials").select("*").order("sort_order");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) {
    console.error("[proep_materials GET]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  // Materiais são globais (todas as turmas): não filtra por edition_id.
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const { data, error } = await supabase
    .from("proep_materials")
    .insert({
      edition_id: null,
      category: body.category,
      title: body.title,
      description: body.description || null,
      url: body.url || null,
      file_id: body.file_id || null,
      file_type: body.file_type || null,
      is_template: body.is_template || false,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single();
  if (error) {
    console.error("[proep_materials POST]", error.message);
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
  const ALLOWED = ["category", "title", "description", "url", "file_id", "file_type", "is_template", "sort_order"] as const;
  const fields: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in raw) fields[key] = raw[key];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("proep_materials")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[proep_materials PATCH]", error.message);
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
  const { error } = await supabase.from("proep_materials").delete().eq("id", id);
  if (error) {
    console.error("[proep_materials DELETE]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
