"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { excluirAta } from "./actions";

export default function ExcluirAtaButton({ ataId, ataTitulo }: { ataId: number; ataTitulo: string }) {
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmado = window.confirm(
      `Excluir a ata "${ataTitulo}"?\n\nOs registros de DIP vinculados a ela também serão removidos. Esta ação não pode ser desfeita.`
    );
    if (!confirmado) {
      event.preventDefault();
      return;
    }
  }

  return (
    <form
      action={async (formData) => {
        await excluirAta(formData);
        router.push("/reunioes");
        router.refresh();
      }}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="id" value={ataId} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-xl font-medium text-red-700 transition-all duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
    >
      <Trash2 size={22} aria-hidden="true" />
      {pending ? "Excluindo..." : "Excluir ata"}
    </button>
  );
}
