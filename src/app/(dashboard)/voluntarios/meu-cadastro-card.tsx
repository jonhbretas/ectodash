import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail } from "lucide-react";
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
  telefone_1: string | null;
  telefone_2: string | null;
  profiles:
    | { email: string; role: string }[]
    | { email: string; role: string }
    | null;
};

function phoneToWhatsApp(phone: string): string {
  return phone.replace(/\D/g, "");
}

function PhoneLink({ phone, label }: { phone: string; label: string }) {
  const digits = phoneToWhatsApp(phone);
  if (!digits || digits.length < 8) return null;
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-lg text-[#d4883a] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
    >
      <Phone size={14} aria-hidden="true" />
      {label}: {phone}
    </a>
  );
}

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
            {row.telefone_1 && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">Telefone 1</dt>
                <dd className="text-xl">
                  <PhoneLink phone={row.telefone_1} label="Tel 1" />
                </dd>
              </div>
            )}
            {row.telefone_2 && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-base text-zinc-500">Telefone 2</dt>
                <dd className="text-xl">
                  <PhoneLink phone={row.telefone_2} label="Tel 2" />
                </dd>
              </div>
            )}
          </dl>
          {row.obs && <p className="text-base text-zinc-600">Obs: {row.obs}</p>}
        </div>
      </div>
    </PageContainer>
  );
}
