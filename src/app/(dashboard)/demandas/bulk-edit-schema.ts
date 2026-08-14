// Bulk-edit sentinels + payload shape, shared between the bulk-edit dialog
// (client) and the editarDemandasEmMassa server action. Kept OUT of
// actions.ts on purpose: Next.js 16 forbids exporting non-async values from
// a "use server" file, so client-side constants must live here.
export const BULK_NAO_ALTERAR = "__nao_alterar__";
export const BULK_LIMPAR = "__limpar__";
export const BULK_REMOVER = "__remover__";

export type BulkEditDemandasValues = {
  // NAO_ALTERAR | pendente | em_andamento | concluida
  status: string;
  // "" = não alterar | yyyy-mm-dd
  prazo: string;
  // NAO_ALTERAR | LIMPAR | texto livre
  area: string;
  projeto: string;
  // NAO_ALTERAR | REMOVER | "123" (id do evento)
  eventoId: string;
  etiquetaId: string;
  // Roster ids a ADICIONAR às selecionadas (nunca removidos)
  responsavelIds: string[];
};
