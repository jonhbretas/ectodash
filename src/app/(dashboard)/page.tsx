import { createClient } from "@/lib/supabase/server";

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

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-zinc-900">Olá, {email}</h1>
      <p className="text-xl text-zinc-700">
        As demandas da instituição vão aparecer aqui em uma fase futura.
      </p>
    </main>
  );
}
