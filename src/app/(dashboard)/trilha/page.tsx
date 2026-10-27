import { Map } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import TrailFlowchart from "./trail-flowchart";
import TrailDocenteFlowchart from "./trail-docente-flowchart";
import TrailTabs from "./trail-tabs";
import { journeySteps, journeySummary } from "@/lib/journey";

type TrailStage = {
  id: string;
  titulo: string;
  descricao: string;
  icone: "book" | "award" | "lightbulb" | "users" | "trophy";
  cor: string;
  categorias: {
    nome: string;
    concluido: boolean;
    detalhe?: string;
  }[];
};

function buildTrail(): TrailStage[] {
  return [
    {
      id: "boas-vindas",
      titulo: "Recepção e Integração",
      descricao: "Primeiros passos na instituição",
      icone: "book",
      cor: "from-[#2195B9] to-[#1a7a99]",
      categorias: [
        { nome: "Carta de Boas-vindas", concluido: false },
        { nome: "Apresentação da Instituição", concluido: false },
        { nome: "Tour pelas Áreas", concluido: false },
        { nome: "Cadastro no Sistema", concluido: false },
      ],
    },
    {
      id: "fundamentos",
      titulo: "Fundamentos do Conhecimento",
      descricao: "Cursos introdutórios e formação base",
      icone: "award",
      cor: "from-[#28627B] to-[#1e4d5e]",
      categorias: [
        { nome: "Ética e Valores Institucionais", concluido: false },
        { nome: "Metodologias de Trabalho", concluido: false },
        { nome: "Comunicação Assertiva", concluido: false },
        { nome: "Primeiros Socorros", concluido: false },
        { nome: "Gestão de Tempo", concluido: false },
      ],
    },
    {
      id: "intermediario",
      titulo: "Aprofundamento e Prática",
      descricao: "Aplicação do conhecimento em atividades reais",
      icone: "lightbulb",
      cor: "from-[#FDBA2F] to-[#e5a520]",
      categorias: [
        { nome: "Oficina Prática I", concluido: false },
        { nome: "Acompanhamento de Projeto", concluido: false },
        { nome: "Diário de Reflexão", concluido: false },
        { nome: "Mentoria com Coordenador", concluido: false },
      ],
    },
    {
      id: "docencia",
      titulo: "Docência e Mediação",
      descricao: "Ensinar é o mais alto nível de aprendizado",
      icone: "users",
      cor: "from-[#8b5cf6] to-[#7c3aed]",
      categorias: [
        { nome: "Observação de Aula", concluido: false },
        { nome: "Co-docência", concluido: false },
        { nome: "Preparação de Material", concluido: false },
        { nome: "Aula Autônoma", concluido: false },
      ],
    },
    {
      id: "especializacao",
      titulo: "Especialização e Liderança",
      descricao: "Referência em conhecimento e liderança",
      icone: "trophy",
      cor: "from-[#16a34a] to-[#0d8a3a]",
      categorias: [
        { nome: "Projeto Próprio", concluido: false },
        { nome: "Formação de Novos Voluntários", concluido: false },
        { nome: "Publicação / Apresentação", concluido: false },
        { nome: "Certificação Final", concluido: false },
      ],
    },
  ];
}

export default async function TrilhaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, voluntario_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const isCoord =
    role === "coordenador_geral" || role === "voluntariado" || role === "coordenador_area";

  const params = await searchParams;
  const selectedId = isCoord && params.voluntario
    ? Number(params.voluntario)
    : profile?.voluntario_id;

  let nomeVoluntario = "Voluntário";
  if (selectedId) {
    const { data: vol } = await supabase
      .from("voluntarios")
      .select("nome")
      .eq("id", selectedId)
      .maybeSingle();
    if (vol?.nome) nomeVoluntario = vol.nome.split(" ")[0];
  }

  const trail = buildTrail();
  const viewingOwnTrail = !params.voluntario || selectedId === profile?.voluntario_id;
  const progressResult = viewingOwnTrail
    ? await supabase.from("jornada_exploracao").select("etapa_id").eq("profile_id", user.id)
    : { data: [], error: null };
  const completedIds = (progressResult.data ?? []).map((row) => String(row.etapa_id));
  const volunteerSteps = journeySteps.filter((step) => step.track === "voluntario");
  const summary = journeySummary(completedIds, volunteerSteps);

  const totalItens = summary.total;
  const concluidos = summary.done;
  const percentual = summary.percent;
  const etapaAtual = trail.findIndex((stage) => !completedIds.includes(`voluntario:${stage.id}`));
  const etapaIndex = etapaAtual === -1 ? trail.length - 1 : etapaAtual;

  return (
    <PageContainer>
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <Map size={30} aria-hidden="true" className="text-[#2195B9]" />
            Trilha do Voluntário
          </h1>
          <p className="text-xl text-zinc-500">
            Progressão de conhecimento de <span className="font-medium text-[#2195B9]">{nomeVoluntario}</span>
          </p>
        </div>
      </header>

      <p className="rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 p-4 text-sm text-slate-700">
        {viewingOwnTrail
          ? "Explore o roteiro e confirme a leitura de cada etapa para avançar na sua jornada e ganhar XP. Este progresso registra exploração; a conclusão de cursos e os requisitos da formação são acompanhados separadamente."
          : "Você está consultando o roteiro de formação. O progresso de exploração é pessoal e aparece somente na própria conta."}
        {progressResult.error && " Seu progresso está temporariamente indisponível. Tente novamente mais tarde."}
      </p>

      <TrailTabs
        tabs={[
          { id: "voluntario", label: "Trilha Voluntário", icon: "users" },
          { id: "docente", label: "Trilha Docente", icon: "graduation" },
        ]}
      >
        <div>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#2195B9] to-[#FDBA2F]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Roteiro explorado</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">{viewingOwnTrail && !progressResult.error ? `${percentual}%` : "—"}</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#16a34a] to-[#059669]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Etapas exploradas</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">{viewingOwnTrail && !progressResult.error ? `${concluidos}/${totalItens}` : "—"}</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Etapas do roteiro</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {trail.length}
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#FDBA2F] to-[#e5a520]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Próxima descoberta</span>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  {viewingOwnTrail && !progressResult.error ? summary.next?.title ?? "Roteiro explorado!" : "Conheça as etapas"}
                </span>
              </div>
            </div>
          </div>
          <TrailFlowchart stages={trail} etapaAtual={etapaIndex} completedIds={viewingOwnTrail ? completedIds : undefined} />
        </div>
        <TrailDocenteFlowchart completedIds={viewingOwnTrail ? completedIds : undefined} />
      </TrailTabs>
    </PageContainer>
  );
}
