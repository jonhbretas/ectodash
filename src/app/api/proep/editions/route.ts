// src/app/api/proep/editions/route.ts
// Returns PROEP events (eventos where title contains 'PROEP') as editions,
// including the Drive folder of each edition (when already created).
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

  const ids = (data || []).map((e) => e.id);
  let configs: { edition_id: number; drive_folder_id: string | null; drive_folder_url: string | null }[] = [];
  if (ids.length > 0) {
    const { data: cfg, error: cfgError } = await supabase
      .from("proep_edition_config")
      .select("edition_id, drive_folder_id, drive_folder_url")
      .in("edition_id", ids);
    if (!cfgError) configs = cfg || [];
  }
  const configByEdition = new Map(configs.map((c) => [c.edition_id, c]));

  const editions = (data || []).map((e) => {
    const cfg = configByEdition.get(e.id);
    return {
      id: e.id,
      name: e.titulo,
      start_date: e.data_evento,
      description: e.descricao,
      location: e.local,
      drive_folder_url: cfg?.drive_folder_id ? cfg.drive_folder_url : null,
    };
  });

  return NextResponse.json(editions);
}
