import {
  BookOpen,
  FileText,
  Image,
  GraduationCap,
  Link2,
  Wrench,
  Landmark,
  ClipboardList,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Visual de cada categoria do acervo de Links Úteis: ícone + cor própria para
// o usuário reconhecer o tipo do card de relance (sem precisar ler o rótulo).
// Classes Tailwind ficam como strings estáticas para o compilador enxergá-las.
export type CategoriaVisual = {
  label: string;
  icon: LucideIcon;
  // Faixa/ícone grande do card
  iconBg: string;
  iconText: string;
  // Chip pequeno (badge)
  chip: string;
  // Borda lateral do card
  border: string;
};

export const CATEGORIAS: Record<string, CategoriaVisual> = {
  ata_fundacao: {
    label: "Ata de Fundação",
    icon: Landmark,
    iconBg: "bg-amber-100",
    iconText: "text-amber-800",
    chip: "bg-amber-100 text-amber-900",
    border: "border-l-amber-500",
  },
  estatuto: {
    label: "Estatuto",
    icon: BookOpen,
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-800",
    chip: "bg-indigo-100 text-indigo-900",
    border: "border-l-indigo-500",
  },
  logo: {
    label: "Logos e Identidade Visual",
    icon: Image,
    iconBg: "bg-pink-100",
    iconText: "text-pink-800",
    chip: "bg-pink-100 text-pink-900",
    border: "border-l-pink-500",
  },
  ficha_proposicao: {
    label: "Ficha de Proposição de Curso",
    icon: ClipboardList,
    iconBg: "bg-teal-100",
    iconText: "text-teal-800",
    chip: "bg-teal-100 text-teal-900",
    border: "border-l-teal-500",
  },
  grade_curricular: {
    label: "Grade Curricular — IC",
    icon: GraduationCap,
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-800",
    chip: "bg-emerald-100 text-emerald-900",
    border: "border-l-emerald-500",
  },
  links_uteis: {
    label: "Sites e Links",
    icon: Link2,
    iconBg: "bg-sky-100",
    iconText: "text-sky-800",
    chip: "bg-sky-100 text-sky-900",
    border: "border-l-sky-500",
  },
  qualificacao_docente: {
    label: "Qualificação Docente",
    icon: Users,
    iconBg: "bg-violet-100",
    iconText: "text-violet-800",
    chip: "bg-violet-100 text-violet-900",
    border: "border-l-violet-500",
  },
  atividades_parapedagogicas: {
    label: "Atividades Parapedagógicas",
    icon: Sparkles,
    iconBg: "bg-orange-100",
    iconText: "text-orange-800",
    chip: "bg-orange-100 text-orange-900",
    border: "border-l-orange-500",
  },
  outro: {
    label: "Outros Documentos",
    icon: FileText,
    iconBg: "bg-zinc-100",
    iconText: "text-zinc-700",
    chip: "bg-zinc-100 text-zinc-800",
    border: "border-l-zinc-400",
  },
};

// Categorias livres (digitadas pelo usuário ou criadas pela IA) recebem uma
// cor estável derivada do nome, para continuarem distinguíveis entre si.
const PALETA_LIVRE: Omit<CategoriaVisual, "label" | "icon">[] = [
  { iconBg: "bg-cyan-100", iconText: "text-cyan-800", chip: "bg-cyan-100 text-cyan-900", border: "border-l-cyan-500" },
  { iconBg: "bg-lime-100", iconText: "text-lime-800", chip: "bg-lime-100 text-lime-900", border: "border-l-lime-600" },
  { iconBg: "bg-rose-100", iconText: "text-rose-800", chip: "bg-rose-100 text-rose-900", border: "border-l-rose-500" },
  { iconBg: "bg-fuchsia-100", iconText: "text-fuchsia-800", chip: "bg-fuchsia-100 text-fuchsia-900", border: "border-l-fuchsia-500" },
  { iconBg: "bg-yellow-100", iconText: "text-yellow-800", chip: "bg-yellow-100 text-yellow-900", border: "border-l-yellow-500" },
  { iconBg: "bg-blue-100", iconText: "text-blue-800", chip: "bg-blue-100 text-blue-900", border: "border-l-blue-500" },
];

function hash(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function categoriaInfo(categoria: string): CategoriaVisual {
  const conhecida = CATEGORIAS[categoria];
  if (conhecida) return conhecida;
  const cor = PALETA_LIVRE[hash(categoria.toLowerCase()) % PALETA_LIVRE.length];
  return { label: categoria, icon: Wrench, ...cor };
}

export const CATEGORIA_SUGGESTIONS = Object.values(CATEGORIAS).map((c) => c.label);
