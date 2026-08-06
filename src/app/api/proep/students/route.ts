// src/app/api/proep/students/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(id: string | null, label = "id") {
  if (!id || !UUID_RE.test(id)) {
    throw NextResponse.json({ error: `${label} deve ser um UUID válido` }, { status: 400 });
  }
  return id;
}

const LABEL = "proep_students";

export async function GET(req: NextRequest) {
  const editionIdRaw = req.nextUrl.searchParams.get("edition_id");
  const editionId = editionIdRaw ? parseInt(editionIdRaw, 10) : null;
  const supabase = await createClient();
  // Fetch all then filter in JS — PostgREST misinterprets edition_id as uuid.
  const { data, error } = await supabase.from("proep_students").select("*").order("name");
  if (error) return NextResponse.json({ error: `[${LABEL} GET] ${error.message}` }, { status: 500 });
  const filtered = editionId && !isNaN(editionId)
    ? (data ?? []).filter((s) => s.edition_id === editionId)
    : data ?? [];
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = await createClient();
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
  if (error) return NextResponse.json({ error: `[${LABEL} POST] ${error.message}` }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proep_students")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: `[${LABEL} PATCH] ${error.message}` }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const supabase = await createClient();
  const { error } = await supabase.from("proep_students").delete().eq("id", id);
  if (error) return NextResponse.json({ error: `[${LABEL} DELETE] ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
