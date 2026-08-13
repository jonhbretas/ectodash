// src/emails/nova-senha-email.tsx
// react-email template for the manual password reset done by the
// coordenador_geral (admin.auth.updateUserById). Same accessibility floor as
// reminder-email.tsx: large text, high contrast, plain structure — expressed
// with inline styles since email HTML can't use Tailwind classes.
import { Html, Head, Body, Container, Text, Heading } from "react-email";

export interface NovaSenhaEmailProps {
  nome: string;
  novaSenha: string;
  siteUrl: string;
}

export function NovaSenhaEmail({ nome, novaSenha, siteUrl }: NovaSenhaEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", padding: "24px" }}>
          <Heading style={{ fontSize: "24px", color: "#18181b" }}>
            EctoDash — senha redefinida
          </Heading>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            Olá, {nome || "voluntário(a)"}!
          </Text>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            O coordenador geral redefiniu a senha de acesso da sua conta. Use
            esta senha para entrar no EctoDash:
          </Text>
          <Text
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#2195B9",
              textAlign: "center",
              padding: "12px",
              backgroundColor: "#ffffff",
              border: "2px dashed #2195B9",
              borderRadius: "8px",
              letterSpacing: "1px",
            }}
          >
            {novaSenha}
          </Text>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            Recomendamos trocá-la assim que fizer login, na página do seu
            perfil. Acesse o painel em{" "}
            <a href={siteUrl} style={{ color: "#2195B9" }}>
              {siteUrl}
            </a>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
