import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { roleLabel } from "@/lib/role-labels";
import PageContainer from "../page-container";

type VoluntarioRow = {
  id: number;
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  obs: string | null;
  area_atuacao: string | null;
  role: string | null;
  ativo: boolean;
  profiles:
    | { email: string; role: string }[]
    | { email: string; role: string }
    | null;
};

function formatData(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export default function MeuCadastroCard({ row, role }: { row: VoluntarioRow; role: string }) {
  const linked = !row.profiles ? null : Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return (
    <PageContainer>
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-[#d4883a]" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">Meu cadastro</h2>
        </div>
        <div className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold text-zinc-900">{row.nome}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
              {roleLabel(linked?.role ?? role)}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["Cód. PF", row.codigo_pf],
              ["Unidade", row.unidade],
              ["Org Depto", row.org_depto],
              ["Função", row.funcao],
              ["Data de início", formatData(row.data_inicio)],
              ["Data de saída", formatData(row.data_saida)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">{label}</dt>
                <dd className="text-xl text-zinc-900">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {row.obs && <p className="text-base text-zinc-600">Obs: {row.obs}</p>}
        </div>
      </div>
    </PageContainer>
  );
}
