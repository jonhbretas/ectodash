"use client";

// Shared volunteer form (create + edit) — all roster data fields from
// migration 0017 (nome, código PF, unidade, org depto, função, datas, obs,
// área) plus, for a coordenador_geral caller, the intended role and led
// áreas. Submits through the SECURITY DEFINER functions in actions.ts —
// the functions are the real gate; the UI just decides what to show.
// For a coordenador_area caller the papel/áreas fields are hidden entirely
// (the functions force voluntario_comum and pin the área to the caller's).
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Check, Save, UserRoundPlus } from "lucide-react";
import { criarVoluntario, atualizarVoluntario, type PerfilState } from "./actions";
import { FormCombobox, FormSelect } from "@/components/ui/form-select";
import DateFieldBr from "@/components/ui/date-field";

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
  areas: string[];

  telefone_1: string | null;
  telefone_2: string | null;
};

const initialState = { ok: false, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#d4883a] px-5 text-xl font-medium text-white shadow-[0_1px_3px_rgba(212,136,58,0.25)] transition-all duration-200 hover:bg-[#c07828] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Salvando..." : label}
    </button>
  );
}

const inputClassName =
  "min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]";
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
  areasOptions = [],
  unidadeOptions = [],
  orgDeptOptions = [],
  canAssignRole,
}: {
  mode: "criar" | "editar";
  voluntarioId?: number;
  values: VoluntarioFormValues;
  areaOptions: string[];
  areasOptions?: string[];
  unidadeOptions?: string[];
  orgDeptOptions?: string[];
  canAssignRole: boolean;
}) {
  const router = useRouter();
  const action =
    mode === "criar"
      ? criarVoluntario
      : atualizarVoluntario.bind(null, voluntarioId!);

  const [areaAtuacao, setAreaAtuacao] = useState(values.area_atuacao ?? "");
  const [unidade, setUnidade] = useState(values.unidade ?? "");
  const [orgDepto, setOrgDepto] = useState(values.org_depto ?? "");
  const [papel, setPapel] = useState(values.papel ?? "voluntario_comum");
  const [areasExtras, setAreasExtras] = useState<string[]>(values.areas ?? []);

  const outrasAreasOptions = [
    ...new Set([
      ...areasOptions,
      ...(areaAtuacao ? [areaAtuacao] : []),
      ...(values.area_atuacao ? [values.area_atuacao] : []),
      ...(values.areas ?? []),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  function toggleAreaExtra(area: string) {
    setAreasExtras((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

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
          <FormCombobox
            name="unidade"
            value={unidade}
            onChange={setUnidade}
            options={unidadeOptions}
            placeholder="Escolha a unidade ou digite outra"
            ariaLabel="Unidade"
          />
        </Field>

        <Field id="org_depto" label="Org Depto">
          <FormCombobox
            name="org_depto"
            value={orgDepto}
            onChange={setOrgDepto}
            options={orgDeptOptions}
            placeholder="Ex: ECTOLAB \ Paratecnológico \ DIP"
            ariaLabel="Org Depto"
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
          <DateFieldBr
            name="data_inicio"
            defaultValue={values.data_inicio}
            className={inputClassName}
          />
        </Field>

        <Field id="data_saida" label="Data de saída">
          <DateFieldBr
            name="data_saida"
            defaultValue={values.data_saida}
            className={inputClassName}
          />
        </Field>

        <Field id="telefone_1" label="Telefone 1">
          <input
            id="telefone_1"
            name="telefone_1"
            defaultValue={values.telefone_1 ?? ""}
            placeholder="(45) 99999-9999"
            className={inputClassName}
          />
        </Field>

        <Field id="telefone_2" label="Telefone 2">
          <input
            id="telefone_2"
            name="telefone_2"
            defaultValue={values.telefone_2 ?? ""}
            placeholder="(45) 99999-9999"
            className={inputClassName}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="area_atuacao" label="Área de atuação principal">
            <FormCombobox
              name="area_atuacao"
              value={areaAtuacao}
              onChange={setAreaAtuacao}
              options={areaOptions}
              placeholder="Escolha a área ou digite outra"
              ariaLabel="Área de atuação"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <span className={labelClassName}>Outras áreas (opcional)</span>
          <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            {outrasAreasOptions.length === 0 && (
              <span className="text-lg text-zinc-400">
                Nenhuma área cadastrada ainda.
              </span>
            )}
            {outrasAreasOptions.map((area) => {
              const marcada = areasExtras.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => toggleAreaExtra(area)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-base font-medium ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a] ${
                    marcada
                      ? "bg-[#d4883a] text-white ring-[#d4883a]"
                      : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {marcada && <Check size={15} aria-hidden="true" />}
                  {area}
                </button>
              );
            })}
          </div>
          <p className="text-base text-zinc-600">
            Marque as áreas adicionais além da principal (ex.: DIP + áreas
            internas). A principal continua sendo a usada nos agrupamentos.
          </p>
          <input
            type="hidden"
            name="areas"
            value={JSON.stringify(areasExtras)}
          />
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
              <FormSelect
                name="papel"
                value={papel}
                onValueChange={setPapel}
                placeholder="Escolha o papel"
                options={[
                  { value: "voluntario_comum", label: "Voluntário comum" },
                  { value: "coordenador_area", label: "Coordenador de área" },
                  { value: "financeiro", label: "Financeiro" },
                  { value: "voluntariado", label: "Voluntariado" },
                  { value: "coordenador_geral", label: "Coordenador geral" },
                ]}
              />
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
              className="h-6 w-6 accent-[#d4883a]"
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
