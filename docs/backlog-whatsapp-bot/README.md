# Backlog - Bot WhatsApp Quando Trocar

Base:

- `../product/PRD-whatsapp-bot.md`
- `../architecture/whatsapp-bot-technical-plan.md`

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
5. [Fase 5 - Audio](./fase-5-audio.md)
6. [Fase Representantes - Atribuicao e comissao](./fase-representantes-comissao.md)
7. [Fase Conversacional - Geracao de resposta com validador](./fase-camada-conversacional.md)
8. [Fase R4 - Portal do Representante (login e visibilidade)](./fase-representante-portal.md)
9. [QTR-35 P0 - Qualidade do cadastro (extracao por LLM, barreira de saida, data unica)](./qtr-35-p0-qualidade-cadastro.md)
10. [QTR-35 P1 - Intencao de compra, guardrails de venda e gancho de conversao](./qtr-35-p1-intencao-e-conversao.md)
11. [QTR-35 P2 - Dado, card e auditoria](./qtr-35-p2-dado-card-auditoria.md)

Resumo consolidado:

- [Fases 1, 2 e 3 - Resumo consolidado da implementacao](./fases-1-2-e-3-resumo-implementacao.md)

Ordem recomendada:

1. Implementar a Fase 1 com webhook, persistencia, lead e agente vendedor simples.
2. Avancar para a Fase 2 somente quando uma conversa real do WhatsApp gerar lead rastreavel.
3. Ativar a Fase 3 somente com templates aprovados e consentimento registrado.
4. Fechar a Fase 4 depois que lembretes e respostas reais ja estiverem auditados.
