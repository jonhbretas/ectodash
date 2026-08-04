"use client";

// Coordinator's volunteer-edit form — nome, papel, área de atuação and
// (for líderes) the led áreas. RLS (0002) is the real boundary; the form
// simply surfaces the current values.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { atualizarVoluntario, alternarAtivoVoluntario } from "./actions";

export type VoluntarioEditValues = {
  full_name: string;
  role: string;
  area_atuacao: string | null;
  areasLideradas: string[];
  ativo: boolean;
};

const initialState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : "Salvar alterações"}
    </button>
  );
}

export default function EditarVoluntarioForm({
  voluntarioId,
  values,
}: {
  voluntarioId: string;
  values: VoluntarioEditValues;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    atualizarVoluntario.bind(null, voluntarioId),
    initialState
  );

  const [ativoState, ativoAction] = useActionState(
    alternarAtivoVoluntario.bind(null, voluntarioId),
    initialState
  );

  const fieldClassName =
    "min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
  const labelClassName = "text-xl font-medium text-zinc-900";

  return (
    <form
      action={formAction}
      className="flex w-full max-w-md flex-col gap-4"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="full_name" className={labelClassName}>
          Nome completo
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={values.full_name}
          className={fieldClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="role" className={labelClassName}>
          Papel
        </label>
        <select
          id="role"
          name="role"
          defaultValue={values.role}
          className={fieldClassName}
        >
          <option value="voluntario_comum">Voluntário comum</option>
          <option value="lider_area">Líder de área</option>
          <option value="financeiro">Financeiro</option>
          <option value="coordenador_geral">Coordenador geral</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="area_atuacao" className={labelClassName}>
          Área de atuação
        </label>
        <input
          id="area_atuacao"
          name="area_atuacao"
          defaultValue={values.area_atuacao ?? ""}
          placeholder="Ex: Pesquisa, Comunicação, Logística..."
          className={fieldClassName}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="areas_lideradas" className={labelClassName}>
          Áreas lideradas (separadas por vírgula)
        </label>
        <input
          id="areas_lideradas"
          name="areas_lideradas"
          defaultValue={values.areasLideradas.join(", ")}
          placeholder="Ex: Pesquisa, Eventos"
          className={fieldClassName}
        />
        <p className="text-base text-zinc-700">
          Vale apenas para líderes de área.
        </p>
      </div>

      <SubmitButton />
      {state.message && (
        <p
          className={`text-base ${
            state.ok ? "text-green-800" : "text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
      {state.ok && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="w-fit text-base font-medium text-blue-700 underline"
        >
          Atualizar tela
        </button>
      )}
    </form>
  );
}

export function AlternarAtivoButton({
  voluntarioId,
  ativo,
}: {
  voluntarioId: string;
  ativo: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    alternarAtivoVoluntario.bind(null, voluntarioId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-1" aria-live="polite">
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button
        type="submit"
        className={`min-h-14 rounded-lg border px-4 py-3 text-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
          ativo
            ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
            : "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
        }`}
      >
        {ativo ? "Desativar voluntário" : "Reativar voluntário"}
      </button>
      {state.message && (
        <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
      {state.ok && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="w-fit text-base font-medium text-blue-700 underline"
        >
          Atualizar tela
        </button>
      )}
    </form>
  );
}
