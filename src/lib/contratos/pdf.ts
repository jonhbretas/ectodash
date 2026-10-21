// src/lib/contratos/pdf.ts
// Geração do PDF do contrato com pdfkit: cabeçalho com logo, card das partes,
// cláusulas preservando a estrutura do modelo, bloco de assinaturas que nunca
// é quebrado entre páginas e rodapé "Página X de N" em todas as páginas.
//
// Todo texto é posicionado com x/width explícitos — o pdfkit herda o doc.x da
// última chamada, o que antes deslocava seções inteiras para a direita.

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const ACCENT = "#2195B9";
const ACCENT_DARK = "#1a7a94";
const ACCENT_SOFT = "#d4ecf4";
const TEXT_DARK = "#18181b";
const TEXT_MID = "#52525b";
const TEXT_MUTED = "#71717a";
const RULE = "#e4e4e7";
const RULE_DARK = "#d4d4d8";
const BG_LIGHT = "#f7f9fa";
const WHITE = "#ffffff";

const MARGIN = 56;
const MARGIN_TOP = 56;
/** Espaço reservado no pé da página para o rodapé (e o carimbo da Assinafy). */
const MARGIN_BOTTOM = 72;

const BODY_SIZE = 10.5;
const BODY_GAP = 3.5;

export type ContratoPdfInput = {
  numero: string;
  modeloTitulo: string;
  categoriaLabel: string;
  conteudo: string;
  alunoNome: string;
  alunoDocumento?: string | null;
  alunoRg?: string | null;
  alunoNascimento?: string | null;
  alunoEmail?: string | null;
  alunoTelefone?: string | null;
  alunoEndereco?: string | null;
  /** "brasileira, solteira, professora" */
  alunoQualificacao?: string | null;
  valor?: string | null;
  evento?: { titulo: string; data?: string | null; local?: string | null } | null;
  emissao: string;
  /** Envio de teste / pré-visualização: faixa "DOCUMENTO DE TESTE". */
  teste?: boolean;
};

const TOKEN_RE = /\{\{\s*[\w.]+\s*\}\}/g;

/** Variável que ficou sem valor (ex.: contrato sem evento): a linha que só
 *  tinha variáveis some; no meio do texto vira um campo em branco. */
function limparVariaveisVazias(linha: string): string {
  if (!TOKEN_RE.test(linha)) return linha;
  const semTokens = linha.replace(TOKEN_RE, "");
  if (!/[\p{L}\p{N}]/u.test(semTokens)) return "";
  return linha.replace(TOKEN_RE, "____________").replace(/\s+/g, " ").trim();
}

/** Divide o texto do modelo em blocos (linhas em branco separam blocos) e
 *  mantém as quebras de linha simples dentro de cada bloco. */
function blocosDoModelo(texto: string): string[][] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((bloco) => {
      const originais = bloco
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const linhas = originais.map(limparVariaveisVazias).filter(Boolean);
      // Bloco que perdeu todas as variáveis e sobrou só o rótulo (ex.:
      // "Evento" num contrato sem evento) sai inteiro.
      if (
        linhas.length === 1 &&
        originais.length > 1 &&
        linhas[0].length <= 30
      ) {
        return [];
      }
      return linhas;
    })
    .filter((linhas) => linhas.length > 0);
}

/** Linhas que funcionam como título dentro das cláusulas: "CLÁUSULA 1ª…",
 *  linhas curtas todas em maiúsculas ou rótulos curtos terminados em ":". */
function ehTituloDeClausula(linha: string): boolean {
  if (/^(cl[áa]usula|par[áa]grafo)\b/i.test(linha) && linha.length <= 90) {
    return true;
  }
  // Maiúsculas só contam como título se a linha for quase só letras — e-mail,
  // CNPJ ou telefone em caixa alta são dados, não títulos.
  const letras = linha.replace(/[^\p{L}]/gu, "");
  const visiveis = linha.replace(/\s/g, "");
  if (
    !linha.includes("@") &&
    letras.length >= 4 &&
    letras.length / visiveis.length >= 0.8 &&
    linha.length <= 70 &&
    letras === letras.toUpperCase()
  ) {
    return true;
  }
  return linha.length <= 50 && linha.endsWith(":");
}

