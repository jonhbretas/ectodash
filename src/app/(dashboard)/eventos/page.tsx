import { CalendarDays } from "lucide-react";
import PageContainer from "../page-container";

// Eventos — designed empty state: the institution's calendar of events is
// a planned feature; this screen exists so the sidebar entry has a real
// destination and the roadmap item is visible from the app itself.
export default async function EventosPage() {
  return (
    <PageContainer>
      <div className="flex w-full max-w-4xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <CalendarDays size={28} aria-hidden="true" />
          Eventos
        </h1>
        <p className="text-base text-zinc-700">
          Agenda de eventos da instituição.
        </p>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
          <CalendarDays size={40} className="text-blue-700" aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-semibold text-zinc-900">
          A agenda de eventos está a caminho
        </h2>
        <p className="max-w-md text-xl text-zinc-700">
          Em breve você poderá cadastrar e acompanhar os eventos da
          instituição por aqui.
        </p>
      </div>
    </PageContainer>
  );
}
