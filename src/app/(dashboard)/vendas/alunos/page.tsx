// /vendas/alunos — WooCommerce customer list with search.
import Link from "next/link";
import { Search, ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import PageContainer from "../../page-container";
import MonthPicker from "../month-picker";

export const metadata = { title: "Alunos — Loja Ectolab" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type CustomerRow = {
  id: string;
  wp_customer_id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: number;
  date_created: string;
  courses: string[] | null;
};

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const monthFilter = typeof params.month === "string" ? params.month : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from("wp_customers")
    .select("*")
    .order("total_spent", { ascending: false });

  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`
    );
  }

  const { data: customers } = await query;
  const items: CustomerRow[] = (customers ?? []) as CustomerRow[];

  const totalSpent = items.reduce((sum, c) => sum + (c.total_spent ?? 0), 0);
  const totalOrders = items.reduce((sum, c) => sum + (c.orders_count ?? 0), 0);

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
          <h1 className="text-3xl font-semibold text-zinc-900">Alunos</h1>
          <p className="text-xl text-zinc-500">
            {items.length} {items.length === 1 ? "aluno" : "alunos"} cadastrados
            {" · "}Total gasto: {brl.format(totalSpent)}
            {" · "}{totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
      </header>

      <MonthPicker />

      {/* Search */}
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
        <button
          type="submit"
          className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
        >
          Buscar
        </button>
      </form>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <Users size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum aluno encontrado
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            {search
              ? "Tente outros termos de busca."
              : "Aguarde a sincronização com a loja Ectolab."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <table className="w-full min-w-[52rem] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                <th scope="col" className="px-4 py-3 font-medium">Aluno</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Cursos</th>
                <th scope="col" className="px-4 py-3 font-medium text-center">Pedidos</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Total gasto</th>
                <th scope="col" className="px-4 py-3 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr
                  key={customer.wp_customer_id}
                  className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                >
                  <td className="px-4 py-3 font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-zinc-500">
                    {customer.email || "—"}
                  </td>
                  <td className="max-w-[20rem] px-4 py-3">
                    {customer.courses && customer.courses.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {customer.courses.slice(0, 3).map((course) => (
                          <span
                            key={course}
                            title={course}
                            className="max-w-full truncate rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-sm font-medium text-[#2195B9] ring-1 ring-[#2195B9]/20"
                          >
                            {course}
                          </span>
                        ))}
                        {customer.courses.length > 3 && (
                          <span className="text-sm text-zinc-400">
                            +{customer.courses.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">
                    {customer.orders_count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-green-700">
                    {brl.format(customer.total_spent ?? 0)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {customer.date_created
                      ? new Date(customer.date_created).toLocaleDateString("pt-BR")
                      : "—"}
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
