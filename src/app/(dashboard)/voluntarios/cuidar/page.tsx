// /voluntarios/cuidar — painel da coordenação de voluntariado (o "RH" da
// Ectolab): quem está em dia, quem precisa de atenção, sumidos e
// afastados. Feito para coordenadores idosos no celular: letras grandes,
// botões grandes, 1 tela por pessoa. Acesso: geral/voluntariado/cargo
// (RLS 0017 + gate da RPC são o limite real).
import Link from "next/link";
import { ArrowLeft, HeartHandshake, Lock, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";
import { cn } from "@/lib/utils";
import PageContainer from "../../page-container";
import CuidarCard, { type Pessoa } from "./cuidar-card";
import type { Engajamento } from "./tipos";

export const metadata = { title: "Cuidar das pessoas — Voluntários | EctoDash" };

const FILTROS = [
  { valor: "atencao", rotulo: "Precisam de atenção" },
  { valor: "todos", rotulo: "Todos" },
  { valor: "emdia", rotulo: "Em dia" },
  { valor: "afastados", rotulo: "Afastados" },
] as const;

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const base = new Date(y, m - 1, d).getTime();
  return Math.max(0, Math.floor((Date.now() - base) / 86_400_000));
}

export default async function CuidarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filtroRaw = typeof params.filtro === "string" ? params.filtro : "atencao";
  const filtro = (["atencao", "todos", "emdia", "afastados"] as const).includes(
    filtroRaw as (typeof FILTROS)[number]["valor"]
  )
    ? (filtroRaw as (typeof FILTROS)[number]["valor"])
    : "atencao";
  const busca = typeof params.busca === "string" ? params.busca.trim() : "";

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
  const { data: meusCargos } = await supabase.rpc("meus_cargos");
  const temCargo = ((meusCargos ?? []) as Array<{ modulos: string[] }>).some((c) =>
    c.modulos.includes("voluntarios")
  );
  const pode =
    profile?.role === "coordenador_geral" ||
    profile?.role === "voluntariado" ||
    temCargo;
  if (!pode) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">Só da coordenação</h1>
          <p className="max-w-md text-xl text-zinc-700">
            Esta tela é da coordenação de voluntariado.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white"
          >
            Voltar ao início
          </Link>
        </div>
      </PageContainer>
    );
  }

  let query = supabase
    .from("voluntarios")
    .select("id, nome, area_atuacao, situacao, engajamento, ultimo_contato_em, telefone1, telefone2")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (busca) {
    const s = sanitizeSearch(busca);
    query = query.ilike("nome", `%${s}%`);
  }
  const { data, error } = await query;
  if (error) console.error("cuidar: select failed", error);

  const pessoas: Pessoa[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    nome: String(r.nome),
    area: (r.area_atuacao as string | null) ?? null,
    situacao: (r.situacao as string | null) ?? null,
    engajamento: (r.engajamento as Engajamento) ?? "engajado",
    ultimo_contato_em: (r.ultimo_contato_em as string | null) ?? null,
    telefone1: (r.telefone1 as string | null) ?? null,
    telefone2: (r.telefone2 as string | null) ?? null,
    dias_sem_contato: diasDesde((r.ultimo_contato_em as string | null) ?? null),
  }));

  const precisaAtencao = (p: Pessoa) =>
    p.engajamento === "atencao" ||
    p.engajamento === "sumido" ||
    (p.engajamento !== "afastado" &&
      (p.dias_sem_contato === null || p.dias_sem_contato >= 30));

  const qtdAtencao = pessoas.filter(precisaAtencao).length;

  const visiveis = pessoas.filter((p) => {
    if (filtro === "atencao") return precisaAtencao(p);
    if (filtro === "emdia") return p.engajamento === "engajado";
    if (filtro === "afastados") return p.engajamento === "afastado";
    return true;
  });

  const areas = [...new Set(pessoas.map((p) => p.area).filter((a): a is string => Boolean(a)))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );

  function filtroHref(valor: string): string {
    const qs = new URLSearchParams();
    if (busca) qs.set("busca", busca);
    if (valor !== "atencao") qs.set("filtro", valor);
    const s = qs.toString();
    return `/voluntarios/cuidar${s ? `?${s}` : ""}`;
  }

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <Link
          href="/voluntarios"
          className="inline-flex items-center gap-1.5 text-lg font-medium text-[#2195B9]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Voluntários
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
          <HeartHandshake size={30} aria-hidden="true" className="text-[#2195B9]" />
          Cuidar das pessoas
        </h1>
        <p className="max-w-2xl text-xl text-zinc-500">
          {qtdAtencao === 0
            ? "Todo mundo em dia. Bom trabalho!"
            : `${qtdAtencao} ${qtdAtencao === 1 ? "pessoa precisa" : "pessoas precisam"} de um contato.`}
        </p>
      </header>

      <form
        action="/voluntarios/cuidar"
        method="get"
        role="search"
        aria-label="Buscar pessoa"
        className="flex w-full gap-2"
      >
        {filtro !== "atencao" && <input type="hidden" name="filtro" value={filtro} />}
        <input
          id="busca"
          name="busca"
          defaultValue={busca}
          placeholder="Nome da pessoa…"
          maxLength={120}
          aria-label="Nome da pessoa"
          className="min-h-14 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900 placeholder:text-zinc-400"
        />
        <button
          type="submit"
          className="min-h-14 rounded-xl bg-zinc-900 px-6 text-xl font-medium text-white"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro">
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <Link
              key={f.valor}
              href={filtroHref(f.valor)}
              aria-current={ativo ? "true" : undefined}
              className={cn(
                "flex min-h-14 items-center rounded-full border px-5 text-xl transition-colors",
                ativo
                  ? "border-[#2195B9] bg-[#2195B9] font-semibold text-white"
                  : "border-zinc-300 bg-white text-zinc-800"
              )}
            >
              {f.rotulo}
            </Link>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-zinc-200/60">
          <SearchX size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">Ninguém aqui</h2>
          <p className="max-w-md text-xl text-zinc-600">
            {filtro === "atencao"
              ? "Ninguém precisando de contato agora."
              : "Tente outro filtro ou busca."}
          </p>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <p className="text-lg text-zinc-500">
            {visiveis.length} {visiveis.length === 1 ? "pessoa" : "pessoas"}
          </p>
          {visiveis.map((p) => (
            <CuidarCard key={p.id} pessoa={p} areas={areas} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
