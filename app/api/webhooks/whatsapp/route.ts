import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WhatsappOnboardingAgent } from "@/lib/whatsapp/onboarding-agent";
import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";
import { WhatsappSalesAgent } from "@/lib/whatsapp/sales-agent";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";
import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";

export const runtime = "nodejs";

function getWebhookEnv() {
  return {
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  };
}

function getPostHandlers() {
  return createWhatsappWebhookHandlers({
    env: getWebhookEnv(),
    repository: new SupabaseWhatsappRepository(createSupabaseAdminClient()),
    whatsapp: new WhatsAppCloudApiClient(),
    agent: new WhatsappSalesAgent(),
    onboardingAgent: new WhatsappOnboardingAgent(),
  });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export function POST(request: Request) {
  return getPostHandlers().POST(request);
}
