"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// This is the ONLY code path in the application permitted to end a session:
// D-03 forbids any idle timeout, maximum session age, or scheduled
// re-authentication. The signed-in "Sair" control (sign-out-button.tsx) is
// the sole caller of this action.
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