/** Caminho absoluto para a logo em public/. */
const LOGO_PATH = path.join(process.cwd(), "public", "logo-ectolab.png");

function logoExists(): boolean {
  try {
    fs.accessSync(LOGO_PATH, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function buildContratoPdf(
  input: ContratoPdfInput
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN,
      right: MARGIN,
    },
    info: {
      Title: input.modeloTitulo,
      Author: "Ectolab",
      Subject: `${input.categoriaLabel} · ${input.alunoNome}`,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - MARGIN * 2;
  const bottomLimit = () => doc.page.height - MARGIN_BOTTOM;

  /** Garante `altura` pontos livres na página atual; senão, quebra a página. */
  function ensureSpace(altura: number) {
    if (doc.y + altura > bottomLimit()) {
      doc.addPage();
      doc.x = MARGIN;
      doc.y = MARGIN_TOP;
    }
  }

  // ── Cabeçalho ─────────────────────────────────────────────────────
  const hasLogo = logoExists();
  const LOGO_BOX_W = 112;
  const LOGO_BOX_H = 46;
  const headerPadTop = 26;
  const titleX = hasLogo ? MARGIN + LOGO_BOX_W + 18 : MARGIN;
  const titleWidth = pageWidth - MARGIN - titleX;

  const metaLinha = [
    input.categoriaLabel,
    input.numero ? `Contrato nº ${input.numero}` : "",
    `Emissão: ${input.emissao}`,
  ]
    .filter(Boolean)
    .join("   ·   ");

  // Mede título e metadata antes de desenhar, para a banda crescer com o
  // texto em vez de o título (2 linhas) atropelar a linha de metadata.
  doc.font("Helvetica-Bold").fontSize(18);
  const titleOpts = { width: titleWidth, lineGap: 2 };
  const titleH = doc.heightOfString(input.modeloTitulo, titleOpts);
  doc.font("Helvetica").fontSize(9.5);
  const metaOpts = { width: titleWidth };
  const metaH = doc.heightOfString(metaLinha, metaOpts);
  const textBlockH = titleH + 8 + metaH;
  const BAND_HEIGHT = Math.max(
    headerPadTop * 2 + textBlockH,
    headerPadTop * 2 + LOGO_BOX_H
  );

  doc.save();
  doc.rect(0, 0, pageWidth, BAND_HEIGHT).fill(ACCENT);
  doc.rect(0, BAND_HEIGHT - 4, pageWidth, 4).fill(ACCENT_DARK);
  doc.restore();

  if (hasLogo) {
    // A logo tem texto escuro: fica sobre um selo branco para manter contraste.
    const boxY = (BAND_HEIGHT - 4 - LOGO_BOX_H) / 2;
    doc.save();
    doc.roundedRect(MARGIN, boxY, LOGO_BOX_W, LOGO_BOX_H, 6).fill(WHITE);
    doc.restore();
    try {
      doc.image(LOGO_PATH, MARGIN + 8, boxY + 6, {
        fit: [LOGO_BOX_W - 16, LOGO_BOX_H - 12],
        align: "center",
        valign: "center",
      });
    } catch {
      // Ignora erro de logo
    }
  }

  const textTop = (BAND_HEIGHT - 4 - textBlockH) / 2;
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(WHITE)
    .text(input.modeloTitulo, titleX, textTop, titleOpts);
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(ACCENT_SOFT)
    .text(metaLinha, titleX, textTop + titleH + 8, metaOpts);

  doc.x = MARGIN;
  doc.y = BAND_HEIGHT + 28;

  if (input.teste) {
    const avisoH = 30;
    doc.save();
    doc.roundedRect(MARGIN, doc.y, contentWidth, avisoH, 6).fill("#fef3c7");
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#92400e")
      .text(
        "DOCUMENTO DE TESTE — sem validade jurídica. Confira layout e dados antes do envio real.",
        MARGIN,
        doc.y + 10,
        { width: contentWidth, align: "center", lineBreak: false }
      );
    doc.x = MARGIN;
    doc.y += avisoH - 10 + 18;
  }

  // ── Helpers de seção ──────────────────────────────────────────────
  function sectionHeader(title: string, espacoMinimo = 80) {
    ensureSpace(espacoMinimo);
    const y = doc.y;

    doc.save();
    doc.roundedRect(MARGIN, y + 1, 4, 14, 2).fill(ACCENT);
    doc.restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(TEXT_DARK)
      .text(title, MARGIN + 12, y, { width: contentWidth - 12 });

    const ruleY = doc.y + 4;
    doc
      .moveTo(MARGIN, ruleY)
      .lineTo(pageWidth - MARGIN, ruleY)
      .lineWidth(0.8)
      .strokeColor(RULE_DARK)
      .stroke();

    doc.x = MARGIN;
    doc.y = ruleY + 12;
  }

  function bloco(linhas: string[]) {
    for (const linha of linhas) {
      const titulo = ehTituloDeClausula(linha);
      doc.font(titulo ? "Helvetica-Bold" : "Helvetica").fontSize(BODY_SIZE);
      // Evita linha órfã: pelo menos um título + duas linhas de texto juntos.
      const lineH = doc.currentLineHeight(true) + BODY_GAP;
      ensureSpace(titulo ? lineH * 3 : lineH * 2);
      if (titulo && doc.y > MARGIN_TOP) doc.y += 4;
      doc
        .fillColor(TEXT_DARK)
        .text(linha, MARGIN, doc.y, {
          width: contentWidth,
          lineGap: BODY_GAP,
          align: titulo ? "left" : "justify",
        });
      if (titulo) doc.y += 2;
    }
    doc.y += 9;
  }

  // ── Card das partes ───────────────────────────────────────────────
  function infoCard() {
    const linhas: Array<[string, string]> = [["Aluno", input.alunoNome]];
    if (input.alunoDocumento) linhas.push(["CPF", input.alunoDocumento]);
    if (input.alunoRg) linhas.push(["RG", input.alunoRg]);
    if (input.alunoNascimento) linhas.push(["Nascimento", input.alunoNascimento]);
    if (input.alunoQualificacao) linhas.push(["Qualificação", input.alunoQualificacao]);
    if (input.alunoEmail) linhas.push(["E-mail", input.alunoEmail]);
    if (input.alunoTelefone) linhas.push(["Telefone", input.alunoTelefone]);
    if (input.alunoEndereco) linhas.push(["Endereço", input.alunoEndereco]);
    if (input.evento) {
      linhas.push(["Evento", input.evento.titulo]);
      if (input.evento.data) linhas.push(["Data do evento", input.evento.data]);
      if (input.evento.local) linhas.push(["Local", input.evento.local]);
    }
    if (input.valor) linhas.push(["Valor", input.valor]);

    const padX = 20;
    const padY = 14;
    const rowGap = 7;
    const labelWidth = 110;
    const valueX = MARGIN + padX + labelWidth;
    const valueWidth = contentWidth - padX * 2 - labelWidth;

    doc.font("Helvetica").fontSize(BODY_SIZE);
    const heights = linhas.map(([, valor]) =>
      doc.heightOfString(valor, { width: valueWidth })
    );
    const cardH =
      padY * 2 +
      heights.reduce((a, b) => a + b, 0) +
      (linhas.length - 1) * rowGap;

    ensureSpace(cardH + 8);
    const top = doc.y;

    doc.save();
    doc
      .roundedRect(MARGIN, top, contentWidth, cardH, 6)
      .lineWidth(0.8)
      .fillAndStroke(BG_LIGHT, RULE);
    doc.rect(MARGIN, top + 6, 3, cardH - 12).fill(ACCENT);
    doc.restore();

    let y = top + padY;
    linhas.forEach(([rotulo, valor], i) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(BODY_SIZE)
        .fillColor(TEXT_DARK)
        .text(rotulo, MARGIN + padX, y, { width: labelWidth - 8 });
      doc
        .font("Helvetica")
        .fontSize(BODY_SIZE)
        .fillColor(TEXT_MID)
        .text(valor, valueX, y, { width: valueWidth });
      y += heights[i] + rowGap;
    });

    doc.x = MARGIN;
    doc.y = top + cardH + 26;
  }

  // ── Bloco de assinaturas (nunca dividido entre páginas) ───────────
  function signatureBlock() {
    // Título (~32) + espaço da assinatura (44) + nome/papel e nota (~70).
    const BLOCO_H = 150;
    ensureSpace(BLOCO_H);
    sectionHeader("Assinaturas", 0);

    const gap = 48;
    const colWidth = (contentWidth - gap) / 2;
    const lineY = doc.y + 44;

    const assinantes = [
      { x: MARGIN, nome: input.alunoNome, papel: "Aluno(a) · Outorgante" },
      {
        x: MARGIN + colWidth + gap,
        nome: "Ectolab",
        papel: "Instituição · Outorgada",
      },
    ];

    for (const { x, nome, papel } of assinantes) {
      doc
        .moveTo(x, lineY)
        .lineTo(x + colWidth, lineY)
        .lineWidth(1)
        .strokeColor(TEXT_DARK)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(TEXT_DARK)
        .text(nome, x, lineY + 8, { width: colWidth, align: "center" });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(TEXT_MUTED)
        .text(papel, x, lineY + 23, { width: colWidth, align: "center" });
    }

    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(TEXT_MUTED)
      .text(
        "Assinatura eletrônica com validade jurídica (Assinafy / ICP-Brasil, MP 2.200-2/2001 e Lei 14.063/2020) ou assinatura manual do documento impresso.",
        MARGIN,
        lineY + 46,
        { width: contentWidth, align: "center", lineGap: 2 }
      );
    doc.x = MARGIN;
  }

  // ── Conteúdo do contrato ──────────────────────────────────────────
  sectionHeader("Partes do contrato");
  infoCard();

  sectionHeader("Cláusulas");
  for (const linhas of blocosDoModelo(input.conteudo)) {
    bloco(linhas);
  }

  // Data de emissão — sem cidade: a assinatura é online, cada parte onde
  // estiver (data/hora/IP de cada assinatura ficam no certificado da Assinafy).
  ensureSpace(40);
  doc.y += 8;
  doc
    .font("Helvetica")
    .fontSize(BODY_SIZE)
    .fillColor(TEXT_DARK)
    .text(`Emitido em ${input.emissao}.`, MARGIN, doc.y, {
      width: contentWidth,
      align: "right",
    });
  doc.y += 20;

  signatureBlock();

  // ── Rodapé em todas as páginas ────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const page = doc.page;
    // Zera a margem inferior para escrever no rodapé sem disparar nova página.
    const margemOriginal = page.margins.bottom;
    page.margins.bottom = 0;

    const y = page.height - 46;
    doc
      .moveTo(MARGIN, y - 8)
      .lineTo(page.width - MARGIN, y - 8)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke();

    const rodapeOpts = { lineBreak: false, height: 12 } as const;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text(
        `Ectolab · ${input.modeloTitulo}`.slice(0, 90),
        MARGIN,
        y,
        { ...rodapeOpts, width: contentWidth - 90 }
      );
    doc.text(
      `Página ${i - range.start + 1} de ${range.count}`,
      page.width - MARGIN - 90,
      y,
      { ...rodapeOpts, width: 90, align: "right" }
    );

    page.margins.bottom = margemOriginal;
  }

  doc.end();
  await done;

  return Buffer.concat(chunks);
}
