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
import { Html, Head, Body, Container, Text, Heading, Link } from "react-email";

export interface ReminderDigestItem {
  titulo: string;
  prazoFormatado: string; // pre-formatted dd/MM/yyyy via date-fns, pt-BR
  tipo: "atrasada" | "aproximando";
  url: string; // link direto para a demanda
}

export interface ReminderEmailProps {
  items: ReminderDigestItem[];
}

// Backwards-compat: single-demanda callers can still pass titulo/prazoFormatado/tipo.
export type LegacyReminderEmailProps = {
  titulo: string;
  prazoFormatado: string;
  tipo: "atrasada" | "aproximando";
  url?: string;
};

export function ReminderEmail(props: ReminderEmailProps | LegacyReminderEmailProps) {
  const items: ReminderDigestItem[] =
    "items" in props
      ? props.items
      : [
          {
            titulo: props.titulo,
            prazoFormatado: props.prazoFormatado,
            tipo: props.tipo,
            url: props.url ?? "#",
          },
        ];

  const total = items.length;
  const tituloResumo =
    total === 1
      ? "Você tem 1 demanda precisando da sua atenção"
      : `Você tem ${total} demandas precisando da sua atenção`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "560px", padding: "24px" }}>
          <Heading style={{ fontSize: "24px", color: "#18181b" }}>
            EctoDash — Resumo de demandas
          </Heading>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            {tituloResumo}:
          </Text>
          {items.map((item) => (
            <Container
              key={`${item.url}-${item.titulo}`}
              style={{
                backgroundColor: "#ffffff",
                borderLeft:
                  item.tipo === "atrasada"
                    ? "6px solid #b91c1c"
                    : "6px solid #b45309",
                borderRadius: "8px",
                padding: "16px",
                margin: "16px 0",
              }}
            >
              <Text
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#18181b",
                  margin: "0 0 8px 0",
                }}
              >
                {item.titulo}
              </Text>
              <Text
                style={{
                  fontSize: "16px",
                  lineHeight: "1.5",
                  color: "#27272a",
                  margin: "0 0 12px 0",
                }}
              >
                {item.tipo === "atrasada"
                  ? `Atrasada — o prazo era ${item.prazoFormatado}.`
                  : `Prazo próximo: ${item.prazoFormatado}.`}
              </Text>
              <Link
                href={item.url}
                style={{ fontSize: "16px", fontWeight: "bold", color: "#1d4ed8" }}
              >
                Abrir demanda →
              </Link>
            </Container>
          ))}
        </Container>
      </Body>
    </Html>
  );
}
