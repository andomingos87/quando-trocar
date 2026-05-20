import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const INADIMPLENCIA_MESSAGE =
  "Seu acesso ao Quando Trocar esta suspenso por falta de pagamento. " +
  "Para reativar, conclua o pagamento no link enviado pelo WhatsApp. " +
  "Em caso de duvida, fale com o suporte.";

export const ADMIN_PAUSA_MESSAGE =
  "Seu acesso ao Quando Trocar esta suspenso. " +
  "Fale com o suporte para regularizar.";

export type OficinaPauseMotivo = "inadimplencia" | "voluntaria" | "admin";

export type OficinaPauseState =
  | { paused: false }
  | { paused: true; motivoPausa: OficinaPauseMotivo };

export async function getOficinaPauseState(
  oficinaId: string,
): Promise<OficinaPauseState> {
  if (!oficinaId) return { paused: false };
  // Fail-open: se o admin client nao puder ser criado (ex.: env nao
  // configurada em ambiente de teste), nao bloqueia o bot. Check defensivo,
  // nao critico para correctness.
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("oficinas")
      .select("status, motivo_pausa")
      .eq("id", oficinaId)
      .maybeSingle();
    if (!data) return { paused: false };
    if (data.status !== "pausada") return { paused: false };

    const motivoPausa = data.motivo_pausa as OficinaPauseMotivo | null;
    if (
      motivoPausa !== "inadimplencia" &&
      motivoPausa !== "voluntaria" &&
      motivoPausa !== "admin"
    ) {
      return { paused: false };
    }
    return { paused: true, motivoPausa };
  } catch (err) {
    console.error("oficina pause state check failed (fail-open)", err);
    return { paused: false };
  }
}

// Deprecated alias retido enquanto callers nao foram migrados. Prefere
// getOficinaPauseState — esta funcao colapsa todo motivo de pausa para
// uma mensagem unica de inadimplencia, o que nao reflete mais a regra.
export type InadimplenciaGuardResult =
  | { suspended: false }
  | { suspended: true; message: string };

export async function checkOficinaInadimplencia(
  oficinaId: string,
): Promise<InadimplenciaGuardResult> {
  const state = await getOficinaPauseState(oficinaId);
  if (!state.paused) return { suspended: false };
  if (state.motivoPausa === "admin") {
    return { suspended: true, message: ADMIN_PAUSA_MESSAGE };
  }
  return { suspended: true, message: INADIMPLENCIA_MESSAGE };
}
