// Harness de teste conversacional do bot WhatsApp.
//
// Consumido pelo REPL (`scripts/whatsapp/repl.ts`), pelo runner de eval
// (`scripts/whatsapp/eval.ts`), pelo simulador de persona
// (`scripts/whatsapp/persona.ts`) e por suítes em `tests/`.
//
// NUNCA importe daqui em `lib/` ou `app/` — é código de teste (regra
// `no-restricted-imports` em eslint.config.mjs).

export { createHarness, diffSnapshots } from "./webhook-driver";
export type { WhatsappHarness } from "./webhook-driver";
export { createInMemoryRepository } from "./in-memory-repository";
export type { InMemoryWhatsappRepository } from "./in-memory-repository";
export { createRecordingSender, deliveredToText } from "./fake-sender";
export { createRecordedAgents } from "./recording-agents";
export { silenciarFailOpenConhecido } from "./quiet";
export {
  buildInboundPayload,
  signedRequest,
  HARNESS_APP_SECRET,
  HARNESS_VERIFY_TOKEN,
} from "./payload";
export type {
  AgentInvocation,
  AgentKind,
  DeliveredMessage,
  HarnessOptions,
  HarnessProfile,
  SendOptions,
  TurnObservation,
  WorldDiff,
  WorldSeed,
  WorldSnapshot,
} from "./types";
