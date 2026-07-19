import type {
  FollowupLeadCandidate,
  LeadStatus,
  WhatsappRepository,
  WhatsappSender,
} from "./types";

// Follow-up proativo de leads (CV4, QTR-13). Reengaja leads que esfriaram
// enviando um template Meta aprovado (fora da janela de 24h — ADR-0005).
//
// Invariantes:
// - LLM não entra aqui: seleção e texto são 100% determinísticos (ADR-0001).
// - Máx 2 follow-ups por lead; nunca para perdido/convertido/teste_aceito nem
//   para conversa em handoff.
// - Idempotência: o contador só avança APÓS envio com sucesso, então rodar o
//   job 2× no mesmo dia não duplica envio (o card exige isso).

// Só reengajamos leads que ainda estão na conversa de vendas mas esfriaram.
// perdido/convertido/teste_aceito ficam de fora (nada a reengajar / já quente).
const ELIGIBLE_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "em_conversa",
  "qualificado",
]);

const MAX_FOLLOWUPS = 2;
const DEFAULT_FIRST_WINDOW_HOURS = 24;
const DEFAULT_SECOND_WINDOW_HOURS = 72;
// Trava extra contra dois follow-ups no mesmo dia mesmo com janelas mal
// configuradas: exige um intervalo mínimo desde o último envio.
const MIN_GAP_HOURS = 20;

const HOUR_MS = 3_600_000;

export type SelectedFollowup = FollowupLeadCandidate & {
  followupNumber: 1 | 2;
};

// Decide, de forma pura e testável, quais candidatos recebem follow-up agora e
// qual número (1º/2º). Recebe o relógio por parâmetro para o teste ser
// determinístico.
export function selectLeadsForFollowup(input: {
  candidates: FollowupLeadCandidate[];
  now: Date;
  firstWindowHours?: number;
  secondWindowHours?: number;
}): SelectedFollowup[] {
  const firstWindow = input.firstWindowHours ?? DEFAULT_FIRST_WINDOW_HOURS;
  const secondWindow = input.secondWindowHours ?? DEFAULT_SECOND_WINDOW_HOURS;
  const nowMs = input.now.getTime();

  const selected: SelectedFollowup[] = [];
  for (const candidate of input.candidates) {
    // Exclusões (o repositório já filtra a maioria, mas repetimos aqui para a
    // função ser correta por si só e coberta pelos testes).
    if (!ELIGIBLE_STATUSES.has(candidate.status)) continue;
    if (candidate.handoffRequired) continue;
    if (candidate.followupCount >= MAX_FOLLOWUPS) continue;
    // Sem conversa não há onde registrar o outbound em `mensagens`.
    if (!candidate.conversationId) continue;

    const referenceMs = Date.parse(candidate.referenceAt);
    if (Number.isNaN(referenceMs)) continue;

    // Intervalo mínimo desde o último follow-up (idempotência reforçada).
    if (candidate.lastFollowupAt) {
      const gapMs = nowMs - Date.parse(candidate.lastFollowupAt);
      if (!(gapMs >= MIN_GAP_HOURS * HOUR_MS)) continue;
    }

    const followupNumber: 1 | 2 = candidate.followupCount === 0 ? 1 : 2;
    const windowHours = followupNumber === 1 ? firstWindow : secondWindow;
    const hoursSinceReference = (nowMs - referenceMs) / HOUR_MS;
    if (hoursSinceReference >= windowHours) {
      selected.push({ ...candidate, followupNumber });
    }
  }
  return selected;
}

// Primeiro nome, para o parâmetro {{1}} do template. Vazio → saudação neutra.
function firstName(nome: string | null): string {
  const trimmed = (nome ?? "").trim();
  if (trimmed.length === 0) return "tudo bem";
  return trimmed.split(/\s+/)[0];
}

export type FollowupBatchResult = {
  candidates: number;
  selected: number;
  sent: number;
  failed: number;
};

// Orquestra o batch: busca candidatos, seleciona, envia o template e avança o
// contador (só em sucesso). Espelha o desenho do `reminder-worker.ts`.
export async function processFollowupLeadsBatch(input: {
  repository: WhatsappRepository;
  whatsapp: WhatsappSender;
  now?: Date;
  limit?: number;
  firstWindowHours?: number;
  secondWindowHours?: number;
  templateFirst: string;
  templateSecond: string;
  templateLanguage?: string;
}): Promise<FollowupBatchResult> {
  if (!input.repository.listFollowupCandidates) {
    throw new Error("Follow-up candidate listing is not available");
  }
  if (!input.repository.markLeadFollowup) {
    throw new Error("Follow-up marking is not available");
  }
  if (!input.whatsapp.sendTemplateMessage) {
    throw new Error("WhatsApp template sending is not available");
  }

  const now = input.now ?? new Date();
  const templateLanguage = input.templateLanguage ?? "pt_BR";
  const limit = input.limit ?? 100;

  const candidates = await input.repository.listFollowupCandidates({ limit });
  const selected = selectLeadsForFollowup({
    candidates,
    now,
    firstWindowHours: input.firstWindowHours,
    secondWindowHours: input.secondWindowHours,
  });

  let sent = 0;
  let failed = 0;

  for (const lead of selected) {
    const templateName =
      lead.followupNumber === 1 ? input.templateFirst : input.templateSecond;
    const bodyParameters = [firstName(lead.nome)];
    const conversationId = lead.conversationId!;

    const outbox = await input.repository.createOutboundMessage({
      conversationId,
      leadId: lead.leadId,
      to: lead.whatsapp,
      body: `[follow-up ${lead.followupNumber}] template ${templateName}`,
      messageKind: "template",
      templateName,
      templateLanguage,
      templateParams: { bodyParameters },
    });

    try {
      const response = await input.whatsapp.sendTemplateMessage({
        to: lead.whatsapp,
        templateName,
        languageCode: templateLanguage,
        bodyParameters,
      });

      await input.repository.markOutboundSent({
        outboundMessageId: outbox.id,
        whatsappMessageId: response.whatsappMessageId,
        response: response.response ?? null,
      });
      await input.repository.saveOutboundMessage({
        conversationId,
        leadId: lead.leadId,
        whatsappMessageId: response.whatsappMessageId,
        body: `Follow-up ${lead.followupNumber} enviado (${templateName}).`,
        rawMessage: response.response ?? null,
        sentAt: now.toISOString(),
      });
      // Só avança o contador em sucesso — idempotência do cron.
      await input.repository.markLeadFollowup({
        leadId: lead.leadId,
        followupNumber: lead.followupNumber,
        at: now.toISOString(),
      });
      sent += 1;
    } catch (error) {
      await input.repository.markOutboundFailed({
        outboundMessageId: outbox.id,
        errorMessage:
          error instanceof Error ? error.message : "follow-up send failed",
      });
      failed += 1;
    }
  }

  return {
    candidates: candidates.length,
    selected: selected.length,
    sent,
    failed,
  };
}
