"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { marcarAusencia } from "./actions";

type AusenciaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escalaId: number;
  voluntarioId: number;
  voluntarioNome: string;
};

export default function AusenciaDialog({
  open,
  onOpenChange,
  escalaId,
  voluntarioId,
  voluntarioNome,
}: AusenciaDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("escalaId", String(escalaId));
    formData.set("voluntarioId", String(voluntarioId));
    if (motivo.trim()) {
      formData.set("motivo", motivo.trim());
    }

    startTransition(async () => {
      const result = await marcarAusencia(null as never, formData);
      if (result.ok) {
        setMotivo("");
        onOpenChange(false);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-zinc-900">
            Marcar ausência
          </DialogTitle>
          <DialogDescription className="text-lg text-zinc-600">
            {voluntarioNome} será marcado como ausente e o sistema buscará um
            substituto automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo" className="text-lg font-medium text-zinc-700">
              Motivo (opcional)
            </Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: compromisso pessoal"
              className="min-h-14 text-lg"
            />
          </div>

          {error && (
            <p className="text-base text-red-600">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="min-h-12 text-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="min-h-12 text-lg bg-amber-500 text-white hover:bg-amber-600"
            >
              {pending ? "Registrando..." : "Confirmar ausência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
