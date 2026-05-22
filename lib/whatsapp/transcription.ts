import OpenAI, { toFile } from "openai";

import type { TranscriptionStatus } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
// Whisper aceita até 25MB; Meta limita arquivos de áudio a ~16MB.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export type TranscriptionResult =
  | { status: Extract<TranscriptionStatus, "success">; text: string; durationMs: number }
  | { status: Extract<TranscriptionStatus, "empty">; durationMs: number }
  | { status: Extract<TranscriptionStatus, "timeout"> }
  | { status: Extract<TranscriptionStatus, "failed">; error: string };

export type TranscribeAudioInput = {
  openai: OpenAI;
  audioBuffer: Buffer;
  mimeType: string;
  timeoutMs?: number;
};

function extensionForMime(mimeType: string): string {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  switch (normalized) {
    case "audio/ogg":
    case "audio/opus":
      return "ogg";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "m4a";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    case "audio/webm":
      return "webm";
    case "audio/amr":
      return "amr";
    case "audio/3gpp":
      return "3gp";
    default:
      return "ogg";
  }
}

export async function transcribeAudio({
  openai,
  audioBuffer,
  mimeType,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TranscribeAudioInput): Promise<TranscriptionResult> {
  if (audioBuffer.byteLength === 0) {
    return { status: "failed", error: "empty_buffer" };
  }

  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    return { status: "failed", error: "audio_too_large" };
  }

  const startedAt = Date.now();
  const filename = `audio.${extensionForMime(mimeType)}`;

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<TranscriptionResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ status: "timeout" });
    }, timeoutMs);
  });

  try {
    const transcriptionPromise = (async (): Promise<TranscriptionResult> => {
      try {
        const file = await toFile(audioBuffer, filename, { type: mimeType });
        const response = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
          language: "pt",
          response_format: "json",
        });

        const durationMs = Date.now() - startedAt;
        const text = (response.text ?? "").trim();

        if (!text) {
          return { status: "empty", durationMs };
        }

        return { status: "success", text, durationMs };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "transcription_failed";
        return { status: "failed", error: message };
      }
    })();

    return await Promise.race([transcriptionPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
