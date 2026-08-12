// /vendas/produtos — WooCommerce product list with search and status filters.
import Link from "next/link";
import { Search, ArrowLeft, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import PageContainer from "../../page-container";
import MonthPicker from "../month-picker";
import { parseProductName } from "@/lib/woocommerce/parse-product";

export const metadata = { title: "Produtos — Loja Ectolab" };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProductRow = {
  id: string;
  wp_product_id: number;
  name: string;
  sku: string | null;
  price: number;
  regular_price: number;
  sale_price: number;
  stock_quantity: number | null;
  status: string;
  image_url: string | null;
  categories: Array<{ id: number; name: string }>;
  synced_at: string;
  date_created: string | null;
};

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const monthFilter = typeof params.month === "string" ? params.month : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from("wp_products")
    .select("*")
    .order("synced_at", { ascending: false });

  if (search) {
    const s = sanitizeSearch(search);
    query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data: products } = await query;
  let items: ProductRow[] = (products ?? []) as ProductRow[];

  // Filter by month or year if specified.
  if (monthFilter) {
    items = items.filter((p) => {
      if (!p.date_created) return false;
      const d = new Date(p.date_created);
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
          <h1 className="text-3xl font-semibold text-zinc-900">Produtos</h1>
          <p className="text-xl text-zinc-500">
            {items.length} {items.length === 1 ? "produto" : "produtos"} sincronizados
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
            placeholder="Buscar por nome ou SKU..."
            className="w-full min-h-14 rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="min-h-14 rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 focus:border-[#2195B9] focus:outline-none focus:ring-2 focus:ring-[#2195B9]/30"
        >
          <option value="">Todos os status</option>
          <option value="publish">Publicado</option>
          <option value="draft">Rascunho</option>
          <option value="pending">Pendente</option>
          <option value="private">Privado</option>
        </select>
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
          <Package size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum produto encontrado
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            {search || status
              ? "Tente outros filtros."
              : "Aguarde a sincronização com a loja Ectolab."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <table className="w-full min-w-[48rem] text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500">
                <th scope="col" className="px-4 py-3 font-medium">Produto</th>
                <th scope="col" className="px-4 py-3 font-medium">SKU</th>
                <th scope="col" className="px-4 py-3 font-medium">Preço</th>
                <th scope="col" className="px-4 py-3 font-medium">Estoque</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Vinculação</th>
                <th scope="col" className="px-4 py-3 font-medium">Categorias</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr
                  key={product.wp_product_id}
                  className="border-b border-zinc-100 text-lg text-zinc-900 last:border-b-0 transition-colors hover:bg-zinc-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                          <Package size={18} className="text-zinc-400" />
                        </div>
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{product.sku ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">
                    {product.sale_price > 0 ? (
                      <>
                        <span className="text-green-700">{brl.format(product.sale_price)}</span>
                        <span className="ml-2 text-base text-zinc-400 line-through">
                          {brl.format(product.regular_price)}
                        </span>
                      </>
                    ) : (
                      brl.format(product.price)
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {product.stock_quantity ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                        product.status === "publish"
                          ? "bg-green-50 text-green-700 ring-green-200/60"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-200/60"
                      }`}
                    >
                      {product.status === "publish" ? "Publicado" : product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {product.categories?.map((c) => c.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const parsed = parseProductName(product.name);
                      if (parsed.isProep && parsed.label) {
                        return (
                          <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-700 ring-1 ring-purple-200/60">
                            {parsed.label}
                          </span>
                        );
                      }
                      return <span className="text-zinc-400">—</span>;
                    })()}
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
