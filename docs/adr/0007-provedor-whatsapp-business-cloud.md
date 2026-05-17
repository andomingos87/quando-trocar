# ADR 0007: Provedor WhatsApp para a primeira versão

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §17, §24`

## Contexto

O bot precisa enviar e receber mensagens WhatsApp. Existem três caminhos comuns no mercado:

- **Meta WhatsApp Business Cloud API (direta)** — Conexão direta com a Meta. Templates aprovados, webhooks oficiais, suporte oficial.
- **BSP homologado** (ex: Twilio, Gupshup, Infobip, Take Blip) — Camada intermediária com SLA, UI de templates, dashboard próprio.
- **API não oficial / não homologada** (Z-API, Evolution API) — Mais barato e flexível para protótipo, mas risco de bloqueio do número.

O `whatsapp-bot-technical-plan.md` recomenda Cloud API direta. O setup atual em `runbooks/meta-whatsapp-setup.md` é baseado nela. Mas a decisão formal não foi fechada — outras opções ainda estão na mesa.

## Decisão

**Pendente — discutir e fechar antes do lançamento real.**

Recomendação inicial (não vinculante): Meta Cloud API direta para MVP, considerando BSP no momento de escalar para múltiplas oficinas com necessidade de templates aprovados em volume.

## Alternativas consideradas

- **Meta Cloud API direta** — Pros: oficial, sem intermediário, custo previsível (por conversa). Contras: gestão manual de templates, sem dashboard pronto.
- **BSP (Twilio/Gupshup/Infobip)** — Pros: dashboard, templates mais simples, suporte. Contras: custo extra (markup do BSP), mais um vendor.
- **Z-API / Evolution API** — Pros: barato, rápido para prototipar. Contras: risco de bloqueio do número WhatsApp, não recomendado para SaaS de produção.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §17` (Integração WhatsApp), §24 (Decisões em Aberto)
- `docs/architecture/whatsapp-bot-technical-plan.md`
- `docs/runbooks/meta-whatsapp-setup.md`
