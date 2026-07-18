# Prompt — Resumo de handoff de vendas (CV3)

Fonte de verdade (humana) do prompt em `lib/whatsapp/handoff-summary.ts`
(`HANDOFF_SUMMARY_PROMPT_VERSION`). Este arquivo espelha o comportamento; ao
mudar o código, atualize aqui, e vice-versa.

## Objetivo

Quando o agente de vendas decide passar o lead para um humano (`handoffRequired`),
gerar um resumo curto da conversa e enviá-lo ao WhatsApp comercial
(`configuracoes_vendedor.whatsapp_handoff_comercial`), para o vendedor assumir
com contexto.

## Invariantes

- **Uso interno.** O resumo vai para o humano do comercial, **nunca** para o lead.
- **Não decide estado** (ADR-0001). O handoff já foi decidido pelo backend
  determinístico; o resumo é apenas texto.
- **Best-effort.** Falha de geração, envio ou timeout → não envia o resumo e
  **não bloqueia** o handoff (o link `wa.me` já foi entregue ao lead). Mesmo
  princípio não-bloqueante do resumo de representantes.
- **Só com a camada de geração ativa.** Roda apenas quando
  `geracao_llm_modo != 'off'` — em `off` o comportamento é idêntico ao anterior
  (nenhuma chamada de LLM nova).
- **Grounded na conversa.** Só pode afirmar o que está no histórico e no motivo
  do handoff. Não inventa nome, número, preço ou promessa.

## Formato

- No máximo **3 linhas** curtas, em PT-BR.
- Cobre: quem é o lead (nome/oficina, se aparecer), o que ele quer/perguntou, e
  o motivo do handoff.
- Sem saudação, sem despedida, sem "segue o resumo" — telegráfico.

## Saída estruturada

`{ "summary": string }` (Responses API, `strict: true`). Timeout de 3s → sem
resumo. Auditado em `agent_tool_calls` (`toolName: "handoff_summary"`).
