import type { ReactNode } from "react";

// /analisar hosts the analisarComIA server action, whose AI call can run
// past the default 10s function budget on long files/pastes — raise the
// route's execution limit (docs: maxDuration must live in a server
// component; the page itself is a client component). Ata detalhada de
// reunião longa leva minutos — mesmo teto de /reunioes/analisar.
export const maxDuration = 300;

export default function AnalisarLayout({ children }: { children: ReactNode }) {
  return children;
}
