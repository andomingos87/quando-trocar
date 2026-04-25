# Backlog - Bot WhatsApp Quando Trocar

Base:

- `PRD_WHATSAPP_BOT_REAL.md`
- `docs/whatsapp-bot-technical-plan.md`

Stack alvo:

- Next.js 15, React 19, TypeScript e Vercel.
- Supabase Postgres, Auth, RLS, Queues e Cron.
- OpenAI Responses API com Structured Outputs.
- Meta WhatsApp Business Cloud API.

Arquivos por fase:

1. [Fase 1 - Bot vendedor](./fase-1-bot-vendedor.md)
2. [Fase 2 - Conversao e onboarding](./fase-2-conversao-onboarding.md)
3. [Fase 3 - Lembretes reais](./fase-3-lembretes-reais.md)
4. [Fase 4 - Retorno e dashboard](./fase-4-retorno-dashboard.md)

Ordem recomendada:

1. Implementar a Fase 1 com webhook, persistencia, lead e agente vendedor simples.
2. Avancar para a Fase 2 somente quando uma conversa real do WhatsApp gerar lead rastreavel.
3. Ativar a Fase 3 somente com templates aprovados e consentimento registrado.
4. Fechar a Fase 4 depois que lembretes e respostas reais ja estiverem auditados.
