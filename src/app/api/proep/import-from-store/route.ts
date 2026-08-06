// src/app/api/proep/import-from-store/route.ts
// POST /api/proep/import-from-store — importa compradores da loja como
// participantes das turmas PROEP correspondentes (mês/ano do produto vs
// data do evento). Idempotente: alunos já existentes não são duplicados.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkStoreToProep } from "@/lib/woocommerce/proep-link";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
