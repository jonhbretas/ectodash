"use client";

// Trello-style checklist on the demanda edit screen. Toggles and adds are
// instant (optimistic local state). Checkboxes never block — the user can
// keep clicking while the server confirms in the background. Adding an item
// shows it immediately; the server's revalidation eventually reconciles.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

// Counter for unique optimistic IDs (negative numbers so they never collide
// with real DB ids). Shared across renders via module-level.
let nextTempId = -1;

export default function DemandaChecklist({
  demandaId,
  items,
}: DemandaChecklistProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [addPending, setAddPending] = useState(false);

  // Optimistic toggle overrides — keyed by item ID.
  const [toggleOverrides, setToggleOverrides] = useState<
    Map<number, boolean>
  >(new Map());

  // Optimistic adds: items inserted before the server re-fetches.
  const [optimisticAdds, setOptimisticAdds] = useState<ChecklistItem[]>([]);

  // Remove optimistic entries that are now in the server data (display-only
  // filter — stale entries in state are harmless and cleaned up on the next
  // add/remove mutation).
  const serverIds = new Set((items ?? []).map((i) => i.id));
  const filteredAdds = optimisticAdds.filter((add) => !serverIds.has(add.id));

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(formData: FormData) {
    const text = (formData.get("item") as string)?.trim();
    if (!text) return;
    const tempId = nextTempId--;
    setOptimisticAdds((c) => [...c, { id: tempId, item: text, concluido: false }]);
    setAddPending(true);
    // Clear the input
    if (inputRef.current) inputRef.current.value = "";

    const result = await adicionarItemChecklist(demandaId, { ok: false, message: "" }, formData);
    setAddPending(false);
    if (!result.ok) {
      setError(result.message);
      setOptimisticAdds((c) => c.filter((add) => add.id !== tempId));
    } else {
      // Let server revalidation deliver the real row.
      startTransition(() => router.refresh());
    }
  }

  // Merge server items + toggle overrides + optimistic adds.
  const displayItems: ChecklistItem[] = (items ?? []).map((item) => ({
    ...item,
    concluido: toggleOverrides.has(item.id)
      ? toggleOverrides.get(item.id)!
      : item.concluido,
  }));
  for (const add of filteredAdds) {
    if (!serverIds.has(add.id)) {
      displayItems.push(add);
    }
  }

  const done = displayItems.filter((i) => i.concluido).length;
  const total = displayItems.length;

  function toggle(itemId: number, concluido: boolean) {
    setToggleOverrides((current) => {
      const next = new Map(current);
      next.set(itemId, concluido);
      return next;
    });
    alternarItemChecklist(itemId, concluido).then((result) => {
      if (!result.ok) {
        setError(result.message);
        setToggleOverrides((current) => {
          const next = new Map(current);
          next.delete(itemId);
          return next;
        });
      }
      startTransition(() => router.refresh());
    });
  }

  function removeItem(itemId: number) {
    setOptimisticAdds((c) => c.filter((add) => add.id !== itemId));
    setToggleOverrides((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    removerItemChecklist(itemId).then((result) => {
      if (!result.ok) {
        setError(result.message);
        startTransition(() => router.refresh());
      }
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
          {displayItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-zinc-100 bg-white px-4 py-3 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={item.concluido}
                onChange={(e) => toggle(item.id, e.target.checked)}
                className="h-5 w-5 shrink-0 rounded accent-[#d4883a]"
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
                onClick={() => removeItem(item.id)}
                aria-label={`Remover item "${item.item}"`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={handleAdd} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            name="item"
            required
            placeholder="Adicionar item..."
            disabled={addPending}
            className="min-h-12 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
          />
          <button
            type="submit"
            disabled={addPending}
            className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d4883a] text-white transition-all duration-200 hover:bg-[#c07828] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a] disabled:opacity-60"
            aria-label="Adicionar item ao checklist"
          >
            <Plus size={22} aria-hidden="true" />
          </button>
        </div>
        {error && <p className="text-base text-red-600">{error}</p>}
      </form>
    </section>
  );
}
