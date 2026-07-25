# ADR 0018: Concierge do cliente final antes do primeiro lembrete

- **Status**: accepted (parcialmente revisada — ver nota)
- **Data**: 2026-06-14
- **Decisores**: Anderson Domingos
- **Revisada por**: [ADR-0026](./0026-concierge-moldura-gerada.md) e QTR-35 P2 — os intents seguros continuam aceitando moldura gerada com validador; o CTA aprovado atualmente é quick-reply e o código trata `chamar_oficina` antes do fallback. A evolução para URL segue pendente de aprovação Meta.
- **Fonte**: teste real (cliente "Rafael", confirmação de troca de óleo, 2026-06-14) — print mostrando resposta confusa do bot
- **Relaciona-se com**: [ADR-0002](./0002-roteamento-via-agent-mode.md) (roteamento via agent_mode), [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md) (handoff de agendamento), [ADR-0012](./0012-politica-de-preco.md) (bot não cota preço)

## Contexto

Quando a oficina registra um serviço, o cliente final recebe a confirmação (template `confirmacao_servico`). O **lembrete** só vem muito depois, perto da próxima troca. Existe portanto uma janela — entre a confirmação e o primeiro lembrete — em que o cliente final pode responder.

No teste de 2026-06-14, o cliente "Rafael" recebeu a confirmação e **tocou no botão "Chamar no WhatsApp"** do template. Dois problemas se somaram:

1. **Parser** (`payload.ts`) não tratava `type: "button"`/`"interactive"` → o toque virava `mediaType: "unsupported"` → fallback "Recebi sua mensagem mas não consegui ler o conteúdo por aqui."
2. **Roteamento**: o lookup de cliente final (`findReminderConversationByWhatsapp`) só casa outbound com `lembrete_id NOT NULL`. Como ainda não havia lembrete, o cliente caiu no **fallback de vendas** — e o fallback veio com a persona errada (vendas). Mesmo uma resposta em texto puro seria atendida pelo agente de vendas.

## Decisão

**1. Botão da confirmação → conversa com a oficina.** O template `confirmacao_servico` aprovado usa um **quick-reply** intitulado "Chamar no whatsapp". O payload chega ao concierge como intent `chamar_oficina`, que responde com o `https://wa.me/<telefone>` da oficina e marca handoff. Um botão URL dinâmico é evolução futura e depende de nova submissão à Meta.

**2. Concierge leve para texto solto.** O cliente final que responde à confirmação **antes de existir lembrete** é reconhecido como `cliente_final` (não vendas) e atendido por um agente concierge determinístico (`cliente-final-concierge.ts`):
- agradecimento / "quem é vocês" → resposta curta on-brand + link da oficina;
- pedido acionável (preço, agendar, remarcar, reclamação) → **handoff `wa.me`** pra oficina (ADR-0009/0012: bot não agenda nem cota preço);
- opt-out / número errado → cancela lembretes futuros + status do cliente (determinístico, [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md));
- "não reconheço" → handoff + flag (`cliente_nao_reconhece`);
- mensagem ambígua → handoff (destino seguro).

**3. Reutiliza o modo `cliente_final_lembrete` (sem novo agent_mode).** O roteador reconhece o cliente final por telefone via `findClienteFinalConversationByWhatsapp` (conversa `cliente_final` em `conversas`, independente de lembrete) e devolve `agent_mode = cliente_final_lembrete` **sem `lastReminderId`**. O webhook bifurca: com `lastReminderId` → agente de lembrete (inalterado); sem → concierge. Ambiguidade multi-oficina continua indo pra suporte, como no lookup de lembrete.

## Alternativas consideradas

- **Novo `agent_mode` `cliente_final_concierge`** — Descartado: exigiria migration do CHECK constraint `conversas_agent_mode_check`, tipos e mais superfície. Bifurcar por `lastReminderId` entrega o mesmo comportamento sem migration.
- **Reutilizar o agente de lembrete como está** — Descartado: a moldura "confirmar/reagendar" não faz sentido sem lembrete ativo.
- **Handoff puro (responder sempre "fale com a oficina")** — Descartado como padrão: passivo demais num primeiro contato frio; um "obrigado" não merece só um encaminhamento.
- **Ignorar a resposta** — Descartado: a copy da confirmação convida a responder; silêncio parece o bug atual.

## Consequências

### Positivas

- Cliente final nunca mais é atendido como lead de vendas.
- "Chamar no WhatsApp" leva direto à oficina (ação certa), tirando tráfego de texto do bot.
- Toque em botão deixa de virar "não consegui ler" (parser corrigido para todos os botões, inclusive os de lembrete).
- Sem migration de schema; agente de lembrete inalterado.

### Negativas / trade-offs

- Depende de edição + reaprovação do template na Meta para o botão `wa.me` (ação fora do código).
- Concierge é determinístico: frases muito fora do padrão caem em handoff (custo: um encaminhamento a mais, nunca resposta errada).
- Sobrecarrega semanticamente o nome `cliente_final_lembrete` (passa a cobrir também o pré-lembrete); discriminado por `lastReminderId`.

## Referências

- `lib/whatsapp/cliente-final-concierge.ts`, `lib/whatsapp/conversation-router.ts`, `lib/whatsapp/webhook-handler.ts`, `lib/whatsapp/payload.ts`
- `docs/regras-de-negocio.md §3.7`
- Testes: `tests/whatsapp-cliente-final-concierge.test.ts`, `tests/whatsapp-router.test.ts`, `tests/whatsapp-route-phase3.test.ts`, `tests/whatsapp-payload-audio.test.ts`
