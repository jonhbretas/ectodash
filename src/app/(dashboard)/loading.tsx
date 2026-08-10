// Loading UI for every route inside the dashboard group — shown instantly
// during client-side navigation (view toggle, filters, sidebar links) while
// the server re-renders the page. Without it, switching to the Kanban view
// (the heaviest, it re-fetches every demanda) leaves the screen frozen with
// no feedback.
export default function DashboardLoading() {
  return (
    <main
      id="main-content"
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-zinc-200/80" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-zinc-100" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-10 w-24 animate-pulse rounded-xl bg-zinc-200/80" />
          <div className="h-10 w-44 animate-pulse rounded-xl bg-zinc-200/80" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-zinc-200/80" />
        </div>
      </div>

      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-zinc-200/80" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-72 flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60"
            >
              <div className="h-5 w-28 animate-pulse rounded-lg bg-zinc-200/80" />
              <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
              <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
