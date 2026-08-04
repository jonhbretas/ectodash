import Link from "next/link";
import { CalendarDays, MapPin, Settings2, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import ImportEventosForm from "./import-form";

type EventoRow = {
  id: number;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
  tipo_nome: string | null;
};

function formatDate(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export default async function EventosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isCoordenador = profile?.role === "coordenador_geral";

  // RLS (migration 0008): every authenticated volunteer reads every event.
  const [proximosResult, anterioresResult, tiposResult] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .gte("data_evento", today)
      .order("data_evento", { ascending: true })
      .limit(200),
    supabase
      .from("eventos")
      .select("id, titulo, descricao, data_evento, local, tipo_evento_id")
      .lt("data_evento", today)
      .order("data_evento", { ascending: false })
      .limit(50),
    supabase.from("evento_tipos").select("id, nome"),
  ]);

  const tipoNomeById = new Map(
    (tiposResult.data ?? []).map((tipo) => [tipo.id, tipo.nome])
  );

  const toRow = (row: {
    id: number;
    titulo: string;
    descricao: string | null;
    data_evento: string;
    local: string | null;
    tipo_evento_id: number | null;
  }): EventoRow => ({
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    data_evento: row.data_evento,
    local: row.local,
    tipo_nome: row.tipo_evento_id
      ? (tipoNomeById.get(row.tipo_evento_id) ?? null)
      : null,
  });

  const proximos: EventoRow[] = (proximosResult.data ?? []).map(toRow);
  const anteriores: EventoRow[] = (anterioresResult.data ?? []).map(toRow);

  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <CalendarDays size={28} aria-hidden="true" />
          Eventos
        </h1>
        <p className="text-base text-zinc-700">
          Próximos eventos da instituição.
        </p>
      </div>

      <ImportEventosForm />

      {isCoordenador && (
        <Link
          href="/eventos/modelos"
          className="flex min-h-14 w-full max-w-4xl items-center justify-center gap-2 rounded-xl border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
        >
          <Settings2 size={22} aria-hidden="true" />
          Configurar modelos de eventos
        </Link>
      )}

      {proximos.length === 0 && anteriores.length === 0 ? (
        <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
          <CalendarDays size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhum evento cadastrado ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Cadastre os eventos pela planilha acima — e lembre que uma
            demanda pode ser vinculada a um evento na hora de criá-la.
          </p>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Criar demanda
          </Link>
        </div>
      ) : (
        <div className="flex w-full max-w-4xl flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-zinc-900">
              Próximos eventos
            </h2>
            {proximos.length === 0 ? (
              <p className="text-xl text-zinc-700">
                Nenhum evento futuro cadastrado.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {proximos.map((evento) => (
                  <Link
                    key={evento.id}
                    href={`/eventos/${evento.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl font-semibold text-zinc-900">
                        {evento.titulo}
                      </h3>
                      <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                        {formatDate(evento.data_evento)}
                      </span>
                    </div>
                    {evento.tipo_nome && (
                      <span className="flex w-fit items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-base font-medium text-purple-800">
                        <Tag size={14} aria-hidden="true" />
                        {evento.tipo_nome}
                      </span>
                    )}
                    {evento.local && (
                      <p className="flex items-center gap-1 text-base text-zinc-700">
                        <MapPin size={16} aria-hidden="true" />
                        {evento.local}
                      </p>
                    )}
                    {evento.descricao && (
                      <p className="text-base leading-relaxed text-zinc-700">
                        {evento.descricao}
                      </p>
                    )}
                    <span className="text-base font-medium text-blue-700 underline">
                      Gerenciar evento
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {anteriores.length > 0 && (
            <details className="group w-full">
              <summary className="min-h-14 cursor-pointer list-none text-2xl font-semibold text-zinc-900 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                Eventos anteriores ({anteriores.length})
              </summary>
              <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
                {anteriores.map((evento) => (
                  <div
                    key={evento.id}
                    className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-xl text-zinc-900">
                        {evento.titulo}
                      </span>
                      {evento.local && (
                        <span className="flex items-center gap-1 text-base text-zinc-700">
                          <MapPin size={14} aria-hidden="true" />
                          {evento.local}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-base text-zinc-700">
                      {formatDate(evento.data_evento)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </PageContainer>
  );
}
