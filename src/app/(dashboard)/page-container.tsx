import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
};

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
    >
      {children}
    </main>
  );
}
