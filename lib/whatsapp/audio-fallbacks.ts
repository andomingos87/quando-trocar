import type { ConversationAgentMode, TranscriptionStatus } from "./types";

type AudioFallbackReason = Exclude<TranscriptionStatus, "success">;

// Mensagens curtas, PT-BR, sem jargão técnico ("Whisper", "OpenAI", "timeout").
// Cada modo de conversa tem seu próprio tom; o cliente final deve perceber a
// continuidade do agente em cena, não um erro genérico do sistema.
const FALLBACKS: Record<ConversationAgentMode, Record<AudioFallbackReason, string>> = {
  vendas: {
    failed:
      "Recebi seu áudio mas não consegui ouvir direito por aqui. Pode mandar por texto rapidinho? Assim já consigo te ajudar com o orçamento.",
    empty:
      "Recebi seu áudio mas parece que veio em silêncio. Pode mandar a mensagem por texto? Já te respondo na hora.",
    timeout:
      "Seu áudio chegou bem grande e não consegui ouvir tudo agora. Pode mandar resumido por texto? Aí já te passo o orçamento.",
  },
  onboarding: {
    failed:
      "Recebi seu áudio mas não consegui entender por aqui. Pode digitar os dados do cliente pra eu cadastrar?",
    empty:
      "Seu áudio chegou em silêncio. Pode mandar por texto os dados do cliente pra eu cadastrar?",
    timeout:
      "Seu áudio ficou longo demais e não consegui processar agora. Pode mandar os dados do cliente por texto?",
  },
  operacao: {
    failed:
      "Recebi seu áudio mas não consegui entender por aqui. Pode mandar por texto o que precisa?",
    empty:
      "Seu áudio chegou em silêncio. Pode digitar a mensagem? Já te respondo.",
    timeout:
      "Seu áudio ficou longo demais e não consegui processar. Pode mandar por texto resumido?",
  },
  cliente_final_lembrete: {
    failed:
      "Oi! Recebi seu áudio mas não consegui ouvir aqui. Pra confirmar ou reagendar, pode responder por texto?",
    empty:
      "Oi! Seu áudio chegou em silêncio. Pode responder por texto pra eu confirmar ou reagendar?",
    timeout:
      "Oi! Seu áudio ficou longo e não consegui processar agora. Pode responder por texto?",
  },
  suporte: {
    failed:
      "Recebi seu áudio mas não consegui entender direito. Pode descrever por texto o que está acontecendo?",
    empty:
      "Seu áudio chegou em silêncio. Pode escrever por texto o que está acontecendo?",
    timeout:
      "Seu áudio ficou longo e não consegui processar agora. Pode descrever por texto, mesmo que resumido?",
  },
  cobranca: {
    failed:
      "Recebi seu áudio mas não consegui entender por aqui. Pode mandar por texto pra eu te ajudar com o pagamento?",
    empty:
      "Seu áudio chegou em silêncio. Pode escrever pra eu te ajudar com o pagamento?",
    timeout:
      "Seu áudio ficou longo demais. Pode resumir por texto pra eu te ajudar com o pagamento?",
  },
};

export function audioFallbackMessage(
  agentMode: ConversationAgentMode,
  reason: AudioFallbackReason,
): string {
  return FALLBACKS[agentMode][reason];
}
