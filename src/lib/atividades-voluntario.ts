// src/lib/atividades-voluntario.ts
// Catálogo das atividades de conscienciologia que cada voluntário marca no
// próprio perfil (migration 0026). Compartilhado entre a UI (checkboxes) e
// a validação da server action — os valores são a fonte única da verdade.
export const ATIVIDADES_VOLUNTARIO = [
  { value: "tenepes", label: "Praticante de Tenepes" },
  { value: "docente_conscienciologia", label: "Docente de Conscienciologia" },
  { value: "verbete", label: "Verbete" },
  { value: "artigo", label: "Artigo" },
  { value: "curso_livre", label: "Curso Livre" },
  { value: "autor", label: "Autor" },
  { value: "co_autor", label: "Co-Autor" },
  { value: "pesquisa_laboratorial", label: "Pesquisa Laboratorial" },
] as const;

export type AtividadeVoluntarioValue =
  (typeof ATIVIDADES_VOLUNTARIO)[number]["value"];

export const ATIVIDADE_LABEL: Record<AtividadeVoluntarioValue, string> =
  Object.fromEntries(
    ATIVIDADES_VOLUNTARIO.map((a) => [a.value, a.label])
  ) as Record<AtividadeVoluntarioValue, string>;
