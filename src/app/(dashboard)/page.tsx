import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Map,
  MessageSquarePlus,
  NotebookPen,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { podeAcessar, type Acesso, type ModuloAcesso } from "@/lib/acesso";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import PageContainer from "./page-container";

type HubCard = {
  href: string;
  titulo: string;
  descricao: string;
  Icon: typeof ClipboardList;
  cor: string;
  modulo?: ModuloAcesso;
};

function formatarDataCurta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMaisDias(baseISO: string, dias: number): string {
  const [y, m, d] = baseISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role, voluntario_id")
    .eq("id", user.id)
    .single();

  const meuVoluntarioId = profile?.voluntario_id ?? null;
  const nome = displayName(profile ?? { email: user.email ?? "" });
  const primeiroNome = nome.split(" ")[0] || nome;

  const { data: cargosRaw } = await supabase.rpc("meus_cargos");
  const acesso: Acesso = {
    role: (profile?.role as Acesso["role"]) ?? null,
    cargos: (cargosRaw ?? []) as Acesso["cargos"],
  };
  const pode = (modulo?: ModuloAcesso) =>
    !modulo || podeAcessar(acesso, modulo) !== false;

  const isCoordenadorGeral = profile?.role === "coordenador_geral";

  const today = hojeISO();
  const em7 = isoMaisDias(today, 7);

  // ── Minhas demandas (ativas) ──
  let minhasAtrasadas = 0;
  let minhasHoje = 0;
  let minhasSemana = 0;
  let minhasTotal = 0;

  if (meuVoluntarioId !== null) {
    const { data: vinculos } = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .eq("voluntario_id", meuVoluntarioId);
    const idsPorVoluntario = (vinculos ?? []).map((v) => v.demanda_id);

    const { data: vinculosPerfil } = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .eq("profile_id", user.id);
    const idsPorPerfil = (vinculosPerfil ?? []).map((v) => v.demanda_id);

    const meusIds = [...new Set([...idsPorVoluntario, ...idsPorPerfil])];
    if (meusIds.length > 0) {
      const { data: minhas } = await supabase
        .from("demandas_com_status")
        .select("id, prazo, atrasada")
        .in("id", meusIds)
        .neq("status", "concluida");
      const rows = minhas ?? [];
      minhasTotal = rows.length;
      minhasAtrasadas = rows.filter((r) => r.atrasada).length;
      minhasHoje = rows.filter((r) => r.prazo === today).length;
      minhasSemana = rows.filter(
        (r) => r.prazo > today && r.prazo <= em7
      ).length;
    }
  }

  // ── Próximos eventos + pautas + atrasadas gerais ──
  const [{ data: proximosEventos }, { data: pautasPendentes }, atrasadasGeralResult] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("id, titulo, data_evento, local")
        .gte("data_evento", today)
        .order("data_evento", { ascending: true })
        .limit(3),
      supabase
        .from("pautas")
        .select("id", { count: "exact", head: false })
        .eq("status", "pendente")
        .eq("stand_by", false)
        .limit(1),
      isCoordenadorGeral
        ? supabase
            .from("demandas_com_status")
            .select("id", { count: "exact", head: true })
            .eq("atrasada", true)
        : Promise.resolve({ count: 0 as number | null }),
    ]);

  const eventos = (proximosEventos ?? []).map((e) => ({
    id: e.id,
    titulo: String(e.titulo),
    data: String(e.data_evento),
    local: e.local ? String(e.local) : null,
  }));
  const pautasCount = (pautasPendentes ?? []).length;
  const atrasadasGeral =
    typeof atrasadasGeralResult.count === "number"
      ? atrasadasGeralResult.count
      : 0;

  const proxima = proximaTerca();
  const proximaLabel = proxima.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  const minhasHref =
    meuVoluntarioId !== null
      ? `/demandas?responsavel=${meuVoluntarioId}`
      : "/demandas";

  const cards = [
    {
      href: minhasHref,
      titulo: "Minhas demandas",
      descricao: "Suas tarefas, prazos e o que está com você",
      Icon: ClipboardList,
      cor: "bg-[#2195B9]",
      modulo: "demandas" as ModuloAcesso,
    },
    {
      href: "/reunioes",
      titulo: "Pedir pauta",
      descricao: `Sugira um assunto para terça ${proximaLabel} às ${HORARIO_REUNIAO}`,
      Icon: MessageSquarePlus,
      cor: "bg-[#FDBA2F]",
      modulo: "reunioes" as ModuloAcesso,
    },
    {
      href: "/eventos",
      titulo: "Ver eventos",
      descricao: "Agenda da instituição e próximos eventos",
      Icon: CalendarDays,
      cor: "bg-[#28627B]",
      modulo: "eventos" as ModuloAcesso,
    },
    {
      href: "/reunioes?tab=atas",
      titulo: "Reuniões e atas",
      descricao: "Histórico, decisões e o que foi combinado",
      Icon: NotebookPen,
      cor: "bg-[#7c3aed]",
      modulo: "reunioes" as ModuloAcesso,
    },
    {
      href: "/trilha",
      titulo: "Trilha dos Saberes",
      descricao: "Sua progressão de conhecimento",
      Icon: Map,
      cor: "bg-[#16a34a]",
      modulo: "voluntarios" as ModuloAcesso,
    },
    {
      href: "/utilidades",
      titulo: "Materiais e utilidades",
      descricao: "Documentos, logos, fichas e links úteis",
      Icon: Wrench,
      cor: "bg-[#ea580c]",
      modulo: "utilidades" as ModuloAcesso,
    },
  ].filter((c) => pode(c.modulo));

  return (
    <PageContainer>
      <header className="flex w-full flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Olá, {primeiroNome}
        </h1>
        <p className="text-base text-slate-500 sm:text-lg">
          O que você quer fazer hoje?
        </p>
      </header>

      {/* ── Hoje pra você: caixa de entrada resumida ── */}
      <section
        aria-label="Hoje pra você"
        className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Link
          href={minhasHref}
          className="flex min-h-24 flex-col justify-between gap-1 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 transition-all hover:ring-[#2195B9]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <AlertTriangle
              size={16}
              aria-hidden="true"
              className={minhasAtrasadas > 0 ? "text-red-600" : "text-slate-400"}
            />
            Atrasadas comigo
          </span>
          <span
            className={`text-3xl font-bold tracking-tight ${minhasAtrasadas > 0 ? "text-red-700" : "text-slate-900"}`}
          >
            {minhasAtrasadas}
          </span>
          <span className="text-sm text-slate-500">
            {minhasTotal === 0
              ? "Nada pendente — aproveite"
              : `${minhasTotal} ativa${minhasTotal === 1 ? "" : "s"} no total`}
          </span>
        </Link>

        <Link
          href={minhasHref}
          className="flex min-h-24 flex-col justify-between gap-1 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 transition-all hover:ring-[#2195B9]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Clock size={16} aria-hidden="true" className="text-[#2195B9]" />
            Vencem esta semana
          </span>
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {minhasHoje + minhasSemana}
          </span>
          <span className="text-sm text-slate-500">
            {minhasHoje > 0
              ? `${minhasHoje} vencendo hoje`
              : "Nada vencendo hoje"}
          </span>
        </Link>

        <Link
          href="/eventos"
          className="flex min-h-24 flex-col justify-between gap-1 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 transition-all hover:ring-[#2195B9]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <CalendarDays size={16} aria-hidden="true" className="text-[#28627B]" />
            Próximo evento
          </span>
          {eventos.length === 0 ? (
            <>
              <span className="text-lg font-bold text-slate-900">
                Nenhum evento
              </span>
              <span className="text-sm text-slate-500">Ver agenda</span>
            </>
          ) : (
            <>
              <span className="truncate text-lg font-bold text-slate-900" title={eventos[0].titulo}>
                {eventos[0].titulo}
              </span>
              <span className="text-sm text-slate-500">
                {formatarDataCurta(eventos[0].data)}
                {eventos[0].local ? ` · ${eventos[0].local}` : ""}
                {eventos.length > 1 ? ` (+${eventos.length - 1})` : ""}
              </span>
            </>
          )}
        </Link>

        <Link
          href="/reunioes"
          className="flex min-h-24 flex-col justify-between gap-1 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 transition-all hover:ring-[#2195B9]/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <MessageSquarePlus size={16} aria-hidden="true" className="text-amber-600" />
            Próxima reunião
          </span>
          <span className="text-lg font-bold text-slate-900">
            Terça {proximaLabel} · {HORARIO_REUNIAO}
          </span>
          <span className="text-sm text-slate-500">
            {pautasCount === 0
              ? "Sem pautas — seja o primeiro"
              : `${pautasCount} pauta${pautasCount === 1 ? "" : "s"} na fila`}
          </span>
        </Link>
      </section>

      {/* ── Faixa do coordenador: visão macro sem poluir o voluntário ── */}
      {isCoordenadorGeral && (
        <Link
          href="/painel"
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[#2195B9] to-[#28627B] px-5 py-4 text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all hover:shadow-[0_4px_12px_rgba(33,149,185,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <LayoutDashboard size={22} aria-hidden="true" className="shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-semibold leading-tight">
              Painel do coordenador
            </span>
            <span className="text-sm text-white/90">
              {atrasadasGeral > 0
                ? `${atrasadasGeral} demanda${atrasadasGeral === 1 ? " atrasada" : "s atrasadas"} na instituição — ver por área e responsável`
                : "Visão geral por área, responsável e atrasadas"}
            </span>
          </span>
          <ArrowRight size={20} aria-hidden="true" className="shrink-0" />
        </Link>
      )}

      {/* ── Cardzinhos de ação ── */}
      <section aria-label="O que você quer fazer" className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Escolha por onde começar
        </h2>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ href, titulo, descricao, Icon, cor }) => (
            <Link
              key={titulo + href}
              href={href}
              className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#2195B9]/30 hover:bg-[#2195B9]/5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] active:scale-[0.99] sm:min-h-28 sm:p-5"
            >
              <span
                className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:size-16 ${cor}`}
                aria-hidden="true"
              >
                <Icon size={28} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xl font-semibold leading-tight text-zinc-900 group-hover:text-[#2195B9]">
                  {titulo}
                </span>
                <span className="text-base leading-snug text-zinc-500">
                  {descricao}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400 transition-colors group-hover:bg-[#2195B9] group-hover:text-white"
              >
                ›
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
