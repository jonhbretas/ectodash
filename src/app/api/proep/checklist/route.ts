// src/app/api/proep/checklist/route.ts
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

export async function GET() {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const { data, error } = await supabase.from("proep_checklist").select("*").order("day_number").order("sort_order");
  if (error) {
    console.error("[proep_checklist GET]", error.message);
    return NextResponse.json(ERR, { status: 500 });
  }
  // Checklist é global (todas as turmas): não filtra por edition_id.
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const gate = await guard();
  if (!gate) return NextResponse.json({ error: "Sem acesso ao módulo PROEP." }, { status: 403 });
  const supabase = gate.supabase;
  const body = await req.json();
  const { data, error } = await supabase
    .from("proep_checklist")
    .insert({
      edition_id: null,
      day_number: body.day_number,
      role: body.role || "Todos",
      title: body.title,
      description: body.description || null,
      sort_order: body.sort_order || 0,
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
  const { id, ...fields } = body;
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
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
