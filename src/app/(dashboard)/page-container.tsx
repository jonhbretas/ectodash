import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
};

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
    >
      {children}
    </main>
  );
}
