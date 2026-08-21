"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect, FORM_SELECT_VAZIO } from "@/components/ui/form-select";
import { criarEscala } from "../actions";

export default function NovaEscalaForm({
  localidadeOptions,
}: {
  localidadeOptions: string[];
}) {
  const router = useRouter();
  const [dataSemana, setDataSemana] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!dataSemana) {
      setError("Selecione a data da sexta-feira.");
      return;
    }

    const formData = new FormData();
    formData.set("dataSemana", dataSemana);
    if (localidade) {
      formData.set("localidade", localidade);
    }

    startTransition(async () => {
      const result = await criarEscala(null as never, formData);
      if (result.ok && result.id) {
        router.push(`/voluntarios/escala/${result.id}`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xl">
      <div className="flex flex-col gap-2">
        <Label htmlFor="dataSemana" className="text-lg font-medium text-zinc-700">
          Data da sexta-feira *
        </Label>
        <Input
          id="dataSemana"
          type="date"
          value={dataSemana}
          onChange={(e) => setDataSemana(e.target.value)}
          required
          className="min-h-14 text-lg"
        />
        <p className="text-base text-zinc-500">
          Selecione a data da sexta-feira referente à dinâmica.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-lg font-medium text-zinc-700">
          Localidade (opcional)
        </Label>
        <FormSelect
          value={localidade}
          onValueChange={setLocalidade}
          placeholder="Todas as localidades"
          options={localidadeOptions.map((l) => ({ value: l, label: l }))}
        />
        <p className="text-base text-zinc-500">
          Deixe vazio para criar uma escala geral (todas as localidades).
        </p>
      </div>

      {error && (
        <p className="text-base text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-6 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {pending ? "Criando..." : "Criar escala"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-xl font-medium text-zinc-700 transition-all duration-200 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
