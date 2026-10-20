"use client";

import { useState, useTransition } from "react";
import { ClipboardPaste, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importarEscalaPorTexto } from "./actions";

export default function ImportarEscalaTextoDialog({ escalaId }: { escalaId: number }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function importar() {
    setMessage(null);
    startTransition(async () => {
      const result = await importarEscalaPorTexto(escalaId, texto);
      setMessage(result.message);
      if (result.ok) setTexto("");
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="min-h-12 rounded-xl text-base">
        <ClipboardPaste size={18} aria-hidden="true" />
        Colar escala da reunião
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText size={21} className="text-[#2195B9]" /> Importar escala definida na reunião</DialogTitle>
            <DialogDescription>
              Copie o texto do PDF ou da ata. Este caminho não usa IA nem OCR, portanto é o mais econômico e confiável. Use uma linha por função, por exemplo: “Cronometrista: Maria Silva”.
            </DialogDescription>
          </DialogHeader>
          <textarea value={texto} onChange={(event) => setTexto(event.target.value)} placeholder={"Epicon: Nome completo\nCronometrista: Nome completo\nMonitoria: Nome completo"} className="min-h-56 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900 outline-none focus:border-[#2195B9] focus:ring-2 focus:ring-[#2195B9]/20" />
          {message && <p className="text-sm text-zinc-700" role="status">{message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Fechar</Button>
            <Button type="button" onClick={importar} disabled={pending || texto.trim().length < 3}>
              {pending && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
              Importar e revisar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
