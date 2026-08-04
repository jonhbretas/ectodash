// src/app/api/atas/[id]/pdf/route.ts
// Ata PDF download — server-rendered with pdfkit (standard WinAnsi fonts
// cover pt-BR accents). The route is just a download endpoint: the same
// session-bound client and RLS that gate the reunioes table protect the
// read, so a caller outside the authenticated session gets a 401 and RLS
// would return no row for roles without access.
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function textBlocks(value: string | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Não autenticado", { status: 401 });
  }

  if (!Number.isFinite(id)) {
    return new Response("Ata não encontrada", { status: 404 });
  }

  const [ataResult, dipsResult] = await Promise.all([
    supabase
      .from("reunioes")
      .select(
        "titulo, data_reuniao, horario, resumo, participantes, pontos_principais, deliberacoes"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("dips")
      .select("localidade, pais, data_dip, participantes, observacoes")
      .eq("ata_id", id)
      .order("data_dip", { ascending: true }),
  ]);

  if (ataResult.error || !ataResult.data) {
    return new Response("Ata não encontrada", { status: 404 });
  }

  const ata = ataResult.data;
  const dips = dipsResult.data ?? [];
  const dataLabel = format(new Date(`${ata.data_reuniao}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  doc.font("Helvetica-Bold").fontSize(20).text(ata.titulo, { align: "center" });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11).fillColor("#52525b").text(
    `Data: ${dataLabel}${ata.horario ? ` às ${ata.horario}` : ""}`,
    { align: "center" }
  );
  doc.moveDown(1.2);

  const participantes = textBlocks(ata.participantes);
  if (participantes.length > 0) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text("Participantes");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    for (const nome of participantes) {
      doc.text(`• ${nome}`, { lineGap: 3 });
    }
    doc.moveDown(0.8);
  }

  const pontos = textBlocks(ata.pontos_principais);
  if (pontos.length > 0) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text("Pontos principais");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    for (const ponto of pontos) {
      doc.text(`• ${ponto}`, { lineGap: 3 });
    }
    doc.moveDown(0.8);
  }

  const deliberacoes = textBlocks(ata.deliberacoes);
  if (deliberacoes.length > 0) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text("Deliberações");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    for (const deliberacao of deliberacoes) {
      doc.text(`• ${deliberacao}`, { lineGap: 3 });
    }
    doc.moveDown(0.8);
  }

  if (ata.resumo) {
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13).text("Resumo");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).fillColor("#18181b").text(ata.resumo, {
      lineGap: 4,
    });
    doc.moveDown(0.8);
  }

  if (dips.length > 0) {
    doc.addPage();
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(15).text("Dinâmica DIP");
    doc.moveDown(0.6);
    for (const dip of dips) {
      doc.font("Helvetica-Bold").fontSize(11.5).text(
        `${dip.localidade} — ${dip.pais}`
      );
      doc.font("Helvetica").fontSize(10.5).fillColor("#52525b").text(
        [
          dip.data_dip ? `Data: ${format(new Date(`${dip.data_dip}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}` : "",
          dip.participantes !== null ? `Participantes: ${dip.participantes}` : "",
        ]
          .filter(Boolean)
          .join("  |  ")
      );
      if (dip.observacoes) {
        doc.fillColor("#18181b").text(dip.observacoes, { lineGap: 3 });
      }
      doc.fillColor("#111827").moveDown(0.8);
    }
  }

  doc.end();
  await done;

  const pdf = Buffer.concat(chunks);
  const filename = `ata-${dataLabel.replaceAll("/", "-")}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
