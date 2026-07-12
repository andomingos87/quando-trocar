import { getGateway } from "@/lib/payments/factory";
import { processPaymentWebhook } from "@/lib/payments/process-webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook do ASAAS (ADR-0021). Configure esta URL no painel do ASAAS com um
// authToken; o token e validado em AsaasGateway.verifyWebhook (asaas-access-token).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const supabase = createSupabaseAdminClient();
  let gateway;
  try {
    gateway = await getGateway(supabase, "asaas");
  } catch (err) {
    console.error("asaas webhook gateway unavailable", err);
    return new Response(JSON.stringify({ ok: true, ignored: "gateway_unavailable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return processPaymentWebhook(supabase, gateway, request, rawBody);
}
