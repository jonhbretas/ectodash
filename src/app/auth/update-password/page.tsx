import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpdatePasswordForm from "./update-password-form";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const type = params.type;

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (error) {
      redirect("/recuperar-senha?erro=link_invalido");
    }
  }

  return <UpdatePasswordForm />;
}
