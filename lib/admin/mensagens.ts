import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { maskWhatsapp, truncateMessage } from "./pii";
import { normalizePhoneToE164 } from "./phone";

// ADR-0001: retry e iniciativa do admin humano. Apenas reenfileira para o
// worker existente — nao chama Meta diretamente daqui.

export type OutboundStatus = "pending" | "sent" | "failed" | "retry_scheduled";
export type MessageKind = "text" | "template";

export type OutboundListRow = {
  id: string;
  oficina_id: string | null;
  oficina_nome: string | null;
  to_whatsapp_mascarado: string;
  message_kind: MessageKind;
  template_name: string | null;
  body_truncado: string;
  status: OutboundStatus;
  attempts: number | null;
  provider_error_code: string | null;
  provider_error_message_truncado: string;
  sent_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
  lembrete_id: string | null;
};

export type OutboundListFilters = {
  status?: OutboundStatus | "todas";
  message_kind?: MessageKind;
  oficina_id?: string;
  periodo?: "ultimas_24h" | "ultimos_7d" | "ultimos_30d";
  busca?: string;
  page?: number;
  pageSize?: number;
};

export type OutboundListResult = {
  rows: OutboundListRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 50;

function periodoToSinceIso(
  periodo: OutboundListFilters["periodo"],
): string | undefined {
  if (!periodo) return undefined;
  const now = Date.now();
  if (periodo === "ultimas_24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (periodo === "ultimos_7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (periodo === "ultimos_30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

export async function listOutboundMessages(
  supabase: SupabaseClient,
  filters: OutboundListFilters = {},
): Promise<OutboundListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("outbound_messages")
    .select(
      `id, oficina_id, to_whatsapp, message_kind, template_name, body, status, attempts,
       provider_error_code, provider_error_message, sent_at, next_attempt_at, created_at, lembrete_id,
       oficinas:oficina_id (nome)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "todas") {
    query = query.eq("status", filters.status);
  }
  if (filters.message_kind) query = query.eq("message_kind", filters.message_kind);
  if (filters.oficina_id) query = query.eq("oficina_id", filters.oficina_id);

  const sinceIso = periodoToSinceIso(filters.periodo);
  if (sinceIso) query = query.gte("created_at", sinceIso);

  if (filters.busca && filters.busca.trim().length > 0) {
    const term = filters.busca.trim();
    const phone = normalizePhoneToE164(term);
    if (phone.ok) {
      query = query.eq("to_whatsapp", phone.e164);
    } else {
      const safe = term.replace(/[%,]/g, "");
      query = query.ilike("template_name", `%${safe}%`);
    }
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`list_outbound_failed: ${error.message}`);

  const rows: OutboundListRow[] = (data ?? []).map((m) => {
    const oficinaRaw = m.oficinas as { nome: string } | { nome: string }[] | null;
    const oficina = Array.isArray(oficinaRaw) ? oficinaRaw[0] ?? null : oficinaRaw;
    return {
      id: m.id as string,
      oficina_id: (m.oficina_id ?? null) as string | null,
      oficina_nome: oficina?.nome ?? null,
      to_whatsapp_mascarado: maskWhatsapp(m.to_whatsapp as string),
      message_kind: m.message_kind as MessageKind,
      template_name: (m.template_name ?? null) as string | null,
      body_truncado: truncateMessage((m.body as string | null) ?? "", 80),
      status: m.status as OutboundStatus,
      attempts: (m.attempts ?? null) as number | null,
      provider_error_code: (m.provider_error_code ?? null) as string | null,
      provider_error_message_truncado: truncateMessage(
        (m.provider_error_message as string | null) ?? "",
        100,
      ),
      sent_at: (m.sent_at ?? null) as string | null,
      next_attempt_at: (m.next_attempt_at ?? null) as string | null,
      created_at: m.created_at as string,
      lembrete_id: (m.lembrete_id ?? null) as string | null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

// ----------------------------------------------------------------------------
// Mutacoes
// ----------------------------------------------------------------------------

const RETRYABLE_STATUSES = new Set<OutboundStatus>(["failed", "retry_scheduled"]);

export async function retryOutboundMessage(
  supabase: SupabaseClient,
  id: string,
  ctx: { adminId: string; ip: string | null },
): Promise<{ ok: true; id: string; status: OutboundStatus }> {
  const { data: before, error: readErr } = await supabase
    .from("outbound_messages")
    .select("id, status, attempts, oficina_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(`retry_outbound_read_failed: ${readErr.message}`);
  if (!before) {
    const err = new Error("outbound_message_not_found");
    Object.assign(err, { status: 404 });
    throw err;
  }
  if (!RETRYABLE_STATUSES.has(before.status as OutboundStatus)) {
    const err = new Error(
      `Mensagem com status "${before.status}" nao pode ser reenfileirada.`,
    );
    Object.assign(err, { status: 409 });
    throw err;
  }

  // Apenas reenfileira: muda status para "pending" e zera next_attempt_at para
  // imediato. O worker existente sera quem chama o WhatsApp Cloud API.
  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("outbound_messages")
    .update({
      status: "pending",
      next_attempt_at: nowIso,
      provider_error_code: null,
      provider_error_message: null,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (updErr) throw new Error(`retry_outbound_update_failed: ${updErr.message}`);

  await supabase.from("admin_audit_log").insert({
    admin_id: ctx.adminId,
    acao: "outbound_message.retry",
    entidade: "outbound_messages",
    entidade_id: id,
    payload: {
      before: { status: before.status, attempts: before.attempts },
      reenfileirado_em: nowIso,
    },
    ip: ctx.ip,
  });

  return { ok: true, id, status: "pending" };
}
