# ADR 0001: LLM gera texto e interpreta, mas não decide estado

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `AGENTS.md §OpenAI Agent Rules`, `docs/product/PRD-whatsapp-bot.md §16`

## Contexto

O bot lida com dados sensíveis e ações de impacto financeiro: cria leads, converte oficinas, registra serviços, agenda lembretes, marca opt-out, registra receita. Erro do LLM nessas decisões custa caro — pode mandar lembrete pra quem pediu opt-out (compliance), criar oficina duplicada, ou marcar receita inexistente.

Ao mesmo tempo, LLM é a única ferramenta razoável para interpretar mensagens livres em português coloquial vindas do WhatsApp.

A pergunta: até onde a LLM manda?

## Decisão

O LLM é **conselheiro**, nunca **decisor**. Pode classificar intenção e extrair dados estruturados; nunca pode, sozinho, alterar `lead.status`, `participant_type`, `agent_mode`, estado de pagamento, opt-out ou status de lembrete.

Toda mudança de estado de negócio passa por regras determinísticas no backend que validam a saída do LLM antes de aplicar.

## Alternativas consideradas

- **LLM agente autônomo (tool calling livre)** — LLM chama ferramentas que mutam estado diretamente. Descartado: erro do LLM vira erro de produção sem checkpoint humano nem regra.
- **Regras determinísticas puras (sem LLM)** — Funciona para mensagens estruturadas, mas WhatsApp tem mensagens livres demais ("opa, pode ser quinta 14h?"). Descartado por cobertura insuficiente.
- **LLM como conselheiro com regras determinísticas no caminho crítico** — Escolhido. LLM extrai/interpreta; backend valida e decide.

## Consequências

### Positivas

- Erro de LLM não vira erro de banco.
- Auditoria clara: cada mudança de estado tem regra rastreável (não "porque o modelo achou").
- Custo de LLM controlado (LLM só onde regra determinística não dá conta).
- Compatível com Structured Outputs da OpenAI Responses API.

### Negativas / trade-offs

- Mais código no backend para validar e aplicar transições.
- Latência adicional (LLM → validação → write) em cenários onde tool calling direto seria mais rápido.
- Time precisa manter o esquema de Structured Outputs alinhado com as regras.

## Referências

- `AGENTS.md §OpenAI Agent Rules`
- `docs/product/PRD-whatsapp-bot.md §16` (Requisitos do Agente IA)
- `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/onboarding-agent.ts`
- `.codex/prompts/openai-structured-output-review.md`
