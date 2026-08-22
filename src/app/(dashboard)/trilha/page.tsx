import { Map } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import TrailFlowchart from "./trail-flowchart";
import TrailDocenteFlowchart from "./trail-docente-flowchart";
import TrailTabs from "./trail-tabs";

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

function buildTrail(voluntarioId: number | null): TrailStage[] {
  return [
    {
      id: "boas-vindas",
      titulo: "Recepção e Integração",
      descricao: "Primeiros passos na instituição",
      icone: "book",
      cor: "from-[#2195B9] to-[#1a7a99]",
      categorias: [
        { nome: "Carta de Boas-vindas", concluido: true, detalhe: "Recebida" },
        { nome: "Apresentação da Instituição", concluido: true, detalhe: "15/03/2025" },
        { nome: "Tour pelas Áreas", concluido: true, detalhe: "Concluído" },
        { nome: "Cadastro no Sistema", concluido: true, detalhe: "Ativo" },
      ],
    },
    {
      id: "fundamentos",
      titulo: "Fundamentos do Conhecimento",
      descricao: "Cursos introdutórios e formação base",
      icone: "award",
      cor: "from-[#28627B] to-[#1e4d5e]",
      categorias: [
        { nome: "Ética e Valores Institucionais", concluido: true, detalhe: "40h" },
        { nome: "Metodologias de Trabalho", concluido: true, detalhe: "30h" },
        { nome: "Comunicação Assertiva", concluido: true, detalhe: "20h" },
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
        { nome: "Oficina Prática I", concluido: true, detalhe: "12h" },
        { nome: "Acompanhamento de Projeto", concluido: true, detalhe: "Em andamento" },
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

  const trail = buildTrail(selectedId ?? null);

  const totalItens = trail.reduce((acc, s) => acc + s.categorias.length, 0);
  const concluidos = trail.reduce(
    (acc, s) => acc + s.categorias.filter((c) => c.concluido).length,
    0
  );
  const percentual = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;

  const etapaAtual = trail.findIndex((s) =>
    s.categorias.some((c) => !c.concluido)
  );
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
                <span className="text-sm font-medium text-slate-500">Progresso Geral</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">{percentual}%</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#16a34a] to-[#059669]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Itens Concluídos</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">{concluidos}/{totalItens}</span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Etapa Atual</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">
                  {etapaIndex + 1}/{trail.length}
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(33,149,185,0.04)] ring-1 ring-zinc-200/60">
              <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#FDBA2F] to-[#e5a520]" />
              <div className="flex flex-col gap-1 p-5">
                <span className="text-sm font-medium text-slate-500">Próximo Marco</span>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  {trail[etapaIndex]?.titulo ?? "Trilha Completa"}
                </span>
              </div>
            </div>
          </div>
          <TrailFlowchart stages={trail} etapaAtual={etapaIndex} />
        </div>
        <TrailDocenteFlowchart />
      </TrailTabs>
    </PageContainer>
  );
}
