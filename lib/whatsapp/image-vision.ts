import OpenAI from "openai";

const DEFAULT_TIMEOUT_MS = 12_000;
// gpt-4o-mini com vision aceita imagens generosas, mas no contexto WhatsApp o
// Meta limita anexos a ~5MB. Mantemos margem.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ["image/"];

const EMPTY_SENTINEL = "imagem sem conteúdo extraível";

export type ImageVisionStatus = "success" | "empty" | "failed" | "timeout";

export type ImageVisionResult =
  | { status: "success"; text: string; durationMs: number }
  | { status: "empty"; durationMs: number }
  | { status: "timeout" }
  | { status: "failed"; error: string };

export type DescribeImageInput = {
  openai: OpenAI;
  imageBuffer: Buffer;
  mimeType: string;
  caption?: string | null;
  model?: string;
  timeoutMs?: number;
};

function isMimeAllowed(mimeType: string): boolean {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const cleanMime = mimeType.split(";")[0].trim() || "image/jpeg";
  const base64 = buffer.toString("base64");
  return `data:${cleanMime};base64,${base64}`;
}

function buildPrompt(caption: string | null | undefined): string {
  const captionLine = caption?.trim()
    ? `Legenda enviada pelo usuário: "${caption.trim()}".`
    : "O usuário não enviou legenda.";

  // Prompt explícito em pt-BR. Sentinela curta para o webhook detectar
  // facilmente. 1 frase para manter o `body` compacto no agente.
  return [
    "Você está ajudando um agente de atendimento de uma oficina mecânica brasileira.",
    "O usuário enviou uma foto pelo WhatsApp.",
    captionLine,
    "Extraia em UMA frase objetiva e curta em pt-BR o que é útil para o atendimento:",
    "odômetro/km visível, placa, valor de nota fiscal, peça ou serviço identificável.",
    `Se a imagem não trouxer NENHUM desses elementos com clareza, responda EXATAMENTE: "${EMPTY_SENTINEL}".`,
    "Não invente números, não descreva ângulos, não comente a qualidade da foto.",
  ].join(" ");
}

export async function describeImage({
  openai,
  imageBuffer,
  mimeType,
  caption,
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: DescribeImageInput): Promise<ImageVisionResult> {
  if (imageBuffer.byteLength === 0) {
    return { status: "failed", error: "empty_buffer" };
  }

  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    return { status: "failed", error: "image_too_large" };
  }

  if (!isMimeAllowed(mimeType)) {
    return { status: "failed", error: "unsupported_mime" };
  }

  const visionModel =
    model ?? process.env.OPENAI_MODEL_VISION ?? "gpt-4o-mini";
  const startedAt = Date.now();
  const dataUrl = bufferToDataUrl(imageBuffer, mimeType);
  const prompt = buildPrompt(caption);

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<ImageVisionResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ status: "timeout" });
    }, timeoutMs);
  });

  try {
    const visionPromise = (async (): Promise<ImageVisionResult> => {
      try {
        const response = await openai.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 120,
        });

        const durationMs = Date.now() - startedAt;
        const raw: unknown = response.choices[0]?.message?.content;
        let text = "";
        if (typeof raw === "string") {
          text = raw.trim();
        } else if (Array.isArray(raw)) {
          text = (raw as unknown[])
            .map((part) =>
              typeof part === "object" && part !== null && "text" in part
                ? String((part as { text: unknown }).text ?? "")
                : "",
            )
            .join(" ")
            .trim();
        }

        if (!text) {
          return { status: "empty", durationMs };
        }

        // Normaliza para detectar a sentinela mesmo com pontuação diferente.
        const normalized = text.toLowerCase().replace(/[".]/g, "").trim();
        if (normalized.includes(EMPTY_SENTINEL)) {
          return { status: "empty", durationMs };
        }

        return { status: "success", text, durationMs };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "vision_failed";
        return { status: "failed", error: message };
      }
    })();

    return await Promise.race([visionPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
