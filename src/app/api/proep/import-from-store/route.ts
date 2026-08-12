// src/app/api/proep/import-from-store/route.ts
// POST /api/proep/import-from-store — importa compradores da loja como
// participantes das turmas PROEP correspondentes (mês/ano do produto vs
// data do evento). Idempotente: alunos já existentes não são duplicados.
// Auditoria 0063: o fluxo escreve em wp_customers e proep_students (sem
// políticas de escrita de sessão — apenas service role), então usa o client
// admin EXATAMENTE como /api/wp/sync, com o mesmo gate de role
// (coordenador_geral | financeiro). Exceção documentada à restrição
// cron-only de src/lib/supabase/admin.ts.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFinanceiro } from "@/lib/role-gates";
import { linkStoreToProep } from "@/lib/woocommerce/proep-link";

export async function POST(_req: NextRequest) {
  try {
    try {
      await requireFinanceiro();
    } catch {
      return NextResponse.json({ error: "Sem permissão para importar da loja." }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: stores, error: storesError } = await supabase
      .from("wp_stores")
      .select("id")
      .eq("is_active", true);

    if (storesError || !stores || stores.length === 0) {
      return NextResponse.json({ error: "Nenhuma loja WooCommerce ativa encontrada" }, { status: 404 });
    }

    let coursesUpdated = 0;
    let participantsCreated = 0;
    for (const store of stores) {
      const result = await linkStoreToProep(supabase, store.id as string);
      coursesUpdated += result.coursesUpdated;
      participantsCreated += result.participantsCreated;
    }

    return NextResponse.json({ ok: true, coursesUpdated, participantsCreated });
  } catch (e: any) {
    console.error("[proep import-from-store]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
