"use client";
import { useMemo, useState } from "react";
import { Search, Clock, CheckCheck, Paperclip } from "lucide-react";
import Link from "next/link";
import type { PautaRow } from "../_lib/get-reunioes-data";
import { PrioridadeBadge, ResultadoVotacaoBadge, TipoBadge } from "./pauta-badges";
import VotacaoPainel from "./votacao-painel";
import AnexoPreview from "./anexo-preview";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = { pautas: PautaRow[]; meuUserId: string; isCoordenador: boolean };

function Drawer({
  pauta,
  onClose,
  meuUserId,
  isCoordenador,
}: {
  pauta: PautaRow | null;
  onClose: () => void;
  meuUserId: string;
  isCoordenador: boolean;
}) {
  if (!pauta) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="top-0 right-0 bottom-0 left-auto flex h-dvh w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto rounded-none p-5 sm:max-w-lg sm:p-6">
        <p className="pr-10 text-xs font-bold uppercase tracking-wider text-[#28627B]">Detalhes da pauta</p>
        <DialogTitle className="break-words pr-8 text-xl font-semibold text-zinc-900">{pauta.titulo}</DialogTitle>
        <DialogDescription>Solicitada por {pauta.autor} · {pauta.status === "discutida" ? "Já discutida" : pauta.standBy ? "Em espera" : "Aguardando discussão"}</DialogDescription>
        <div className="flex flex-wrap items-center gap-2">
          <PrioridadeBadge prioridade={pauta.prioridade} />
          <TipoBadge tipo={pauta.tipo} />
          {pauta.votacaoStatus && pauta.votacaoStatus !== "aberta" && <ResultadoVotacaoBadge status={pauta.votacaoStatus} />}
        </div>
        {pauta.contexto && <p className="whitespace-pre-wrap text-base text-zinc-700">{pauta.contexto}</p>}
        {pauta.anexoUrl && (
          <AnexoPreview pautaId={pauta.id} driveId={pauta.anexoDriveId} url={pauta.anexoUrl} nome={pauta.anexoNome} />
        )}
        {pauta.tipo === "deliberativa" && pauta.votacaoStatus && (
          <VotacaoPainel
            pautaId={pauta.id}
            status={pauta.votacaoStatus}
            quorumMinimo={pauta.quorumMinimo}
            votos={pauta.votos}
            meuUserId={meuUserId}
            isCoordenador={isCoordenador}
            encerradaEm={pauta.votacaoEncerradaEm}
            encerradaPorNome={pauta.votacaoEncerradaPorNome}
          />
        )}
        {pauta.ataDiscutidaTitulo && <p className="text-sm text-zinc-500">Discutida em: {pauta.ataDiscutidaTitulo}</p>}
        {pauta.ataDiscutidaId && <Link href={`/reunioes/${pauta.ataDiscutidaId}`} className="text-sm font-medium text-[#2195B9] hover:underline">Ver ata</Link>}
      </DialogContent>
    </Dialog>
  );
}

export default function PautasTab({ pautas, meuUserId, isCoordenador }: Props) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "pendente" | "discutida" | "espera">("todos");
  const [drawer, setDrawer] = useState<PautaRow | null>(null);

  const filtradas = useMemo(() => {
    return pautas.filter((p) => {
      const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hitBusca = !busca.trim() || normalize(`${p.titulo} ${p.autor} ${p.contexto ?? ""}`).includes(normalize(busca.trim()));
      if (!hitBusca) return false;
      if (status === "pendente") return p.status === "pendente" && !p.standBy;
      if (status === "espera") return p.status === "pendente" && p.standBy;
      if (status === "discutida") return p.status === "discutida";
      return true;
    });
  }, [pautas, busca, status]);

  const chip = (label: string, value: typeof status) => (
    <button type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${status === value ? "bg-[#2195B9] text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input aria-label="Buscar no histórico de pautas" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar assunto, autor ou contexto" className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {chip("Todos", "todos")}
          {chip("Na próxima", "pendente")}
          {chip("Em espera", "espera")}
          {chip("Discutidas", "discutida")}
        </div>
        <p className="text-sm text-zinc-600">{filtradas.length} {filtradas.length === 1 ? "pauta" : "pautas"} · Todas as pautas já solicitadas. Use a busca para encontrar um assunto.</p>
        {(busca || status !== "todos") && <button type="button" onClick={() => { setBusca(""); setStatus("todos"); }} className="min-h-10 self-start rounded-lg px-2 text-sm font-semibold text-[#28627B] hover:underline">Limpar filtros</button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-600">
            <tr>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3">Prioridade / Tipo</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Reunião</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900"><button type="button" onClick={() => setDrawer(p)} className="text-left font-medium text-zinc-900 hover:text-[#2195B9] hover:underline">{p.titulo}</button></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PrioridadeBadge prioridade={p.prioridade} compact />
                    <TipoBadge tipo={p.tipo} />
                    {p.votacaoStatus && <ResultadoVotacaoBadge status={p.votacaoStatus} />}
                    {p.anexoUrl && <Paperclip size={16} aria-label="Tem anexo" className="text-zinc-600" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{p.autor}</td>
                <td className="px-4 py-3 text-zinc-600">{p.ataDiscutidaTitulo ?? p.reuniaoSelecionadaTitulo ?? (p.dataSolicitada ? `Pref: ${p.dataSolicitada.split("-").reverse().join("/")}${p.horarioSolicitado ? ` ${p.horarioSolicitado.slice(0, 5)}` : ""}` : "Próxima")}</td>
                <td className="px-4 py-3">
                  {p.standBy ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><Clock size={12} /> em espera</span> : p.status === "discutida" ? <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"><CheckCheck size={12} /> discutida</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-xs font-medium text-[#28627B]">na próxima</span>}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">Nenhuma pauta encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer pauta={drawer} onClose={() => setDrawer(null)} meuUserId={meuUserId} isCoordenador={isCoordenador} />
    </div>
  );
}
