// /vendas/pedidos — WooCommerce order list with filters and search.
import Link from "next/link";
import { Search, ArrowLeft, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import PageContainer from "../../page-container";
import MonthPicker from "../month-picker";

export const metadata = { title: "Pedidos — Loja Ectolab" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type OrderRow = {
  id: string;
  wp_order_id: number;
  status: string;
  total: number;
  customer_name: string;
  customer_email: string;
  coupon_codes: string[];
  date_created: string;
  items_summary: { name: string; qty: number; subtotal: number }[] | null;
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const coupon = typeof params.coupon === "string" ? params.coupon.trim() : "";
  const monthFilter = typeof params.month === "string" ? params.month : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from("wp_orders")
    .select("*")
    .order("date_created", { ascending: false });

  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(
      `customer_name.ilike.%${s}%,customer_email.ilike.%${s}%`
    );
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (coupon) {
    query = query.contains("coupon_codes", [coupon]);
  }

  const { data: orders } = await query;
  let items: OrderRow[] = (orders ?? []) as OrderRow[];

  // Filter by month or year if specified.
  if (monthFilter) {
    items = items.filter((o) => {
      if (!o.date_created) return false;
      const d = new Date(o.date_created);
      if (monthFilter.length === 4) {
        return String(d.getFullYear()) === monthFilter;
      }
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === monthFilter;
    });
  }

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <Link
            href="/vendas"
            className="flex items-center gap-1 text-base text-zinc-500 hover:text-[#2195B9] transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar
          </Link>
          <h1 className="text-3xl font-semibold text-zinc-900">Pedidos</h1>
          <p className="text-xl text-zinc-500">
            {items.length} {items.length === 1 ? "pedido" : "pedidos"} encontrados
          </p>
        </div>
      </header>

      <MonthPicker />

      {/* Filters */}
      <form className="flex flex-wrap gap-3" method="GET">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Buscar por nome ou email..."
            className="w-full min-h-14 rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        >
          <option value="">Todos os status</option>
          <option value="completed">Concluído</option>
          <option value="processing">Processando</option>
          <option value="on-hold">Em espera</option>
          <option value="pending">Pendente</option>
          <option value="cancelled">Cancelado</option>
          <option value="refunded">Reembolsado</option>
          <option value="failed">Falhou</option>
        </select>
        <input
          type="text"
          name="coupon"
          defaultValue={coupon}
          placeholder="Cupom..."
          className="min-h-14 w-[160px] rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        />
        <button
          type="submit"
          className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <ShoppingCart size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum pedido encontrado
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            {search || status || coupon
              ? "Tente outros filtros."
              : "Aguarde a sincronização com a loja Ectolab."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <table className="w-full min-w-[52rem] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                <th scope="col" className="px-4 py-3 font-medium">Pedido</th>
                <th scope="col" className="px-4 py-3 font-medium">Data</th>
                <th scope="col" className="px-4 py-3 font-medium">Aluno</th>
                <th scope="col" className="px-4 py-3 font-medium">Curso</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Cupom</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr
                  key={order.wp_order_id}
                  className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                >
                  <td className="px-4 py-3 font-medium text-zinc-500">
                    #{order.wp_order_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {new Date(order.date_created).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 font-medium">
                    {order.customer_name || "—"}
                  </td>
                  <td className="max-w-[18rem] px-4 py-3">
                    {order.items_summary && order.items_summary.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {order.items_summary.slice(0, 2).map((item, i) => (
                          <span
                            key={i}
                            title={item.name}
                            className="truncate text-base text-zinc-700"
                          >
                            {item.qty > 1 && (
                              <span className="mr-1 text-zinc-400">{item.qty}×</span>
                            )}
                            {item.name}
                          </span>
                        ))}
                        {order.items_summary.length > 2 && (
                          <span className="text-sm text-zinc-400">
                            +{order.items_summary.length - 2} item(ns)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-zinc-500">
                    {order.customer_email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                        order.status === "completed"
                          ? "bg-green-50 text-green-700 ring-green-200/60"
                          : order.status === "processing"
                            ? "bg-blue-50 text-blue-700 ring-blue-200/60"
                            : order.status === "cancelled" || order.status === "failed"
                              ? "bg-red-50 text-red-700 ring-red-200/60"
                              : "bg-zinc-100 text-zinc-600 ring-zinc-200/60"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.coupon_codes?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {order.coupon_codes.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200/60"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {brl.format(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
