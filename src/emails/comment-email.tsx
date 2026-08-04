// src/emails/comment-email.tsx
// react-email template for comment-mention notifications — mirrors
// reminder-email.tsx's accessibility floor (large text, high contrast,
// plain structure, pt-BR).
import { Html, Head, Body, Container, Text, Heading } from "react-email";

export interface CommentEmailProps {
  autorNome: string;
  demandaTitulo: string;
  comentario: string;
  link: string;
}

export function CommentEmail({
  autorNome,
  demandaTitulo,
  comentario,
  link,
}: CommentEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", padding: "24px" }}>
          <Heading style={{ fontSize: "24px", color: "#18181b" }}>
            EctoDash — Você foi mencionado
          </Heading>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            {autorNome} comentou na demanda &quot;{demandaTitulo}&quot;:
          </Text>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#18181b", backgroundColor: "#ffffff", border: "1px solid #d4d4d8", borderRadius: "8px", padding: "16px" }}>
            {comentario}
          </Text>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            <a href={link} style={{ color: "#1d4ed8", fontWeight: "600" }}>
              Abrir a demanda no EctoDash
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
