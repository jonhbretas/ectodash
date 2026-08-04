import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "EctoDash",
    template: "%s — EctoDash",
  },
  description:
    "Gestão de demandas, lembretes e finanças para voluntários da instituição.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Skip-to-content link (WCAG 2.4.1). Visually hidden until
          keyboard-focused (sr-only focus:not-sr-only), pure CSS reveal,
          no JS. Targets id="main-content" — Plans 03-02/03-03 add this id
          to each page's actual <main> element as they touch it; this plan
          only adds the link itself and documents the convention.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:min-h-14 focus:flex focus:items-center focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-xl focus:text-zinc-900 focus:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Pular para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  );
}
