# ADR 0006: Idempotência via unique index em provider IDs e business keys

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `AGENTS.md §Supabase Rules, §WhatsApp Rules`, `docs/product/PRD-whatsapp-bot.md §20`

## Contexto

Múltiplos pontos do sistema podem processar o mesmo evento mais de uma vez:

- Meta pode retentar webhook (timeout, 5xx, qualquer dúvida da plataforma).
- Fila pode retentar evento (worker travou, deploy no meio do processamento).
- Erro de rede em envio: a mensagem chegou ou não? Tentativa dupla pode duplicar lembrete.

Se o sistema duplica, vem consequência:

- Mesma mensagem inbound vira duas conversas / dois leads.
- Mesmo lembrete enviado duas vezes → cliente irritado → opt-out.
- Mesma troca registrada duas vezes → relatório errado de receita.

A pergunta: como garantir que repetição de evento é segura?

## Decisão

Idempotência baseada em **unique indexes no banco** para provider IDs e business keys:

- `whatsapp_events.event_id` UNIQUE — webhook duplicado vira no-op por conflito.
- `mensagens.whatsapp_message_id` UNIQUE (when not null) — envio retentado não duplica registro.
- `lembretes (servico_id, scheduled_at)` UNIQUE ou regra equivalente — não cria dois lembretes para o mesmo serviço/data.
- Outros: provider IDs de status de entrega, IDs externos em geral.

**Sempre preferir constraint no banco a checagem em código.** Código que valida antes de inserir pode race ou ser esquecido; constraint é executada a cada insert.

## Alternativas consideradas

- **Checagem por SELECT antes de INSERT** — Race condition entre SELECT e INSERT. Descartado.
- **Lock pessimista por linha** — Funciona mas adiciona complexidade e contenção. Descartado para o caso comum.
- **Marcação manual de "processado"** — Frágil. Descartado.
- **Unique indexes** — Escolhido. Postgres garante; código trata `unique_violation` como sucesso silencioso (ou ignora).

## Consequências

### Positivas

- Mensagem dupla nunca duplica estado, mesmo em race.
- Constraint serve como documentação executável da regra de unicidade.
- Worker pode ser configurado com retry agressivo sem medo.

### Negativas / trade-offs

- Inserir precisa tratar erro `unique_violation` como caminho normal, não como erro real.
- Migrar/renomear coluna com unique constraint exige cuidado adicional.
- Pode ser difícil identificar a chave certa em fluxos complexos (ex: idempotência de webhook por evento vs por mensagem).

## Referências

- `AGENTS.md §Supabase Rules`, §WhatsApp Rules`
- `docs/product/PRD-whatsapp-bot.md §20` (Não Funcionais — Confiabilidade)
- `lib/whatsapp/repository.ts`
- `supabase/migrations/` (procurar `UNIQUE` em IDs de provedor)
