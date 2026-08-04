import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import DemandaCard from "./demandas/demanda-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route, but a defensive null-check keeps
  // this Server Component correct if it's ever rendered without middleware
  // (e.g. a future test harness).
  if (!user) {
    return null;
  }

  // Exercises the RLS policy from plan 01-02 as a genuine authenticated
  // read — not just a session check.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email;

  // demandas_com_status, not the bare demandas table, is the read source
  // every later plan in this phase reuses — even though this plan does not
  // yet render the atrasada value (that's Plan 04-04's job).
  const { data: demandas } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo")
    .order("prazo", { ascending: true });

  const demandaIds = (demandas ?? []).map((demanda) => demanda.id);

  // A second query grouped client-side — demandas_com_status is a view over
  // demandas alone and doesn't expose the responsáveis join directly. This
  // is an accepted N+1-adjacent tradeoff for the tracer's small expected
  // data volume (documented as a known follow-up for Plan 04-04).
  const { data: responsaveis } =
    demandaIds.length > 0
      ? await supabase
          .from("demanda_responsaveis")
          .select("demanda_id, profiles(email)")
          .in("demanda_id", demandaIds)
      : { data: [] as { demanda_id: number; profiles: { email: string } | null }[] };

  const responsaveisPorDemanda = new Map<number, string[]>();
  for (const row of responsaveis ?? []) {
    const emails = responsaveisPorDemanda.get(row.demanda_id) ?? [];
    // Without generated Supabase types, the nested profiles select is typed
    // as a possible array even though the FK is one-to-one from this row's
    // perspective — normalize both shapes defensively.
    const profileRow = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    if (profileRow?.email) {
      emails.push(profileRow.email);
    }
    responsaveisPorDemanda.set(row.demanda_id, emails);
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-zinc-900">Olá, {email}</h1>
        <SignOutButton />
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-zinc-900">Demandas</h2>
        </div>

        <Link
          href="/demandas/nova"
          className="min-h-14 flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Nova demanda
        </Link>

        {demandas && demandas.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {demandas.map((demanda) => (
              <DemandaCard
                key={demanda.id}
                titulo={demanda.titulo}
                prazo={demanda.prazo}
                responsavelEmails={responsaveisPorDemanda.get(demanda.id) ?? []}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xl text-zinc-700">Nenhuma demanda ainda.</p>
        )}
      </div>
    </main>
  );
}
