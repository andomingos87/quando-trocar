# ADR 0005: Templates Meta fora da janela de 24h, mensagem livre dentro

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §11, §17`, `AGENTS.md §WhatsApp Rules`

## Contexto

A Meta WhatsApp Business Cloud API tem duas modalidades de envio:

- **Mensagem livre (session message)** — Texto arbitrário. Só permitido nas 24h após a última mensagem do usuário.
- **Template** — Mensagem com estrutura aprovada pela Meta. Único caminho fora da janela de 24h.

O bot precisa dos dois cenários:

- **Dentro da janela** — Conversa de vendas, onboarding, operação. Mensagens livres dinâmicas.
- **Fora da janela** — Lembretes automáticos (90 dias após o serviço), reativação de oficina inativa, recuperação de lead. Quase todo o valor do produto.

A pergunta: como o bot decide qual modalidade usar?

## Decisão

O backend determina a modalidade **antes** de tentar enviar:

- Se o último inbound do destinatário foi há ≤ 24h → envia mensagem livre.
- Caso contrário → envia template aprovado, com variáveis preenchidas a partir dos dados (`nome`, `oficina`, `veiculo`, etc.).

Templates necessários ficam aprovados na Meta antes do uso (não em runtime). Mudança de copy de lembrete = nova versão do template + aprovação.

A janela é calculada por `conversas.last_message_at` quando o sender é `cliente_final` ou `oficina`.

## Alternativas consideradas

- **Sempre usar template** — Limita criatividade da conversa e força aprovação Meta para qualquer mudança. Descartado: vendas e onboarding precisam de flexibilidade.
- **Sempre tentar mensagem livre, fallback para template em erro** — Caro (tentativa falhada conta) e arriscado (bloqueio da Meta por abuso de janela). Descartado.
- **Decisão no backend antes do envio** — Escolhido. Single source of truth (`last_message_at`), zero tentativa falhada.

## Consequências

### Positivas

- Compliance com a política da Meta — risco baixo de bloqueio.
- Lembretes automáticos sempre via template (canal estável).
- Mensagens de venda/onboarding flexíveis e atualizáveis sem aprovação Meta.

### Negativas / trade-offs

- Adicionar/editar template de lembrete tem ciclo de aprovação Meta (horas a dias).
- Backend precisa rastrear `last_message_at` com precisão. Erros aqui viram tentativa fora da janela = rejeição.
- Template tem estrutura rígida — não dá pra personalizar tom no envio individual.

## Referências

- `docs/product/PRD-whatsapp-bot.md §11` (Lembretes), §17 (Integração WhatsApp)
- `AGENTS.md §WhatsApp Rules`
- `lib/whatsapp/whatsapp-client.ts`
- `docs/runbooks/meta-whatsapp-setup.md`
