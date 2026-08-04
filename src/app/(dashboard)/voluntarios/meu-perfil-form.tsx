"use client";

// Self-service profile form — only the display name is editable (the
// SECURITY DEFINER function enforces exactly that). Role, área de atuação
// and ativo are coordinator-managed and shown read-only with a lock note.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarMeuPerfil } from "./actions";

const initialState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar nome"}
    </button>
  );
}

export default function MeuPerfilForm({ nomeAtual }: { nomeAtual: string }) {
  const [state, formAction] = useActionState(atualizarMeuPerfil, initialState);

  return (
    <form
      action={formAction}
      className="flex w-full max-w-md flex-col gap-4"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name" className="text-xl font-medium text-zinc-900">
          Nome completo
        </Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={nomeAtual}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      <SubmitButton />
      {state.message && (
        <p
          className={`text-base ${
            state.ok ? "text-green-800" : "text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
      <p className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-700">
        <Lock size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
        Papel, área de atuação e desativação são gerenciados pelo coordenador.
      </p>
    </form>
  );
}
