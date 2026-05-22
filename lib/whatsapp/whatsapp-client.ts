import type { WhatsappSender } from "./types";

export type WhatsappMediaMetadata = {
  url: string;
  mimeType: string;
  fileSize: number | null;
  sha256: string | null;
};

export type WhatsappMediaDownloader = {
  getMediaMetadata(mediaId: string): Promise<WhatsappMediaMetadata>;
  downloadMedia(url: string): Promise<Buffer>;
};

export class WhatsAppCloudApiClient implements WhatsappSender, WhatsappMediaDownloader {
  constructor(
    private readonly input = {
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
  ) {}

  async sendTextMessage(input: { to: string; body: string }) {
    if (!this.input.accessToken || !this.input.phoneNumberId) {
      throw new Error("Missing WhatsApp Cloud API environment variables");
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${this.input.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.input.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to.replace(/^\+/, ""),
          type: "text",
          text: {
            preview_url: false,
            body: input.body,
          },
        }),
      },
    );

    const body = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: string | number };
    };

    if (!response.ok) {
      const error = new Error(body.error?.message ?? "WhatsApp Cloud API send failed");
      Object.assign(error, {
        code: body.error?.code ? String(body.error.code) : null,
        retryable: response.status >= 500 || response.status === 429,
        providerMessage: body.error?.message ?? null,
        response: body,
      });
      throw error;
    }

    const whatsappMessageId = body.messages?.[0]?.id;
    if (!whatsappMessageId) {
      throw new Error("WhatsApp Cloud API response did not include message id");
    }

    return { whatsappMessageId, response: body };
  }

  async sendTemplateMessage(input: {
    to: string;
    templateName: string;
    languageCode: string;
    bodyParameters: string[];
  }) {
    if (!this.input.accessToken || !this.input.phoneNumberId) {
      throw new Error("Missing WhatsApp Cloud API environment variables");
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${this.input.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.input.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to.replace(/^\+/, ""),
          type: "template",
          template: {
            name: input.templateName,
            language: {
              code: input.languageCode,
            },
            components: [
              {
                type: "body",
                parameters: input.bodyParameters.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }),
      },
    );

    const body = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: string | number };
    };

    if (!response.ok) {
      const error = new Error(body.error?.message ?? "WhatsApp Cloud API template send failed");
      Object.assign(error, {
        code: body.error?.code ? String(body.error.code) : null,
        retryable: response.status >= 500 || response.status === 429,
        providerMessage: body.error?.message ?? null,
        response: body,
      });
      throw error;
    }

    const whatsappMessageId = body.messages?.[0]?.id;
    if (!whatsappMessageId) {
      throw new Error("WhatsApp Cloud API response did not include message id");
    }

    return { whatsappMessageId, response: body };
  }

  async getMediaMetadata(mediaId: string): Promise<WhatsappMediaMetadata> {
    if (!this.input.accessToken) {
      throw new Error("Missing WhatsApp Cloud API access token");
    }

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.input.accessToken}`,
        },
      },
    );

    const body = (await response.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
      sha256?: string;
      error?: { message?: string; code?: string | number };
    };

    if (!response.ok || !body.url) {
      const error = new Error(
        body.error?.message ?? "WhatsApp Cloud API media metadata fetch failed",
      );
      Object.assign(error, {
        code: body.error?.code ? String(body.error.code) : null,
        retryable: response.status >= 500 || response.status === 429,
        providerMessage: body.error?.message ?? null,
        response: body,
      });
      throw error;
    }

    return {
      url: body.url,
      mimeType: body.mime_type ?? "audio/ogg",
      fileSize: typeof body.file_size === "number" ? body.file_size : null,
      sha256: body.sha256 ?? null,
    };
  }

  async downloadMedia(url: string): Promise<Buffer> {
    if (!this.input.accessToken) {
      throw new Error("Missing WhatsApp Cloud API access token");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.input.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = new Error(
        `WhatsApp Cloud API media download failed (${response.status})`,
      );
      Object.assign(error, {
        code: String(response.status),
        retryable: response.status >= 500 || response.status === 429,
        providerMessage: response.statusText,
      });
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
