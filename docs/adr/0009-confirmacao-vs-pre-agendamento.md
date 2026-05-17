# ADR 0009: Bot não agenda — apenas faz a ponte entre cliente e oficina

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §12, §23, §24`

## Contexto

Quando um cliente final responde ao lembrete com intenção de agendar (ex: "pode ser quinta 14h?"), o bot tem várias opções: confirmar direto, pré-agendar e pedir confirmação humana, ou se integrar à agenda real da oficina.

O PRD original (§12) previa que o bot interpretava a resposta e definia `status_conversa = agendado` com `data_agendada`. Isso assume que o bot tem alguma noção da agenda da oficina ou que a oficina aceita o que o bot promete — ambos são suposições frágeis (PRD §23 já reconhecia o risco).

## Decisão

**Bot não se envolve em agendamento.** Quando detecta intenção de agendar, o bot atua só como ponte:

1. **Mensagem para o cliente final** com link `wa.me` clicável apontando para o WhatsApp do atendente da oficina, com mensagem pré-preenchida.

   Exemplo:
   ```text
   Pra agendar, fale direto com a oficina:
   https://wa.me/5541999990000?text=Quero%20agendar%20troca%20de%20%C3%B3leo
   ```

2. **Imediatamente** o bot notifica a oficina (no WhatsApp principal/atendente cadastrado) com link `wa.me` apontando para o cliente, com mensagem pré-preenchida.

   Exemplo:
   ```text
   João (Civic 2018) quer agendar troca de óleo. Chame agora:
   https://wa.me/5541988880000?text=Oi%20Jo%C3%A3o,%20da%20oficina%20Auto%20Centro,%20vamos%20agendar%20a%20troca%20do%20seu%20Civic?
   ```

A partir daí, a conversa fica entre cliente e atendente humano. O bot sai. Sem `status = agendado`, sem `data_agendada`, sem tentativa de confirmar horário.

## Alternativas consideradas

- **Bot confirma direto** — Descartado: bot não conhece agenda real, pode prometer horário impossível.
- **Bot pré-agenda e oficina confirma depois** — Descartado: ainda cria carga operacional no bot (rastrear `status = pre_agendado`, lembrar a oficina de confirmar), e cliente ainda espera resposta.
- **Bot integra com agenda real (Google Calendar, etc.)** — Descartado: inviável no MVP; exige cada oficina configurar integração.
- **Bot só faz handoff via `wa.me`** — Escolhido. Bot detecta intenção, manda os dois conversarem direto. Mínima carga no bot, zero risco de prometer o que não pode cumprir.

## Consequências

### Positivas

- Bot nunca promete agenda — risco de PRD §23 eliminado.
- Lógica do bot fica simples: detectar intenção → 2 mensagens com link → fim.
- Conversa cliente↔oficina fica orgânica e humana.
- Sem necessidade de integração com sistemas de agenda.
- Templates de mensagem de handoff são fixos (não precisam aprovação contínua na Meta para variações).

### Negativas / trade-offs

- Cliente paga atrito extra: precisa clicar no link, abrir outra conversa.
- Oficina precisa estar atenta ao WhatsApp principal para receber o ping do bot — se ignorar, o cliente fica esperando.
- Bot perde visibilidade do que acontece depois (não sabe se cliente foi atendido, se agendou, se desistiu). Métricas de conversão pós-lembrete ficam parciais — só dá pra medir até "handoff iniciado", não "agendamento fechado". Para "voltou e gerou receita", a oficina ainda registra retorno manualmente (Fluxo 7 do PRD).
- PRD §12 (intenções esperadas como `quer_agendar`, `quer_reagendar`) simplifica: bot precisa detectar `quer_agendar` ou similar, mas não precisa diferenciar entre `quer_agendar` e `quer_reagendar` — ambos viram handoff.
- Status do lembrete simplifica: `respondido` ou `handoff_iniciado` substituem `agendado` no enum.

## Mudanças necessárias no modelo de dados

- `oficinas` precisa de `whatsapp_atendente` (pode ser igual a `whatsapp_principal` por default) — número que recebe o ping de handoff.
- `lembretes.status` enum: remover `agendado`; manter `respondido`; eventualmente adicionar `handoff_iniciado` se houver valor em rastrear isso separadamente.
- Templates de handoff (mensagem ao cliente e ao atendente) viram conteúdo fixo no código ou configurável por oficina (futuro).

## Mudanças no PRD original

Este ADR substitui a parte de `agendado` / `data_agendada` em PRD §12 (Fluxo 6 — Cliente Final Responde). Demais intenções (`pergunta_preco`, `nao_tem_interesse`, `numero_errado`, etc.) seguem com o tratamento original.

## Referências

- `docs/product/PRD-whatsapp-bot.md §12` (Cliente Final Responde — fluxo a ser ajustado), §23 (Riscos — confirmação de agenda)
- `docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md` (precisa de revisão para refletir o handoff)
- `.codex/prompts/whatsapp-reminder-agent.md` (atualizar para o novo comportamento)
- [wa.me click-to-chat](https://faq.whatsapp.com/5913398998672934)
