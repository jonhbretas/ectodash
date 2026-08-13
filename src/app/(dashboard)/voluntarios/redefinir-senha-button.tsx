"use client";

// Reset manual de senha pelo coordenador geral — abre um dialog onde ele
// define a nova senha; a server action grava via admin API (service role) e
// avisa o voluntário por e-mail. O gate de autorização (coordenador_geral)
// está na server action; este componente é só a camada de UX.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { redefinirSenhaVoluntario } from "./actions";

export default function RedefinirSenhaButton({
  profileId,
  nome,
}: {
  profileId: string;
  nome: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);

  function abrir() {
    setNovaSenha("");
    setConfirmacao("");
    setResultado(null);
    setOpen(true);
  }

  async function confirmar() {
    if (enviando) return;
    if (novaSenha.length < 8) {
      setResultado({
        ok: false,
        texto: "A senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }
    if (novaSenha !== confirmacao) {
      setResultado({ ok: false, texto: "As senhas não conferem." });
      return;
    }
    setEnviando(true);
    setResultado(null);
    const res = await redefinirSenhaVoluntario(profileId, novaSenha);
    setEnviando(false);
    setResultado({ ok: res.ok, texto: res.message });
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <KeyRound size={18} aria-hidden="true" />
        Redefinir senha
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl text-zinc-900">
              Redefinir senha de {nome}
            </DialogTitle>
            <DialogDescription>
              Defina a nova senha de acesso. O voluntário receberá a senha por
              e-mail.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="redefinir-nova-senha"
                className="text-lg font-medium text-zinc-900"
              >
                Nova senha
              </Label>
              <Input
                id="redefinir-nova-senha"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="min-h-12 rounded-lg border border-zinc-400 bg-white px-4 py-2.5 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="redefinir-confirmacao"
                className="text-lg font-medium text-zinc-900"
              >
                Confirme a nova senha
              </Label>
              <Input
                id="redefinir-confirmacao"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="min-h-12 rounded-lg border border-zinc-400 bg-white px-4 py-2.5 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              />
            </div>
            {resultado && (
              <p
                className={`rounded-xl px-4 py-3 text-base font-medium ring-1 ${
                  resultado.ok
                    ? "bg-green-50 text-green-800 ring-green-200/60"
                    : "bg-red-50 text-red-800 ring-red-200/60"
                }`}
              >
                {resultado.texto}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg px-4 text-lg font-medium text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={confirmar}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
            >
              {enviando ? (
                <Loader2 size={18} aria-hidden="true" className="animate-spin" />
              ) : (
                <KeyRound size={18} aria-hidden="true" />
              )}
              {enviando ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
