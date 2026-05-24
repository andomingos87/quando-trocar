// Extração de texto de documentos PDF (ADR-0016).
//
// Usamos `unpdf` (zero-binário, funciona em runtime serverless). Apenas
// `application/pdf` é suportado — outros tipos de documento caem em failed e
// disparam o fallback contextual da F0.
//
// PDFs escaneados (texto extraído < 50 chars úteis) também caem em
// `empty`/`failed` — não roteamos pra vision pra evitar custos imprevisíveis
// com PDFs grandes.

import { extractText, getDocumentProxy } from "unpdf";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_DOC_BYTES = 20 * 1024 * 1024;
const MIN_USEFUL_TEXT_CHARS = 50;
const MAX_BODY_CHARS = 2000;

const ALLOWED_MIMES = new Set(["application/pdf"]);

export type DocumentExtractionStatus =
  | "success"
  | "empty"
  | "failed"
  | "timeout";

export type DocumentExtractionResult =
  | { status: "success"; text: string; durationMs: number; pageCount: number }
  | { status: "empty"; durationMs: number; pageCount: number }
  | { status: "timeout" }
  | { status: "failed"; error: string };

export type ExtractDocumentInput = {
  documentBuffer: Buffer;
  mimeType: string;
  timeoutMs?: number;
};

function isMimeAllowed(mimeType: string): boolean {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIMES.has(normalized);
}

function normalizeExtractedText(parts: string[] | string): string {
  const joined = Array.isArray(parts) ? parts.join("\n") : parts;
  // Heurística simples: PDFs escaneados ou imagens incorporadas costumam
  // devolver string vazia ou só whitespace. Limpamos espaços repetidos.
  return joined.replace(/\s+/g, " ").trim();
}

function isMostlyEmpty(text: string): boolean {
  if (text.length < MIN_USEFUL_TEXT_CHARS) return true;
  // Conta caracteres realmente alfanuméricos. Strings com lixo de glyphs
  // (â–, „, etc.) caem aqui também.
  const alnum = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  return alnum < MIN_USEFUL_TEXT_CHARS;
}

export async function extractDocumentText({
  documentBuffer,
  mimeType,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ExtractDocumentInput): Promise<DocumentExtractionResult> {
  if (documentBuffer.byteLength === 0) {
    return { status: "failed", error: "empty_buffer" };
  }

  if (documentBuffer.byteLength > MAX_DOC_BYTES) {
    return { status: "failed", error: "document_too_large" };
  }

  if (!isMimeAllowed(mimeType)) {
    return { status: "failed", error: "unsupported_mime" };
  }

  const startedAt = Date.now();

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<DocumentExtractionResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ status: "timeout" });
    }, timeoutMs);
  });

  try {
    const extractionPromise = (async (): Promise<DocumentExtractionResult> => {
      try {
        // `unpdf` aceita Uint8Array; Buffer já é compatível.
        const bytes = new Uint8Array(
          documentBuffer.buffer,
          documentBuffer.byteOffset,
          documentBuffer.byteLength,
        );
        const pdf = await getDocumentProxy(bytes);
        const pageCount = pdf.numPages;
        const { text } = await extractText(pdf, { mergePages: true });
        const normalized = normalizeExtractedText(text);
        const durationMs = Date.now() - startedAt;

        if (isMostlyEmpty(normalized)) {
          return { status: "empty", durationMs, pageCount };
        }

        const truncated =
          normalized.length > MAX_BODY_CHARS
            ? `${normalized.slice(0, MAX_BODY_CHARS)}…`
            : normalized;

        return { status: "success", text: truncated, durationMs, pageCount };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "document_extraction_failed";
        return { status: "failed", error: message };
      }
    })();

    return await Promise.race([extractionPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
