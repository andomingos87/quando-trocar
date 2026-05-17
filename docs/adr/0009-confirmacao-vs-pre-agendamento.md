# ADR 0009: Agente confirma agenda ou apenas pré-agenda

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §12, §23, §24`

## Contexto

Quando o cliente final responde ao lembrete com "pode ser quinta 14h?", o agente tem duas opções:

- **Confirmar direto** — Bot responde "Confirmado, quinta às 14h" e marca `status_conversa = agendado`. UX boa para o cliente (resposta imediata).
- **Pré-agendar e pedir confirmação humana da oficina** — Bot responde "Vou deixar pré-agendado para quinta 14h, a oficina confirma já já". Oficina confirma no painel ou no WhatsApp.

O risco da primeira opção: bot confirma horário que a oficina não tem agenda real, gerando no-show ou cliente irritado. O risco da segunda: cliente espera confirmação que pode demorar, atrito na UX.

PRD §23 (Riscos) já reconhece o problema: "confirmação de agenda sem controle real da oficina". Mitigação inicial proposta: "linguagem de pré-agendamento no MVP, permitir confirmação humana".

## Decisão

**Pendente — recomendação inicial é pré-agendar no MVP, evoluir para confirmação direta quando houver integração com agenda real da oficina (Google Calendar, sistema da oficina, etc.).**

## Alternativas consideradas

- **Confirmar direto sem agenda real** — UX boa, mas risco de no-show. Descartado para o MVP.
- **Pré-agendar com confirmação humana via painel** — Mais seguro, atrito menor para a oficina (painel) que para o cliente (espera). Recomendado para o MVP.
- **Confirmar direto com integração de agenda** — Ideal a longo prazo, exige integrar Google Calendar ou similar e configuração de horários por oficina. Fase 5+.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §12` (Cliente Final Responde), §23 (Riscos), §24 (Decisões em Aberto)
- `docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md`, `fase-4-retorno-dashboard.md`
