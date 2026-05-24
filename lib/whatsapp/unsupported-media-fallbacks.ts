import type {
  ConversationAgentMode,
  UnsupportedInboundMediaType,
} from "./types";

// Mensagens curtas, PT-BR, sem jargão técnico. Estrutura espelha
// `audio-fallbacks.ts`: o cliente final / oficina deve perceber a continuidade
// do agente em cena, não um erro genérico do sistema.
//
// Hoje image e document têm pipeline próprio (ADR-0016) — quando o pipeline
// falha, eles caem nestes mesmos fallbacks. Por isso a tabela mantém entradas
// para `image` e `document` também, mesmo eles não sendo "unsupported" em si.

type FallbackKind = UnsupportedInboundMediaType | "image" | "document";

const FALLBACKS: Record<ConversationAgentMode, Record<FallbackKind, string>> = {
  vendas: {
    image:
      "Recebi sua foto mas não consegui ver com clareza por aqui. Pode me contar por texto o que você precisa? Já sigo com o orçamento.",
    document:
      "Recebi seu documento mas não consegui abrir por aqui. Pode resumir por texto o que você precisa? Já te respondo.",
    sticker:
      "Recebi sua mensagem! Pra eu te ajudar com o orçamento, manda em texto o que você precisa.",
    video:
      "Recebi seu vídeo mas não consigo assistir por aqui. Pode escrever em texto o que você precisa? Já sigo.",
    location:
      "Recebi sua localização mas por aqui consigo te ajudar melhor por texto. Pode me contar o que você precisa?",
    contacts:
      "Recebi o contato! Pra eu te ajudar com o orçamento, manda em texto o que você precisa.",
    unsupported:
      "Recebi sua mensagem mas não consegui ler o conteúdo por aqui. Pode mandar por texto?",
  },
  onboarding: {
    image:
      "Recebi sua foto mas não consegui ver os dados por aqui. Pode digitar os dados do cliente pra eu cadastrar?",
    document:
      "Recebi o documento mas não consegui abrir aqui. Pode digitar os dados do cliente pra eu cadastrar?",
    sticker:
      "Recebi a mensagem! Pra eu cadastrar, manda em texto os dados do cliente.",
    video:
      "Recebi seu vídeo mas não consigo assistir por aqui. Pode digitar os dados do cliente?",
    location:
      "Recebi a localização. Pra eu cadastrar, manda em texto os dados do cliente.",
    contacts:
      "Recebi o contato. Pra eu cadastrar, manda em texto os dados do cliente.",
    unsupported:
      "Recebi sua mensagem mas não consegui ler aqui. Pode digitar os dados do cliente?",
  },
  operacao: {
    image:
      "Recebi sua foto mas não consegui ver com clareza. Pode mandar por texto o que precisa?",
    document:
      "Recebi seu documento mas não consegui abrir. Pode mandar por texto o que precisa?",
    sticker: "Recebi sua mensagem! Pode mandar por texto o que precisa?",
    video:
      "Recebi seu vídeo mas não consigo assistir aqui. Pode mandar por texto?",
    location:
      "Recebi a localização. Pode mandar por texto o que precisa?",
    contacts:
      "Recebi o contato. Pode mandar por texto o que precisa?",
    unsupported:
      "Recebi sua mensagem mas não consegui ler aqui. Pode mandar por texto?",
  },
  cliente_final_lembrete: {
    image:
      "Oi! Recebi sua foto mas não consegui ver direito aqui. Pra confirmar ou reagendar, pode responder por texto?",
    document:
      "Oi! Recebi seu documento mas não consegui abrir. Pra confirmar ou reagendar, pode responder por texto?",
    sticker:
      "Oi! Recebi sua mensagem. Pra confirmar ou reagendar, pode responder por texto?",
    video:
      "Oi! Recebi seu vídeo mas não consigo assistir. Pode responder por texto se quer confirmar ou reagendar?",
    location:
      "Oi! Recebi a localização. Pra confirmar ou reagendar a troca, pode responder por texto?",
    contacts:
      "Oi! Recebi o contato. Pra confirmar ou reagendar a troca, pode responder por texto?",
    unsupported:
      "Oi! Recebi sua mensagem mas não consegui ler aqui. Pra confirmar ou reagendar, pode responder por texto?",
  },
  suporte: {
    image:
      "Recebi sua foto mas não consegui ver direito. Pode descrever por texto o que está acontecendo?",
    document:
      "Recebi seu documento mas não consegui abrir. Pode descrever por texto o que está acontecendo?",
    sticker:
      "Recebi sua mensagem. Pode descrever por texto o que está acontecendo?",
    video:
      "Recebi seu vídeo mas não consigo assistir aqui. Pode descrever por texto o que está acontecendo?",
    location:
      "Recebi a localização. Pode descrever por texto o que está acontecendo?",
    contacts:
      "Recebi o contato. Pode descrever por texto o que está acontecendo?",
    unsupported:
      "Recebi sua mensagem mas não consegui ler aqui. Pode descrever por texto?",
  },
  cobranca: {
    image:
      "Recebi sua foto mas não consegui ver direito. Pode mandar por texto pra eu te ajudar com o pagamento?",
    document:
      "Recebi o documento mas não consegui abrir aqui. Pode mandar por texto pra eu te ajudar com o pagamento?",
    sticker:
      "Recebi sua mensagem. Pode mandar por texto pra eu te ajudar com o pagamento?",
    video:
      "Recebi seu vídeo mas não consigo assistir aqui. Pode escrever por texto pra eu te ajudar com o pagamento?",
    location:
      "Recebi a localização. Pode escrever por texto pra eu te ajudar com o pagamento?",
    contacts:
      "Recebi o contato. Pode escrever por texto pra eu te ajudar com o pagamento?",
    unsupported:
      "Recebi sua mensagem mas não consegui ler aqui. Pode escrever por texto pra eu te ajudar com o pagamento?",
  },
};

export function unsupportedMediaFallback(
  agentMode: ConversationAgentMode,
  kind: FallbackKind,
): string {
  return FALLBACKS[agentMode][kind];
}
