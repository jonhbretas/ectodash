// src/app/api/proep/checklist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(id: string | null, label = "id") {
  if (!id || !UUID_RE.test(id)) {
    throw NextResponse.json({ error: `${label} deve ser um UUID válido` }, { status: 400 });
  }
  return id;
}

export async function GET(req: NextRequest) {
  const editionId = req.nextUrl.searchParams.get("edition_id");
  const supabase = await createClient();
  let query = supabase.from("proep_checklist").select("*").order("day_number").order("sort_order");
  if (editionId) query = query.eq("edition_id", editionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proep_checklist")
    .insert({
      edition_id: body.edition_id,
      day_number: body.day_number,
      phase: body.phase || "before",
      title: body.title,
      description: body.description || null,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proep_checklist")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try { requireUuid(id, "id"); } catch (e) { return e as NextResponse; }
  const supabase = await createClient();
  const { error } = await supabase.from("proep_checklist").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
