import { describe, expect, test, beforeAll } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { extractDocumentText } from "@/lib/whatsapp/document-text";

async function generatePdfBufferWithText(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  // A4 (~595x842 pt). Texto pequeno para não estourar a página.
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 40, y: 780, size: 11, font, maxWidth: 500 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function generateScannedLikePdfBuffer(): Promise<Buffer> {
  // PDF "vazio" (sem texto extraível) — simula scan ou imagem incorporada.
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe("extractDocumentText", () => {
  let pdfWithText: Buffer;
  let pdfWithoutText: Buffer;

  beforeAll(async () => {
    pdfWithText = await generatePdfBufferWithText(
      "Orcamento troca de oleo Civic 2018 R$ 320,00 - oficina Quando Trocar",
    );
    pdfWithoutText = await generateScannedLikePdfBuffer();
  });
  test("buffer vazio → failed/empty_buffer", async () => {
    const result = await extractDocumentText({
      documentBuffer: Buffer.alloc(0),
      mimeType: "application/pdf",
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("empty_buffer");
    }
  });

  test("mime não-PDF → failed/unsupported_mime", async () => {
    const result = await extractDocumentText({
      documentBuffer: Buffer.from("%PDF-1.4 fake"),
      mimeType: "application/msword",
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("unsupported_mime");
    }
  });

  test("documento > 20MB → failed/document_too_large", async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0);
    const result = await extractDocumentText({
      documentBuffer: big,
      mimeType: "application/pdf",
    });
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("document_too_large");
    }
  });

  test("PDF com texto extraível → success com texto contendo a frase", async () => {
    const result = await extractDocumentText({
      documentBuffer: pdfWithText,
      mimeType: "application/pdf",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.text.toLowerCase()).toContain("civic 2018");
      expect(result.text).toContain("R$ 320,00");
      expect(result.pageCount).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("PDF sem texto extraível (simulando scan) → empty", async () => {
    const result = await extractDocumentText({
      documentBuffer: pdfWithoutText,
      mimeType: "application/pdf",
    });

    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.pageCount).toBe(1);
    }
  });

  test("PDF inválido (não parseable) → failed", async () => {
    const result = await extractDocumentText({
      documentBuffer: Buffer.from("not a real pdf"),
      mimeType: "application/pdf",
    });
    expect(result.status).toBe("failed");
  });
});
