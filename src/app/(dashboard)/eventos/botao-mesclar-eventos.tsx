"use client";

// Botão do topo da tela de eventos que rola suavemente até o módulo
// "Mesclar eventos duplicados" (merge-eventos-section.tsx), no rodapé.
import { GitMerge } from "lucide-react";

export default function BotaoMesclarEventos() {
  function rolarAteMesclagem() {
    document
      .getElementById("mesclar-eventos")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      type="button"
      onClick={rolarAteMesclagem}
      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
    >
      <GitMerge size={22} aria-hidden="true" />
      Mesclar eventos
    </button>
  );
}
