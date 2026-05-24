import { describe, expect, test, vi } from "vitest";

import { describeImage } from "@/lib/whatsapp/image-vision";

type FakeOpenAI = {
  chat: { completions: { create: ReturnType<typeof vi.fn> } };
};

function makeOpenAi(content: unknown): FakeOpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content } }],
        })),
      },
    },
  };
}

function pngBuffer(): Buffer {
  // PNG mínimo válido (1x1 transparente). Suficiente pra testes — não passa
  // por nenhum decoder, só é passado adiante como base64.
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000162a4c80000000049454e44ae426082",
    "hex",
  );
}

describe("describeImage", () => {
  test("retorna success com texto extraído quando o vision responde", async () => {
    const openai = makeOpenAi("Painel mostra odômetro em 84.500 km");

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/png",
      caption: "olha o km",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.text).toContain("84.500");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  test("sentinela 'imagem sem conteúdo extraível' → status=empty", async () => {
    const openai = makeOpenAi("imagem sem conteúdo extraível");

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/jpeg",
      caption: null,
    });

    expect(result.status).toBe("empty");
  });

  test("sentinela com pontuação ('Imagem sem conteúdo extraível.') também → empty", async () => {
    const openai = makeOpenAi('"Imagem sem conteúdo extraível."');

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/jpeg",
    });

    expect(result.status).toBe("empty");
  });

  test("buffer vazio → failed/empty_buffer", async () => {
    const openai = makeOpenAi("qualquer coisa");

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: Buffer.alloc(0),
      mimeType: "image/png",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("empty_buffer");
    }
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  test("imagem maior que limite → failed/image_too_large", async () => {
    const openai = makeOpenAi("qualquer coisa");
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0);

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: big,
      mimeType: "image/png",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("image_too_large");
    }
  });

  test("mime fora da allowlist → failed/unsupported_mime", async () => {
    const openai = makeOpenAi("qualquer coisa");

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "application/pdf",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("unsupported_mime");
    }
  });

  test("erro do OpenAI → status=failed com error da exceção", async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn(async () => {
            throw new Error("rate_limit_exceeded");
          }),
        },
      },
    };

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/jpeg",
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBe("rate_limit_exceeded");
    }
  });

  test("timeout: chamada que demora além do limite → status=timeout", async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn(
            () =>
              new Promise((resolve) =>
                setTimeout(() => resolve({ choices: [{ message: { content: "tarde demais" } }] }), 200),
              ),
          ),
        },
      },
    };

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/png",
      timeoutMs: 30,
    });

    expect(result.status).toBe("timeout");
  });

  test("resposta com content em array de partes textuais é concatenada", async () => {
    const openai = makeOpenAi([
      { type: "text", text: "Nota fiscal:" },
      { type: "text", text: " R$ 320,00" },
    ]);

    const result = await describeImage({
      // biome-ignore lint/suspicious/noExplicitAny: fake compatível com a interface usada
      openai: openai as any,
      imageBuffer: pngBuffer(),
      mimeType: "image/png",
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.text).toContain("R$ 320,00");
    }
  });
});
