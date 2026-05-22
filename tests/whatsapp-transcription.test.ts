import { describe, expect, test, vi } from "vitest";

import { transcribeAudio } from "@/lib/whatsapp/transcription";

function makeOpenAi(behavior: () => Promise<{ text: string }> | { text: string }) {
  return {
    audio: {
      transcriptions: {
        create: vi.fn(async () => behavior()),
      },
    },
  } as unknown as Parameters<typeof transcribeAudio>[0]["openai"];
}

const DUMMY_BUFFER = Buffer.from("fake-audio-bytes");

describe("transcribeAudio", () => {
  test("sucesso retorna texto + duração", async () => {
    const openai = makeOpenAi(() => ({ text: "  oi tudo bem  " }));

    const result = await transcribeAudio({
      openai,
      audioBuffer: DUMMY_BUFFER,
      mimeType: "audio/ogg",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.text).toBe("oi tudo bem");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("transcrição vazia → status empty", async () => {
    const openai = makeOpenAi(() => ({ text: "   " }));

    const result = await transcribeAudio({
      openai,
      audioBuffer: DUMMY_BUFFER,
      mimeType: "audio/ogg",
    });

    expect(result.status).toBe("empty");
  });

  test("erro do SDK → status failed com mensagem", async () => {
    const openai = makeOpenAi(() => {
      throw new Error("Whisper API error 500");
    });

    const result = await transcribeAudio({
      openai,
      audioBuffer: DUMMY_BUFFER,
      mimeType: "audio/ogg",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toContain("Whisper API error");
    }
  });

  test("timeout (transcrição demora mais que o limite) → status timeout", async () => {
    const openai = makeOpenAi(
      () =>
        new Promise<{ text: string }>((resolve) => {
          setTimeout(() => resolve({ text: "tarde demais" }), 200);
        }),
    );

    const result = await transcribeAudio({
      openai,
      audioBuffer: DUMMY_BUFFER,
      mimeType: "audio/ogg",
      timeoutMs: 30,
    });

    expect(result.status).toBe("timeout");
  });

  test("buffer vazio → failed (empty_buffer)", async () => {
    const openai = makeOpenAi(() => ({ text: "qualquer" }));

    const result = await transcribeAudio({
      openai,
      audioBuffer: Buffer.alloc(0),
      mimeType: "audio/ogg",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("empty_buffer");
    }
  });

  test("buffer maior que 25MB → failed (audio_too_large)", async () => {
    const openai = makeOpenAi(() => ({ text: "qualquer" }));
    const oversized = Buffer.alloc(26 * 1024 * 1024);

    const result = await transcribeAudio({
      openai,
      audioBuffer: oversized,
      mimeType: "audio/ogg",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("audio_too_large");
    }
  });
});
