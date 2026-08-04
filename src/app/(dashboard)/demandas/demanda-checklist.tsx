"use client";

// Trello-style checklist on the demanda edit screen. Toggles are instant
// (optimistic via local state) and reconciled by router.refresh(); add and
// remove are server-action forms.
import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CheckCheck, Plus, X } from "lucide-react";
import {
  adicionarItemChecklist,
  alternarItemChecklist,
  removerItemChecklist,
} from "./checklist-actions";

export type ChecklistItem = {
  id: number;
  item: string;
  concluido: boolean;
};

export type DemandaChecklistProps = {
  demandaId: number;
  items: ChecklistItem[];
};

const checklistInitial = { ok: false, message: "" };

function AddItemFields() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-2">
      <input
        id="item"
        name="item"
        required
        placeholder="Adicionar item..."
        disabled={pending}
        className="min-h-12 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white transition-all duration-200 hover:bg-blue-600 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
        aria-label="Adicionar item ao checklist"
      >
        <Plus size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function DemandaChecklist({
  demandaId,
  items,
}: DemandaChecklistProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [localItems, setLocalItems] = useState(items);
  const [addState, addFormAction] = useActionState(
    adicionarItemChecklist.bind(null, demandaId),
    checklistInitial
  );

  const done = localItems.filter((i) => i.concluido).length;
  const total = localItems.length;

  function toggle(itemId: number, concluido: boolean) {
    setLocalItems((current) =>
      current.map((i) => (i.id === itemId ? { ...i, concluido } : i))
    );
    startTransition(async () => {
      const result = await alternarItemChecklist(itemId, concluido);
      if (!result.ok) {
        setError(result.message);
      }
      router.refresh();
    });
  }

  function remove(itemId: number) {
    startTransition(async () => {
      const result = await removerItemChecklist(itemId);
      if (!result.ok) {
        setError(result.message);
      }
      router.refresh();
    });
  }

  return (
    <section
      className="flex w-full flex-col gap-4"
      aria-label="Checklist da demanda"
    >
      <h2 className="flex items-center justify-between text-xl font-semibold text-zinc-900">
        <span className="flex items-center gap-2">
          <CheckCheck size={20} aria-hidden="true" className="text-zinc-400" />
          Checklist
        </span>
        {total > 0 && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
            {done}/{total}
          </span>
        )}
      </h2>

      {total === 0 ? (
        <p className="text-base text-zinc-400">
          Nenhum item ainda — adicione abaixo.
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl ring-1 ring-zinc-200/60">
          {localItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-zinc-100 bg-white px-4 py-3 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={item.concluido}
                onChange={(e) => toggle(item.id, e.target.checked)}
                disabled={pending}
                className="h-5 w-5 shrink-0 rounded accent-blue-700"
                aria-label={`Marcar "${item.item}"`}
              />
              <span
                className={`flex-1 text-lg transition-colors duration-200 ${
                  item.concluido
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900"
                }`}
              >
                {item.item}
              </span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={pending}
                aria-label={`Remover item "${item.item}"`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-30"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        action={addFormAction}
        className="flex flex-col gap-1"
        aria-live="polite"
      >
        <AddItemFields />
        {addState.message && (
          <p className="text-base text-red-600">{addState.message}</p>
        )}
        {error && <p className="text-base text-red-600">{error}</p>}
      </form>
    </section>
  );
}
