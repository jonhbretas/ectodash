// src/lib/woocommerce/proep-link.ts
// Ponte entre a loja (WooCommerce) e o PROEP:
// 1. syncStoreCourses — preenche wp_customers.courses com os nomes dos
//    cursos/produtos comprados (exibe na tela Alunos).
// 2. linkProepOrdersToStudents — para cada pedido com produto PROEP que
//    casa com uma turma (evento cuja data_evento tem o mesmo mês/ano),
//    garante o aluno na turma como "participante" (fonte: loja), sem
//    duplicar (dedup por e-mail ou nome dentro da edição).
// Ambas são idempotentes e cobrem também o histórico (buscam todos os
// pedidos da loja, não apenas os da janela do sync).

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProductName } from "./parse-product";

type OrderRow = {
  wp_order_id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  items_summary: { name: string; qty: number; subtotal: number }[] | null;
};

type EventRow = { id: number; titulo: string; data_evento: string | null };

const PAGE_SIZE = 1000;

async function fetchAllOrders(supabase: SupabaseClient, storeId: string): Promise<OrderRow[]> {
  const out: OrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("wp_orders")
      .select("wp_order_id, customer_id, customer_name, customer_email, items_summary")
      .eq("store_id", storeId)
      .order("wp_order_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`wp_orders: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return out;
}

/** 1. Preenche wp_customers.courses com os cursos comprados por cliente. */
export async function syncStoreCourses(supabase: SupabaseClient, storeId: string): Promise<number> {
  const orders = await fetchAllOrders(supabase, storeId);
  const byCustomer = new Map<number, Set<string>>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    let set = byCustomer.get(o.customer_id);
    if (!set) {
      set = new Set<string>();
      byCustomer.set(o.customer_id, set);
    }
    for (const item of o.items_summary ?? []) {
      if (item.name) set.add(item.name);
    }
  }
  let updated = 0;
  for (const [customerId, courses] of byCustomer) {
    const { error } = await supabase
      .from("wp_customers")
      .update({ courses: [...courses] })
      .eq("store_id", storeId)
      .eq("wp_customer_id", customerId);
    if (!error) updated++;
  }
  return updated;
}

async function ensureParticipant(
  supabase: SupabaseClient,
  storeId: string,
  c: { editionId: number; name: string; email: string | null; wpCustomerId: number | null },
): Promise<void> {
  let existingId: string | null = null;

  if (c.email) {
    const { data } = await supabase
      .from("proep_students")
      .select("id, wp_customer_id")
      .eq("edition_id", c.editionId)
      .eq("email", c.email)
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }
  if (!existingId && c.name) {
    const { data } = await supabase
      .from("proep_students")
      .select("id")
      .eq("edition_id", c.editionId)
      .eq("name", c.name)
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  if (existingId) {
    // Já existe (manual ou loja): apenas garante o vínculo com o cliente da loja
    await supabase.from("proep_students").update({ wp_customer_id: c.wpCustomerId }).eq("id", existingId);
    return;
  }

  let phone: string | null = null;
  if (c.wpCustomerId) {
    const { data: cust } = await supabase
      .from("wp_customers")
      .select("billing")
      .eq("store_id", storeId)
      .eq("wp_customer_id", c.wpCustomerId)
      .maybeSingle();
    const billing = cust?.billing as Record<string, string> | null | undefined;
    phone = billing?.phone || null;
  }

  await supabase.from("proep_students").insert({
    edition_id: c.editionId,
    name: c.name,
    email: c.email,
    phone,
    role: "participant",
    source: "store",
    wp_customer_id: c.wpCustomerId,
  });
}

/** 2. Garante participantes das turmas PROEP a partir dos pedidos da loja. */
export async function linkProepOrdersToStudents(
  supabase: SupabaseClient,
  storeId: string,
): Promise<number> {
  const orders = await fetchAllOrders(supabase, storeId);
  const proepOrders = orders.filter((o) =>
    (o.items_summary ?? []).some((i) => /proep|estimula/i.test(i.name)),
  );
  if (proepOrders.length === 0) return 0;

  const { data: events } = await supabase
    .from("eventos")
    .select("id, titulo, data_evento")
    .ilike("titulo", "%PROEP%");
  const eventsArr = (events ?? []) as EventRow[];

  const seen = new Set<string>();
  let created = 0;

  for (const o of proepOrders) {
    for (const item of o.items_summary ?? []) {
      const parsed = parseProductName(item.name);
      if (!parsed.isProep || parsed.monthNum === null || parsed.year === null) continue;

      const event = eventsArr.find((e) => {
        if (!e.data_evento) return false;
        const d = new Date(e.data_evento);
        return !isNaN(d.getTime()) && d.getMonth() === parsed.monthNum && d.getFullYear() === parsed.year;
      });
      if (!event) continue;

      const name = o.customer_name?.trim() || "Participante";
      const key = `${event.id}|${(o.customer_email || name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const before = await supabase
        .from("proep_students")
        .select("id")
        .eq("edition_id", event.id)
        .eq("email", o.customer_email || "")
        .limit(1)
        .maybeSingle();
      const alreadyExists = !!before.data;
      await ensureParticipant(supabase, storeId, {
        editionId: event.id,
        name,
        email: o.customer_email || null,
        wpCustomerId: o.customer_id ?? null,
      });
      if (!alreadyExists) created++;
    }
  }

  return created;
}

/** Executa os dois passos: cursos dos clientes + vínculo de participantes. */
export async function linkStoreToProep(supabase: SupabaseClient, storeId: string) {
  const coursesUpdated = await syncStoreCourses(supabase, storeId);
  const participantsCreated = await linkProepOrdersToStudents(supabase, storeId);
  return { coursesUpdated, participantsCreated };
}
