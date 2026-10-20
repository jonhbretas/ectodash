import Link from "next/link";
import { BarChart3, CalendarCheck, CircleAlert, ClipboardCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../../page-container";

type Params = { localidade?: string | string[] };

function dataBr(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${data}T00:00:00`));
}

function funcaoBase(funcao: string) {
  return funcao.replace(/ \d+$/, "");
}

export default async function AnaliseDipPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const localidadeParam = typeof params.localidade === "string" ? params.localidade : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canView = profile?.role === "coordenador_geral" || profile?.role === "voluntariado";
  if (!canView) redirect("/voluntarios/escala");

  const { data: localidades } = await supabase.from("voluntario_localidades").select("nome").order("nome");
  const nomesLocalidades = (localidades ?? []).map((item) => item.nome);
  const localidade = nomesLocalidades.includes(localidadeParam) ? localidadeParam : "";
  let escalasQuery = supabase
    .from("escala_semanal")
    .select("id, data_semana, localidade, status")
    .neq("status", "cancelada")
    .order("data_semana", { ascending: false });
  if (localidade) escalasQuery = escalasQuery.eq("localidade", localidade);
  const { data: escalas } = await escalasQuery;
  const escalaIds = (escalas ?? []).map((escala) => escala.id);
  const [alocacoesResult, ausenciasResult] = escalaIds.length
    ? await Promise.all([
        supabase.from("escala_alocacao").select("escala_id, funcao, voluntario_id, efetivado, voluntarios!escala_alocacao_voluntario_id_fkey(nome)").in("escala_id", escalaIds),
        supabase.from("escala_ausencia").select("escala_id, voluntario_id, voluntarios(nome)").in("escala_id", escalaIds),
      ])
    : [{ data: [] }, { data: [] }];

  type Participante = { nome: string; escalas: Set<number>; funcoes: Map<string, number>; faltas: number; efetivadas: number };
  const participantes = new Map<number, Participante>();
  function participante(id: number, nome: string) {
    const atual = participantes.get(id);
    if (atual) return atual;
    const novo: Participante = { nome, escalas: new Set(), funcoes: new Map(), faltas: 0, efetivadas: 0 };
    participantes.set(id, novo);
    return novo;
  }
  for (const alocacao of alocacoesResult.data ?? []) {
    const vol = Array.isArray(alocacao.voluntarios) ? alocacao.voluntarios[0] : alocacao.voluntarios;
    const item = participante(alocacao.voluntario_id, vol?.nome ?? "Voluntário removido");
    item.escalas.add(alocacao.escala_id);
    const funcao = funcaoBase(alocacao.funcao);
    item.funcoes.set(funcao, (item.funcoes.get(funcao) ?? 0) + 1);
    if (alocacao.efetivado) item.efetivadas += 1;
  }
  for (const ausencia of ausenciasResult.data ?? []) {
    const vol = Array.isArray(ausencia.voluntarios) ? ausencia.voluntarios[0] : ausencia.voluntarios;
    participante(ausencia.voluntario_id, vol?.nome ?? "Voluntário removido").faltas += 1;
  }
  const linhas = [...participantes.entries()]
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.escalas.size - a.escalas.size || a.nome.localeCompare(b.nome, "pt-BR"));
  const totalAlocacoes = (alocacoesResult.data ?? []).length;
  const totalFaltas = (ausenciasResult.data ?? []).length;
  const totalEfetivadas = (alocacoesResult.data ?? []).filter((item) => item.efetivado).length;

  return (
    <PageContainer>
      <Link href="/voluntarios/escala" className="inline-flex w-fit items-center gap-1.5 text-base font-medium text-[#2195B9] hover:text-[#28627B]">← Voltar para Escala da DIP</Link>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900"><BarChart3 size={30} /> Análise da DIP</h1>
          <p className="mt-1 text-lg text-zinc-500">Panorama de participação, funções exercidas, faltas e efetivação por localidade.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/voluntarios/escala/analise">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">Localidade
            <select name="localidade" defaultValue={localidade} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900">
              <option value="">Todas as localidades</option>
              {nomesLocalidades.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </label>
          <button className="min-h-11 rounded-lg bg-[#2195B9] px-4 text-base font-semibold text-white hover:bg-[#28627B]">Atualizar</button>
        </form>
      </header>

      <section aria-label="Resumo da localidade" className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumo icon={CalendarCheck} label="Escalas analisadas" value={String(escalas?.length ?? 0)} detail={localidade || "Todas as localidades"} tone="blue" />
        <Resumo icon={Users} label="Participantes escalados" value={String(linhas.length)} detail={`${totalAlocacoes} alocações`} tone="violet" />
        <Resumo icon={CircleAlert} label="Faltas registradas" value={String(totalFaltas)} detail="Ausências informadas" tone="amber" />
        <Resumo icon={ClipboardCheck} label="Funções efetivadas" value={String(totalEfetivadas)} detail={totalAlocacoes ? `${Math.round((totalEfetivadas / totalAlocacoes) * 100)}% das alocações` : "Sem alocações"} tone="green" />
      </section>

      <section className="w-full overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/60">
        <div className="border-b border-zinc-100 px-5 py-4"><h2 className="text-xl font-semibold text-zinc-900">Participação por pessoa</h2><p className="text-sm text-zinc-500">Use as faltas e as funções recorrentes para equilibrar as próximas escalas.</p></div>
        {linhas.length === 0 ? <p className="px-5 py-14 text-center text-lg text-zinc-500">Ainda não há dados de escala para este recorte.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-left"><thead><tr className="border-b border-zinc-100 text-sm uppercase tracking-wide text-zinc-500"><th className="px-5 py-3 font-medium">Participante</th><th className="px-4 py-3 text-center font-medium">Escalas</th><th className="px-4 py-3 text-center font-medium">Faltas</th><th className="px-4 py-3 text-center font-medium">Efetivadas</th><th className="px-4 py-3 font-medium">Funções exercidas</th></tr></thead><tbody>{linhas.map((item) => <tr key={item.id} className="border-b border-zinc-100 last:border-0"><td className="px-5 py-3 text-base font-semibold text-zinc-900">{item.nome}</td><td className="px-4 py-3 text-center text-zinc-700">{item.escalas.size}</td><td className={`px-4 py-3 text-center font-medium ${item.faltas ? "text-red-700" : "text-zinc-500"}`}>{item.faltas}</td><td className="px-4 py-3 text-center text-emerald-700">{item.efetivadas}</td><td className="px-4 py-3 text-sm text-zinc-600">{[...item.funcoes.entries()].map(([funcao, total]) => `${funcao} (${total}×)`).join(" · ")}</td></tr>)}</tbody></table></div>
        )}
      </section>
      {(escalas ?? []).length > 0 && <p className="w-full text-sm text-zinc-500">Período analisado: {dataBr(escalas![escalas!.length - 1].data_semana)} a {dataBr(escalas![0].data_semana)}. Escalas canceladas não entram no panorama.</p>}
    </PageContainer>
  );
}

function Resumo({ icon: Icon, label, value, detail, tone }: { icon: typeof CalendarCheck; label: string; value: string; detail: string; tone: "blue" | "violet" | "amber" | "green" }) {
  const classes = { blue: "bg-sky-50 text-sky-700 ring-sky-200/60", violet: "bg-violet-50 text-violet-700 ring-violet-200/60", amber: "bg-amber-50 text-amber-700 ring-amber-200/60", green: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" };
  return <div className={`rounded-2xl p-4 ring-1 ${classes[tone]}`}><Icon size={20} aria-hidden="true" /><p className="mt-3 text-sm font-medium opacity-80">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-sm opacity-80">{detail}</p></div>;
}
