# Runbook — Publicar novidade / editar playbook do representante

Playbook de vendas e novidades do [portal do representante](../../.context/modules/portal-representante/AGENTS.md)
são **conteúdo estático no código** (decisão da [ADR-0025](../adr/0025-portal-do-representante.md)):
publicar ou editar = alterar a constante + deploy. Sem tabela nem UI de edição no MVP (isso é R4.5).

## Publicar uma novidade

1. Abra `lib/representante/content/novidades.ts`.
2. Adicione um item **no topo** do array `NOVIDADES` (a ordenação por data é feita em `listNovidades()`,
   mas manter o mais recente no topo ajuda a revisão):

   ```ts
   {
     id: "2026-08-01-nome-curto",   // único e estável (data + slug)
     data: "2026-08-01",             // YYYY-MM-DD
     titulo: "Título curto e direto",
     corpo: "Texto da novidade em 1–3 frases, tom de gente.",
     tag: "produto",                 // "produto" | "comercial" | "aviso"
   },
   ```

3. Commit direto na `main` (padrão do repo) e deploy. A novidade aparece em `/representante/novidades`
   e as mais recentes na Visão geral.

## Editar o playbook

1. Abra `lib/representante/content/playbook.ts`.
2. Edite a seção correspondente do array `PLAYBOOK` (blocos: `paragrafos`, `lista`, `passos`, `qa`).
3. **Regra inviolável ([ADR-0012](../adr/0012-politica-de-preco.md)):** não incluir preço, mensalidade
   nem condição comercial. Quem fecha valor é o atendimento humano.
4. Se citar prazos de lembrete, mantenha em sincronia com os defaults do seed `tipos_servico_default`
   (óleo ~90d, revisão/outros ~180d, amortecedor ~2 anos) e com `PRODUCT_FACTS`
   (`lib/whatsapp/product-knowledge.ts`).
5. Commit + deploy.

## Checklist antes do deploy

- [ ] `npm run lint` e `npm test` verdes.
- [ ] Sem preço/condição comercial no texto.
- [ ] `id` da novidade único e no formato `YYYY-MM-DD-slug`.
- [ ] `data` no formato `YYYY-MM-DD`.
