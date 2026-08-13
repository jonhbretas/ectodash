"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { excluirDemanda } from "./actions";

// A red "Excluir demanda" action on the detail/edit page. Instead of a bare
// window.confirm(), this uses the project's Radix-backed Dialog for a proper
// in-app confirmation popup (05-UI-SPEC.md UX-02 "confirmação clara em ações
// importantes"). The Server Action itself is RLS-gated (migration 0053), so
// the dialog is UX only — authorization stays server-side.
export default function ExcluirDemandaButton({
  demandaId,
}: {
  demandaId: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmarExclusao() {
    if (deleting) return;
    setDeleting(true);
    setErro(null);
    const result = await excluirDemanda(demandaId);
    setDeleting(false);
    if (result.ok) {
      setOpen(false);
      router.push("/");
      router.refresh();
    } else {
      setErro(result.message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xl font-medium text-red-700 ring-1 ring-red-300 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <Trash2 size={22} aria-hidden="true" />
        Excluir demanda
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl text-red-900">
              Excluir esta demanda?
            </DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. A demanda será removida
              permanentemente.
            </DialogDescription>
          </DialogHeader>

          {erro && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-800 ring-1 ring-red-200/60">
              {erro}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg px-4 text-lg font-medium text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmarExclusao}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-lg font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
            >
              <Trash2 size={18} aria-hidden="true" />
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
