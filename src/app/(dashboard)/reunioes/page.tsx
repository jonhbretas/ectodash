import Link from "next/link";
import { NotebookPen, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";

type AtaRow = {
  id: number;
  titulo: string;
  data_reuniao: string;
  resumo: string | null;
  criado_por: string;
};

export default async function ReunioesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // RLS (migration 0007): every authenticated volunteer can read every
  // ata — institution-wide shared knowledge, no role scoping needed here.
  const { data: atas } = await supabase
    .from("reunioes")
    .select("id, titulo, data_reuniao, resumo")
    .order("data_reuniao", { ascending: false });

  const rows: AtaRow[] = (atas ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    data_reuniao: row.data_reuniao,
    resumo: row.resumo,
    criado_por: "",
  }));

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <NotebookPen size={28} aria-hidden="true" />
          Atas de Reuniões
        </h1>
        <p className="text-base text-zinc-700">
          Registre e acompanhe as atas das reuniões da instituição.
        </p>
      </div>

      <Link
        href="/reunioes/nova"
        className="flex min-h-14 w-full max-w-4xl items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
      >
        <PlusCircle size={22} aria-hidden="true" />
        Registrar nova ata
      </Link>

      {rows.length === 0 ? (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <NotebookPen size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma ata registrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando uma reunião for registrada, a ata aparece aqui para toda a
            instituição.
          </p>
        </div>
      ) : (
        <div className="flex w-full max-w-4xl flex-col gap-4">
          {rows.map((ata) => (
            <article
              key={ata.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  {ata.titulo}
                </h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                  {format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              {ata.resumo ? (
                <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-700">
                  {ata.resumo}
                </p>
              ) : (
                <p className="text-base text-zinc-500">
                  Sem resumo registrado.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
