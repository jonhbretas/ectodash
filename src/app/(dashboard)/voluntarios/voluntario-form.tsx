"use client";

// Shared volunteer form (create + edit) — all roster data fields from
// migration 0017 (nome, código PF, unidade, org depto, função, datas, obs,
// área) plus, for a coordenador_geral caller, the intended role and led
// áreas. Submits through the SECURITY DEFINER functions in actions.ts —
// the functions are the real gate; the UI just decides what to show.
// For a coordenador_area caller the papel/áreas fields are hidden entirely
// (the functions force voluntario_comum and pin the área to the caller's).
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Save, UserRoundPlus } from "lucide-react";
import { criarVoluntario, atualizarVoluntario, type PerfilState } from "./actions";

export type VoluntarioFormValues = {
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  obs: string | null;
  area_atuacao: string | null;
  papel: string | null;
  areasLideradas: string[];
  ativo: boolean;
};

const initialState = { ok: false, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(29,78,216,0.25)] transition-all duration-200 hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : label}
    </button>
  );
}

const inputClassName =
  "min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const labelClassName = "text-lg font-medium text-zinc-900";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function VoluntarioForm({
  mode,
  voluntarioId,
  values,
  areaOptions,
  canAssignRole,
}: {
  mode: "criar" | "editar";
  voluntarioId?: number;
  values: VoluntarioFormValues;
  areaOptions: string[];
  canAssignRole: boolean;
}) {
  const router = useRouter();
  const action =
    mode === "criar"
      ? criarVoluntario
      : atualizarVoluntario.bind(null, voluntarioId!);

  const [state, formAction] = useActionState<
    PerfilState & { novoId?: number },
    FormData
  >(action, initialState);

  function onSuccess() {
    if (mode === "criar" && state.ok && state.novoId) {
      router.push(`/voluntarios/${state.novoId}`);
      return;
    }
    router.refresh();
  }

  const showRoleFields = canAssignRole;

  return (
    <form
      action={formAction}
      className="flex w-full max-w-3xl flex-col gap-4"
      aria-live="polite"
    >
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="nome" label="Nome completo">
            <input
              id="nome"
              name="nome"
              required
              minLength={2}
              defaultValue={values.nome}
              className={inputClassName}
            />
          </Field>
        </div>

        <Field id="codigo_pf" label="Código PF">
          <input
            id="codigo_pf"
            name="codigo_pf"
            defaultValue={values.codigo_pf ?? ""}
            placeholder="Ex: 505418"
            className={inputClassName}
          />
        </Field>

        <Field id="unidade" label="Unidade">
          <input
            id="unidade"
            name="unidade"
            defaultValue={values.unidade ?? ""}
            placeholder="Ex: São Paulo, Curitiba..."
            className={inputClassName}
          />
        </Field>

        <Field id="org_depto" label="Org Depto">
          <input
            id="org_depto"
            name="org_depto"
            defaultValue={values.org_depto ?? ""}
            placeholder="Ex: ECTOLAB \ Paratecnológico \ DIP"
            className={inputClassName}
          />
        </Field>

        <Field id="funcao" label="Função">
          <input
            id="funcao"
            name="funcao"
            defaultValue={values.funcao ?? ""}
            placeholder="Ex: Monitoria DIP"
            className={inputClassName}
          />
        </Field>

        <Field id="data_inicio" label="Data de início">
          <input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={values.data_inicio ?? ""}
            className={inputClassName}
          />
        </Field>

        <Field id="data_saida" label="Data de saída">
          <input
            id="data_saida"
            name="data_saida"
            type="date"
            defaultValue={values.data_saida ?? ""}
            className={inputClassName}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="area_atuacao" label="Área de atuação">
            <input
              id="area_atuacao"
              name="area_atuacao"
              list="areas-conhecidas"
              defaultValue={values.area_atuacao ?? ""}
              placeholder="Ex: Paratecnológico - DIP"
              className={inputClassName}
            />
            <datalist id="areas-conhecidas">
              {areaOptions.map((area) => (
                <option key={area} value={area} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field id="obs" label="Observações">
            <textarea
              id="obs"
              name="obs"
              rows={3}
              defaultValue={values.obs ?? ""}
              placeholder="Afastamentos, projetos especiais, observações..."
              className={`${inputClassName} min-h-24 resize-y py-3`}
            />
          </Field>
        </div>

        {showRoleFields && (
          <>
            <Field id="papel" label="Papel">
              <select
                id="papel"
                name="papel"
                defaultValue={values.papel ?? "voluntario_comum"}
                className={inputClassName}
              >
                <option value="voluntario_comum">Voluntário comum</option>
                <option value="coordenador_area">Coordenador de área</option>
                <option value="financeiro">Financeiro</option>
                <option value="voluntariado">Voluntariado</option>
                <option value="coordenador_geral">Coordenador geral</option>
              </select>
            </Field>

            <Field id="areas_lideradas" label="Áreas de coordenação">
              <input
                id="areas_lideradas"
                name="areas_lideradas"
                defaultValue={values.areasLideradas.join(", ")}
                placeholder="Ex: Paratecnológico - DIP, Eventos"
                className={inputClassName}
              />
              <p className="text-base text-zinc-600">
                Separe por vírgula. Vale apenas para o papel Coordenador de
                área. Será aplicado quando o voluntário vincular o cadastro.
              </p>
            </Field>
          </>
        )}

        {mode === "editar" && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <input
              id="ativo"
              name="ativo"
              type="checkbox"
              defaultChecked={values.ativo}
              value="true"
              className="h-6 w-6 accent-blue-700"
            />
            <label
              htmlFor="ativo"
              className={`${labelClassName} cursor-pointer`}
            >
              Voluntário ativo na equipe
            </label>
          </div>
        )}
      </div>

      <SubmitButton
        label={
          mode === "criar"
            ? "Cadastrar voluntário"
            : "Salvar alterações"
        }
      />
      {state.message && (
        <p
          className={`text-base ${
            state.ok ? "text-green-800" : "text-red-700"
          }`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      {state.ok && (
        <button
          type="button"
          onClick={onSuccess}
          className="flex min-h-14 w-fit items-center justify-center gap-2 rounded-xl bg-green-700 px-5 text-xl font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
        >
          {mode === "criar" ? (
            <>
              <UserRoundPlus size={22} aria-hidden="true" />
              Ver cadastro criado
            </>
          ) : (
            <>
              <Save size={22} aria-hidden="true" />
              Atualizar tela
            </>
          )}
        </button>
      )}
    </form>
  );
}
