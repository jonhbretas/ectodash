// /vendas — WooCommerce ECTOLAB dashboard: KPIs, top products, recent orders.
// Only coordenador_geral and financeiro can view it.
// Queries Supabase directly (same pattern as financeiro/page.tsx).
import Link from "next/link";
import {
  Lock,
  ShoppingCart,
  TrendingUp,
  Users,
  Package,
  DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import SyncButton from "./sync-button";
import MonthPicker from "./month-picker";

export const metadata = { title: "Loja Ectolab — EctoDash" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type OrderRow = {
  wp_order_id: number;
  total: number;
  customer_name: string;
  customer_email: string;
  status: string;
  date_created: string;
  items_summary: Array<{ name: string; qty: number; subtotal: number }> | null;
  coupon_codes: string[] | null;
};

type SyncLogRow = {
  id: string;
  status: string;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  products_synced: number;
  orders_synced: number;
  customers_synced: number;
  error: string | null;
};

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const monthFilter = typeof params.month === "string" ? params.month : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";

  if (!allowed) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            Este painel é exclusivo das finanças
          </h1>
          <p className="max-w-md text-xl text-zinc-700">
            Você não tem acesso à loja Ectolab.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            Ver minhas demandas
          </Link>
        </div>
      </PageContainer>
    );
  }

  // Fetch all data in parallel — same pattern as financeiro/page.tsx.
  const [ordersResult, customersResult, productsResult, syncResult] =
    await Promise.all([
      supabase
        .from("wp_orders")
        .select("wp_order_id, total, customer_name, customer_email, status, date_created, items_summary, coupon_codes"),
      supabase
        .from("wp_customers")
        .select("id"),
      supabase
        .from("wp_products")
        .select("id, name, price, image_url"),
      supabase
        .from("wp_sync_log")
        .select("id, status, trigger_source, started_at, finished_at, products_synced, orders_synced, customers_synced, error")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

  const orders: OrderRow[] = (ordersResult.data ?? []) as OrderRow[];
  const productsCount = (productsResult.data ?? []).length;
  const customersCount = (customersResult.data ?? []).length;
  const syncLogs: SyncLogRow[] = (syncResult.data ?? []) as SyncLogRow[];

  // Filter orders by month if specified.
  const filteredOrders = monthFilter
    ? orders.filter((o) => {
        if (!o.date_created) return false;
        const d = new Date(o.date_created);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return ym === monthFilter;
      })
    : orders;

  // ── KPIs ──────────────────────────────────────────────────────────
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const totalOrders = filteredOrders.length;
  const uniqueCustomers = new Set(
    filteredOrders.filter((o) => o.customer_email).map((o) => o.customer_email)
  ).size;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Top products by revenue ───────────────────────────────────────
  const productCountMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const order of filteredOrders) {
    const items = order.items_summary ?? [];
    for (const item of items) {
      const existing = productCountMap.get(item.name) ?? {
        name: item.name,
        count: 0,
        revenue: 0,
      };
      existing.count += item.qty;
      existing.revenue += item.subtotal;
      productCountMap.set(item.name, existing);
    }
  }
  const topProducts = [...productCountMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Recent orders (last 10) ───────────────────────────────────────
  const recentOrders = filteredOrders
    .sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    )
    .slice(0, 10);

  return (
    <PageContainer>
      <Header />
      <MonthPicker />

      {/* KPIs */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatPill
          label="Faturamento total"
          value={brl.format(totalRevenue)}
          Icon={DollarSign}
          iconClassName="text-green-600"
        />
        <StatPill
          label="Total de pedidos"
          value={String(totalOrders)}
          Icon={ShoppingCart}
          iconClassName="text-[#2195B9]"
        />
        <StatPill
          label="Alunos únicos"
          value={String(uniqueCustomers)}
          Icon={Users}
          iconClassName="text-purple-600"
        />
        <StatPill
          label="Ticket médio"
          value={brl.format(avgTicket)}
          Icon={TrendingUp}
          iconClassName="text-amber-600"
        />
      </div>

      {/* Counts */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <StatPill
          label="Produtos cadastrados"
          value={String(productsCount)}
          Icon={Package}
          iconClassName="text-blue-600"
        />
        <StatPill
          label="Clientes cadastrados"
          value={String(customersCount)}
          Icon={Users}
          iconClassName="text-indigo-600"
        />
      </div>

      <div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Top Products */}
        {topProducts.length > 0 && (
          <section className="flex w-full flex-col gap-4">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Top produtos por receita
            </h2>
            <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="px-4 py-3 font-medium">Produto</th>
                    <th scope="col" className="px-4 py-3 font-medium text-center">Qtd vendida</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr
                      key={`${p.name}-${i}`}
                      className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                    >
                      <td className="max-w-[18rem] truncate px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-center text-zinc-600">{p.count}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-green-700">
                        {brl.format(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <section className="flex w-full flex-col gap-4">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Últimos pedidos
            </h2>
            <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="px-4 py-3 font-medium">Data</th>
                    <th scope="col" className="px-4 py-3 font-medium">Aluno</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr
                      key={o.wp_order_id}
                      className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {new Date(o.date_created).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-medium">
                        {o.customer_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                            o.status === "completed"
                              ? "bg-green-50 text-green-700 ring-green-200/60"
                              : o.status === "processing"
                                ? "bg-blue-50 text-blue-700 ring-blue-200/60"
                                : "bg-zinc-100 text-zinc-600 ring-zinc-200/60"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {brl.format(o.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Sync Status */}
      {syncLogs.length > 0 && (
        <section className="flex w-full flex-col gap-4">
          <h2 className="text-2xl font-semibold text-zinc-900">
            Últimas sincronizações
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                  <th scope="col" className="px-4 py-3 font-medium">Data</th>
                  <th scope="col" className="px-4 py-3 font-medium">Origem</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium text-center">Produtos</th>
                  <th scope="col" className="px-4 py-3 font-medium text-center">Pedidos</th>
                  <th scope="col" className="px-4 py-3 font-medium text-center">Clientes</th>
                  <th scope="col" className="px-4 py-3 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {new Date(log.started_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                        {log.trigger_source === "cron" ? "Automático" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                          log.status === "success"
                            ? "bg-green-50 text-green-700 ring-green-200/60"
                            : log.status === "running"
                              ? "bg-blue-50 text-blue-700 ring-blue-200/60"
                              : "bg-red-50 text-red-700 ring-red-200/60"
                        }`}
                      >
                        {log.status === "success"
                          ? "Sucesso"
                          : log.status === "running"
                            ? "Em andamento"
                            : "Falhou"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600">{log.products_synced}</td>
                    <td className="px-4 py-3 text-center text-zinc-600">{log.orders_synced}</td>
                    <td className="px-4 py-3 text-center text-zinc-600">{log.customers_synced}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-red-600">
                      {log.error ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function Header() {
  return (
    <header className="flex w-full flex-wrap items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Loja Ectolab
        </h1>
        <p className="text-xl text-zinc-500">
          Dados da loja Ectolab, sincronizados automaticamente.
        </p>
      </div>
      <SyncButton />
    </header>
  );
}

function StatPill({
  label,
  value,
  Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  Icon: typeof DollarSign;
  iconClassName: string;
}) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <Icon size={24} aria-hidden="true" className={`shrink-0 ${iconClassName}`} />
      <div className="flex min-w-0 flex-col">
        <span className="text-base font-medium text-zinc-500">{label}</span>
        <span className="truncate text-xl font-semibold text-zinc-900 sm:text-2xl">
          {value}
        </span>
      </div>
    </div>
  );
}
