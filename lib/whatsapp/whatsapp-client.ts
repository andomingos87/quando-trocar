import type { WhatsappSender } from "./types";

export class WhatsAppCloudApiClient implements WhatsappSender {
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
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(body.error?.message ?? "WhatsApp Cloud API send failed");
    }

    const whatsappMessageId = body.messages?.[0]?.id;
    if (!whatsappMessageId) {
      throw new Error("WhatsApp Cloud API response did not include message id");
    }

    return { whatsappMessageId, response: body };
  }
}
