// src/emails/reminder-email.tsx
// react-email template for LEMB-01/LEMB-02 reminder emails. Imports from the
// unified "react-email" package only — never the deprecated scoped
// components package the maintainers have marked "no longer supported"
// (07-RESEARCH.md Package Legitimacy Audit, Pitfall 6).
//
// Large text / high-contrast / plain-structure copy, matching this project's
// established elderly-accessible floor (the app's own text-xl/AA-contrast
// convention) — email HTML can't use Tailwind classes directly, so the same
// visual floor is expressed here via inline styles instead.
import { Html, Head, Body, Container, Text, Heading } from "react-email";

export interface ReminderEmailProps {
  titulo: string;
  prazoFormatado: string; // pre-formatted dd/MM/yyyy via date-fns, pt-BR
  tipo: "atrasada" | "aproximando";
}

export function ReminderEmail({ titulo, prazoFormatado, tipo }: ReminderEmailProps) {
  const mensagem =
    tipo === "atrasada"
      ? `A demanda "${titulo}" está atrasada. O prazo era ${prazoFormatado}.`
      : `A demanda "${titulo}" tem prazo próximo: ${prazoFormatado}.`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", padding: "24px" }}>
          <Heading style={{ fontSize: "24px", color: "#18181b" }}>
            EctoDash — Lembrete de demanda
          </Heading>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            {mensagem}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
