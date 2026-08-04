import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
};

// Shared wrapper for every (dashboard) group page — replaces the identical
// <main className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6
// py-16"> string previously copy-pasted across page.tsx, demandas/nova/page.tsx,
// and demandas/[id]/editar/page.tsx (03-UI-SPEC.md Retrofit Contract -> 2.
// Dashboard shell). Also completes layout.tsx's skip-link jump target
// (id="main-content") across all three pages. Pure structural extraction —
// zero visible pixel change expected.
export default function PageContainer({ children }: PageContainerProps) {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 pb-20 pt-8"
    >
      {children}
    </main>
  );
}
