"use client";

import { concludeDemanda } from "./actions";

// A single-tap "Marcar como concluída" action, separate from the edit form's
// own Salvar/Cancelar flow — sets status to concluída immediately without
// requiring the user to first save whatever else is currently typed into the
// form, and without reopening the Status dropdown (04-UI-SPEC.md Screen
// Inventory -> 4. Edit form).
//
// UX-02 requires "confirmação clara em ações importantes" — concluding is
// exactly that, so a window.confirm() gate runs before the Server Action is
// ever called. Native confirm() is the locked, zero-dependency choice for
// this phase (05-RESEARCH.md/05-UI-SPEC.md); no new modal-dialog
// dependency (Radix-backed or otherwise) is introduced. This confirmation
// is UX polish only — RLS (plan 05-01's narrowed UPDATE policy) remains
// the actual authorization boundary regardless of whether the user
// confirms or cancels.
export default function ConcludeButton({ demandaId }: { demandaId: number }) {
  // <form action> requires a (formData) => void | Promise<void> signature;
  // concludeDemanda(id) returns a typed state object for a future caller
  // that wants it, so the discard wrapper adapts one to the other without
  // changing concludeDemanda's own signature.
  async function concludeAction() {
    if (!window.confirm("Marcar esta demanda como concluída?")) {
      return;
    }
    await concludeDemanda(demandaId);
  }

  return (
    <form action={concludeAction}>
      <button
        type="submit"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-xl font-medium text-white shadow-[0_1px_3px_rgba(21,128,61,0.2)] transition-all duration-200 hover:bg-green-500 hover:shadow-[0_2px_6px_rgba(21,128,61,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Marcar como concluída
      </button>
    </form>
  );
}
