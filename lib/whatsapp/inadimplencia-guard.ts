import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const INADIMPLENCIA_MESSAGE =
  "Seu acesso ao Quando Trocar esta suspenso por falta de pagamento. " +
  "Para reativar, conclua o pagamento no link enviado pelo WhatsApp. " +
  "Em caso de duvida, fale com o suporte.";

export type InadimplenciaGuardResult =
  | { suspended: false }
  | { suspended: true; message: string };

export async function checkOficinaInadimplencia(
  oficinaId: string,
): Promise<InadimplenciaGuardResult> {
  if (!oficinaId) return { suspended: false };
  // Fail-open: se o admin client nao puder ser criado (ex.: env nao
  // configurada em ambiente de teste), nao bloqueia o bot. O check tem
  // intencao defensiva, nao critica para correctness.
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("oficinas")
      .select("status, motivo_pausa")
      .eq("id", oficinaId)
      .maybeSingle();
    if (!data) return { suspended: false };
    if (data.status === "pausada" && data.motivo_pausa === "inadimplencia") {
      return { suspended: true, message: INADIMPLENCIA_MESSAGE };
    }
    return { suspended: false };
  } catch (err) {
    console.error("inadimplencia guard check failed (fail-open)", err);
    return { suspended: false };
  }
}
