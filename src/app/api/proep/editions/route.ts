// src/app/api/proep/editions/route.ts
// Returns PROEP events (eventos where title contains 'PROEP') as editions.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select("id, titulo, descricao, data_evento, local, created_at")
    .ilike("titulo", "%PROEP%")
    .order("data_evento", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const editions = (data || []).map((e) => ({
    id: e.id,
    name: e.titulo,
    start_date: e.data_evento,
    description: e.descricao,
    location: e.local,
  }));

  return NextResponse.json(editions);
}
