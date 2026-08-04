"use client";

import { concludeDemanda } from "./actions";

// A single-tap "Marcar como concluída" action, separate from the edit form's
// own Salvar/Cancelar flow — sets status to concluída immediately without
// requiring the user to first save whatever else is currently typed into the
// form, and without reopening the Status dropdown (04-UI-SPEC.md Screen
// Inventory -> 4. Edit form). No confirmation dialog: concluding is not
// framed as destructive in this phase's UI-SPEC, matching SignOutButton's
// simplicity.
export default function ConcludeButton({ demandaId }: { demandaId: number }) {
  // <form action> requires a (formData) => void | Promise<void> signature;
  // concludeDemanda(id) returns a typed state object for a future caller
  // that wants it, so the discard wrapper adapts one to the other without
  // changing concludeDemanda's own signature.
  async function concludeAction() {
    await concludeDemanda(demandaId);
  }

  return (
    <form action={concludeAction}>
      <button
        type="submit"
        className="min-h-14 w-full rounded-lg bg-green-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Marcar como concluída
      </button>
    </form>
  );
}
