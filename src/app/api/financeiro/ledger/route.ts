import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  let query = supabase.from("finance_ledger").select("*").order("movement_date", { ascending: false }).limit(500);
  if (status) query = query.eq("reconciliation_status", status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
