# ADR 0007: Provedor WhatsApp — Meta Business Cloud API direta

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §17, §24`

## Contexto

O bot precisa enviar e receber mensagens WhatsApp. Caminhos comuns no mercado:

- **Meta WhatsApp Business Cloud API (direta)** — Conexão direta com a Meta. Templates aprovados, webhooks oficiais, suporte oficial.
- **BSP homologado** (Twilio, Gupshup, Infobip, Take Blip) — Camada intermediária com dashboard e UI de templates.
- **API não oficial** (Z-API, Evolution API) — Mais barato, mas risco de bloqueio.

O `whatsapp-bot-technical-plan.md` recomendou Cloud API direta desde o início, e o setup atual em `runbooks/meta-whatsapp-setup.md` já está montado nessa base.

## Decisão

**Meta WhatsApp Business Cloud API direta.**

Conexão oficial, sem intermediário BSP. Token, webhook e templates gerenciados via Meta Business Manager. Implementação já está nesse caminho desde a Fase 1.

## Alternativas consideradas

- **Meta Cloud API direta** — Escolhido. Custo previsível (por conversa, definido pela Meta), zero risco de bloqueio, suporte oficial.
- **BSP (Twilio/Gupshup/Infobip)** — Descartado para o MVP. Adiciona vendor e markup. Pode ser reavaliado quando a operação justificar (centenas de oficinas, templates em volume, equipe dedicada de atendimento).
- **Z-API / Evolution API** — Descartado. Risco de bloqueio do número é inaceitável para SaaS de produção.

## Consequências

### Positivas

- Sem vendor intermediário — controle total sobre tokens, templates e webhooks.
- Custo previsível direto com a Meta.
- Sem markup de BSP.
- Implementação já em produção desde Fase 1.

### Negativas / trade-offs

- Gestão manual de templates via painel da Meta (sem UI auxiliar de BSP).
- Sem suporte humano de BSP — incidentes dependem da documentação Meta.
- Migrar para BSP no futuro exige adaptação do `whatsapp-client.ts` e remapeamento de templates.

## Referências

- `docs/product/PRD-whatsapp-bot.md §17` (Integração WhatsApp), §24 (Decisões em Aberto)
- `docs/architecture/whatsapp-bot-technical-plan.md`
- `docs/runbooks/meta-whatsapp-setup.md`
- `lib/whatsapp/whatsapp-client.ts`
