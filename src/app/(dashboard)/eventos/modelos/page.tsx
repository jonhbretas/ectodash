import Link from "next/link";
import { Lock, Tag, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../../page-container";
import {
  CriarTipoForm,
  AdicionarTarefaForm,
  RemoverTarefaButton,
  RemoverTipoButton,
} from "../modelos-forms";

// Modelos de eventos — configuration screen for event types and their
// pre-defined task templates (user decision, 2026-08-04). Coordinator-only
// rendering; RLS on evento_tipos/modelo_tarefas is the real boundary.
export default async function ModelosEventosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Lock size={48} className="text-zinc-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold text-zinc-900">
            A configuração de modelos é exclusiva do coordenador
          </h1>
          <Link
            href="/eventos"
            className="flex min-h-14 items-center justify-center rounded-lg bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Voltar para os eventos
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [tiposResult, tarefasResult, areasResult] = await Promise.all([
    supabase.from("evento_tipos").select("id, nome").order("nome"),
    supabase
      .from("modelo_tarefas")
      .select("id, tipo_id, titulo, area, prazo_offset_dias, ordem")
      .order("ordem", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("areas_institucionais").select("nome").order("nome"),
  ]);

  const tarefasPorTipo = new Map<number, typeof tarefasResult.data>();
  for (const tarefa of tarefasResult.data ?? []) {
    const bucket = tarefasPorTipo.get(tarefa.tipo_id) ?? [];
    bucket.push(tarefa);
    tarefasPorTipo.set(tarefa.tipo_id, bucket);
  }

  const areaOptions = (areasResult.data ?? []).map((a) => a.nome);

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Tag size={28} aria-hidden="true" />
          Modelos de eventos
        </h1>
        <p className="text-base text-zinc-700">
          Cada tipo de evento (campo, online, live...) tem suas tarefas
          pré-definidas. Ao clicar em &quot;Adicionar tarefas do modelo&quot;
          dentro de um evento, todas elas viram demandas de uma vez.
        </p>
      </div>

      <CriarTipoForm />

      <div className="flex w-full max-w-4xl flex-col gap-6">
        {(tiposResult.data ?? []).map((tipo) => {
          const tarefas = tarefasPorTipo.get(tipo.id) ?? [];
          return (
            <section
              key={tipo.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-zinc-900">
                  {tipo.nome}
                </h2>
                <RemoverTipoButton tipoId={tipo.id} />
              </div>

              <p className="text-base text-zinc-700">
                {tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}{" "}
                no modelo.
              </p>

              {tarefas.length > 0 && (
                <div className="flex flex-col rounded-lg border border-zinc-200">
                  {tarefas.map((tarefa) => (
                    <div
                      key={tarefa.id}
                      className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-lg text-zinc-900">
                          <ClipboardList
                            size={16}
                            className="shrink-0 text-zinc-400"
                            aria-hidden="true"
                          />
                          <span className="truncate">{tarefa.titulo}</span>
                        </span>
                        <span className="text-base text-zinc-600">
                          {tarefa.area ? `Área: ${tarefa.area} · ` : ""}
                          {tarefa.prazo_offset_dias === 0
                            ? "no dia do evento"
                            : tarefa.prazo_offset_dias < 0
                              ? `${Math.abs(tarefa.prazo_offset_dias)} dias antes`
                              : `${tarefa.prazo_offset_dias} dias depois`}
                        </span>
                      </div>
                      <RemoverTarefaButton tarefaId={tarefa.id} />
                    </div>
                  ))}
                </div>
              )}

              <AdicionarTarefaForm tipoId={tipo.id} areaOptions={areaOptions} />
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}
