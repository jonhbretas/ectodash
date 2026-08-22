export type LocalidadeReferencia = {
  id: number;
  nome: string;
};

export type VoluntarioLocalidade = {
  id: number;
  unidade: string | null;
  localidade_id: number | null;
};

// ECTOLAB is the legacy value used by the roster for the Foz do Iguacu hub.
const FOZ_SEDE_ALIASES = new Set([
  "ectolab",
  "ectolab (foz/sede)",
  "foz do iguacu - sede",
]);

function normalizarLocalidade(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ehFozSede(value: string | null | undefined): boolean {
  return FOZ_SEDE_ALIASES.has(normalizarLocalidade(value));
}

export function resolverLocalidadeId(
  localidade: string | null,
  localidades: LocalidadeReferencia[]
): number | null {
  const normalizada = normalizarLocalidade(localidade);
  if (!normalizada) return null;

  const exata = localidades.find(
    (item) => normalizarLocalidade(item.nome) === normalizada
  );
  if (exata) return exata.id;

  if (ehFozSede(localidade)) {
    return (
      localidades.find((item) => ehFozSede(item.nome))?.id ?? null
    );
  }

  return null;
}

export function filtrarVoluntariosPorLocalidade<T extends VoluntarioLocalidade>(
  voluntarios: T[],
  localidade: string | null,
  localidades: LocalidadeReferencia[],
  vinculados: ReadonlySet<number>
): T[] {
  const localidadeNormalizada = normalizarLocalidade(localidade);
  if (!localidadeNormalizada) return voluntarios;

  const localidadeId = resolverLocalidadeId(localidade, localidades);

  return voluntarios.filter((voluntario) => {
    if (vinculados.has(voluntario.id)) return true;
    if (localidadeId !== null && voluntario.localidade_id === localidadeId) {
      return true;
    }

    const unidadeNormalizada = normalizarLocalidade(voluntario.unidade);
    if (unidadeNormalizada === localidadeNormalizada) return true;

    // Keep legacy ECTOLAB roster rows in the Foz/Sede pool.
    return ehFozSede(localidade) && ehFozSede(voluntario.unidade);
  });
}
