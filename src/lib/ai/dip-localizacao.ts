import { z } from "zod";

// Ausência de informação na saída da IA vira campo vazio para revisão.
// Tipos incorretos e textos acima do limite continuam sendo rejeitados.
export const dipLocalizacaoShape = {
  localidade: z.string().trim().max(200).nullish().transform((value) => value ?? ""),
  pais: z.string().trim().max(100).nullish().transform((value) => value ?? ""),
};
