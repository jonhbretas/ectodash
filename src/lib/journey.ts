export type JourneyTrack = "voluntario" | "docente" | "sistema";
export type JourneyStep = {
  id: string;
  title: string;
  description: string;
  track: JourneyTrack;
  href: string;
  points: number;
};

const volunteerStages = [
  ["boas-vindas", "Recepção e Integração", "Conheça a instituição e seus primeiros passos."],
  ["fundamentos", "Fundamentos do Conhecimento", "Descubra a base da sua formação."],
  ["intermediario", "Aprofundamento e Prática", "Conecte aprendizado e atuação voluntária."],
  ["docencia", "Docência e Mediação", "Conheça o caminho para compartilhar saberes."],
  ["especializacao", "Especialização e Liderança", "Explore novas formas de contribuir."],
];

const teacherStages = [
  ["livro", "Leitura do Livro", "Conheça a leitura que inicia a jornada docente."],
  ["curso-ead", "Ectoplasmia Interassistencial", "Explore a formação a distância."],
  ["curso-autoorg", "Auto-Organização Bioenergética", "Conheça a etapa de participação e prática."],
  ["proep", "Caminho PROEP", "Da participação ativa às aulas-treino."],
  ["ogb", "Caminho OGB", "Conheça a atuação como Professor 2."],
  ["dip", "Caminho DIP", "Explore a atuação docente na DIP."],
  ["proposicao", "Proposição de Curso", "Descubra como propor um novo curso."],
];

export const journeySteps: JourneyStep[] = [
  ...volunteerStages.map(([id, title, description]) => ({
    id: `voluntario:${id}`, title, description, track: "voluntario" as const,
    href: `/trilha?tab=voluntario&etapa=${id}`, points: 20,
  })),
  ...teacherStages.map(([id, title, description]) => ({
    id: `docente:${id}`, title, description, track: "docente" as const,
    href: `/trilha?tab=docente&etapa=${id}`, points: 20,
  })),
  { id: "sistema:perfil", title: "Conheça seu perfil", description: "Veja seus dados e vínculos.", track: "sistema", href: "/perfil", points: 10 },
  { id: "sistema:eventos", title: "Explore a agenda", description: "Descubra os próximos eventos.", track: "sistema", href: "/eventos", points: 10 },
  { id: "sistema:utilidades", title: "Descubra os materiais", description: "Encontre documentos e recursos úteis.", track: "sistema", href: "/utilidades", points: 10 },
];

export function journeySummary(completedIds: string[], steps = journeySteps) {
  const completed = new Set(completedIds);
  const done = steps.filter((step) => completed.has(step.id));
  return {
    done: done.length,
    total: steps.length,
    points: done.reduce((total, step) => total + step.points, 0),
    percent: steps.length ? Math.round(done.length / steps.length * 100) : 0,
    next: steps.find((step) => !completed.has(step.id)),
  };
}
