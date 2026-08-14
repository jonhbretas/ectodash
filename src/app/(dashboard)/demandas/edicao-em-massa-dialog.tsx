"use client";

// Bulk-edit dialog for the list selection mode ("editar selecionadas").
// Every field starts at "Não alterar" — only fields the user actually
// changed are sent to editarDemandasEmMassa, which applies them to all
// selected demandas without touching per-demanda values (status moves to
// "concluida" while each demanda keeps its own área/projeto/evento).
// Responsáveis are only ADDED to the selection, never removed.
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelect, FormCombobox } from "@/components/ui/form-select";
import { DateInput } from "@/components/ui/date-input";
import { editarDemandasEmMassa } from "./actions";
import {
  BULK_NAO_ALTERAR,
  BULK_LIMPAR,
  BULK_REMOVER,
} from "./bulk-edit-schema";

export type BulkEditEvento = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
};

export type BulkEditEtiqueta = { id: number; area: string; nome: string };

export type BulkEditVoluntario = { id: string; label: string };

export type EdicaoEmMassaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: number[];
  areas: string[];
  projetos: string[];
  eventos: BulkEditEvento[];
  etiquetas: BulkEditEtiqueta[];
  voluntarios: BulkEditVoluntario[];
  onSucesso: (mensagem: string) => void;
};

const STATUS_OPTIONS = [
  { value: BULK_NAO_ALTERAR, label: "Não alterar" },
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
];

function dataEventoLabel(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function eventoLabel(evento: BulkEditEvento): string {
  const data = evento.data_evento
    ? ` — ${dataEventoLabel(evento.data_evento)}`
    : "";
  const local = evento.local ? ` · ${evento.local}` : "";
  return `${evento.titulo}${data}${local}`;
}

export default function EdicaoEmMassaDialog({
  open,
  onOpenChange,
  ids,
  areas,
  projetos,
  eventos,
  etiquetas,
  voluntarios,
  onSucesso,
}: EdicaoEmMassaDialogProps) {
  const [status, setStatus] = useState(BULK_NAO_ALTERAR);
  const [prazo, setPrazo] = useState("");
  const [area, setArea] = useState(BULK_NAO_ALTERAR);
  const [projeto, setProjeto] = useState(BULK_NAO_ALTERAR);
  const [eventoId, setEventoId] = useState(BULK_NAO_ALTERAR);
  const [etiquetaId, setEtiquetaId] = useState(BULK_NAO_ALTERAR);
  const [responsavelIds, setResponsavelIds] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleResponsavel = (id: string) => {
    setResponsavelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const aplicar = () => {
    setErro(null);
    startTransition(async () => {
      const result = await editarDemandasEmMassa(ids, {
        status,
        prazo,
        area,
        projeto,
        eventoId,
        etiquetaId,
        responsavelIds: [...responsavelIds],
      });
      if (result.ok) {
        onOpenChange(false);
        onSucesso(result.message);
      } else {
        setErro(result.message);
      }
    });
  };

  const eventoOptions = [
    { value: BULK_NAO_ALTERAR, label: "Não alterar" },
    ...eventos.map((evento) => ({
      value: String(evento.id),
      label: eventoLabel(evento),
    })),
    { value: BULK_REMOVER, label: "Remover evento das selecionadas" },
  ];

  const etiquetaOptions = [
    { value: BULK_NAO_ALTERAR, label: "Não alterar" },
    ...etiquetas.map((etiqueta) => ({
      value: String(etiqueta.id),
      label: `${etiqueta.nome} (${etiqueta.area})`,
    })),
    { value: BULK_REMOVER, label: "Remover etiqueta das selecionadas" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {ids.length} demandas</DialogTitle>
          <DialogDescription>
            Preencha apenas os campos que quer alterar em todas as selecionadas.
            Os que ficarem em &quot;Não alterar&quot; continuam como estão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edicao-em-massa-status"
              className="text-base font-medium text-zinc-900"
            >
              Status
            </label>
            <FormSelect
              id="edicao-em-massa-status"
              value={status}
              onValueChange={setStatus}
              ariaLabel="Status"
              options={STATUS_OPTIONS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edicao-em-massa-prazo"
              className="text-base font-medium text-zinc-900"
            >
              Prazo
            </label>
            <DateInput
              id="edicao-em-massa-prazo"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              placeholder="Não alterar"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edicao-em-massa-area" className="text-base font-medium text-zinc-900">Área</label>
            <FormCombobox
              id="edicao-em-massa-area"
              value={area}
              onChange={setArea}
              options={[BULK_NAO_ALTERAR, BULK_LIMPAR, ...areas]}
              labels={{
                [BULK_NAO_ALTERAR]: "Não alterar",
                [BULK_LIMPAR]: "Limpar área das selecionadas",
              }}
              ariaLabel="Área"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edicao-em-massa-projeto" className="text-base font-medium text-zinc-900">
              Projeto
            </label>
            <FormCombobox
              id="edicao-em-massa-projeto"
              value={projeto}
              onChange={setProjeto}
              options={[BULK_NAO_ALTERAR, BULK_LIMPAR, ...projetos]}
              labels={{
                [BULK_NAO_ALTERAR]: "Não alterar",
                [BULK_LIMPAR]: "Limpar projeto das selecionadas",
              }}
              ariaLabel="Projeto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edicao-em-massa-evento" className="text-base font-medium text-zinc-900">
              Evento
            </label>
            <FormSelect
              id="edicao-em-massa-evento"
              value={eventoId}
              onValueChange={setEventoId}
              ariaLabel="Evento"
              options={eventoOptions}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edicao-em-massa-etiqueta" className="text-base font-medium text-zinc-900">
              Etiqueta
            </label>
            <FormSelect
              id="edicao-em-massa-etiqueta"
              value={etiquetaId}
              onValueChange={setEtiquetaId}
              ariaLabel="Etiqueta"
              options={etiquetaOptions}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edicao-em-massa-responsaveis" className="text-base font-medium text-zinc-900">
              Adicionar responsáveis
            </label>
            <VoluntarioChecklistBulk
              voluntarios={voluntarios}
              selectedIds={responsavelIds}
              onToggle={toggleResponsavel}
            />
            <p className="text-sm text-zinc-500">
              Os responsáveis marcados serão adicionados a todas as demandas
              selecionadas, sem remover os atuais.
            </p>
          </div>

          {erro && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800 ring-1 ring-red-200/60">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={pending}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-[#2195B9] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:opacity-60"
          >
            {pending ? "Aplicando..." : "Aplicar alterações"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Checkbox list with name search — same pattern as the demanda form's
// volunteer checklist, here restricted to ADD semantics.
function VoluntarioChecklistBulk({
  voluntarios,
  selectedIds,
  onToggle,
}: {
  voluntarios: BulkEditVoluntario[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? voluntarios.filter((v) => v.label.toLowerCase().includes(termo))
    : voluntarios;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-2">
        <input
          type="search"
          id="edicao-em-massa-responsaveis"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar voluntário por nome..."
          aria-label="Buscar voluntário por nome"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition-colors hover:border-zinc-300 focus:ring-2 focus:ring-[#2195B9]"
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-2">
        {filtrados.length === 0 ? (
          <p className="px-2 py-3 text-base text-zinc-400">
            Nenhum voluntário encontrado.
          </p>
        ) : (
          filtrados.map((voluntario) => (
            <label
              key={voluntario.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-lg text-zinc-900 transition-colors hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(voluntario.id)}
                onChange={() => onToggle(voluntario.id)}
                className="h-5 w-5 rounded border-zinc-300 accent-[#2195B9]"
              />
              <span className="truncate">{voluntario.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
