"use client";

import { useActionState } from "react";
import { confirmUnsubscribe, type UnsubscribeState } from "./actions";

const initial: UnsubscribeState = { ok: false, message: "", done: false };

export default function DescadastrarFormClient({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmUnsubscribe, initial);

  if (state.done) {
    return (
      <p className={`text-xl ${state.ok ? "text-emerald-700" : "text-red-600"}`} role={state.ok ? "status" : "alert"}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-4">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-8 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]"
      >
        {pending ? "Confirmando…" : "Sim, não quero mais receber"}
      </button>
      {state.message && <p className="text-lg text-red-600" role="alert">{state.message}</p>}
    </form>
  );
}
