import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const [balance, receivables, exceptions] = await Promise.all([
    supabase.from("finance_consolidated_balance").select("*").single(),
    supabase.from("finance_receivables").select("*").limit(500),
    supabase.from("finance_exceptions").select("*").eq("status", "OPEN").order("created_at", { ascending: false }).limit(100),
  ]);
  if (balance.error) {
    console.error("financeiro summary:", balance.error.message);
    return NextResponse.json({ error: "Erro ao consultar os dados financeiros." }, { status: 400 });
  }
  return NextResponse.json({ balance: balance.data, receivables: receivables.data ?? [], exceptions: exceptions.data ?? [] });
}
