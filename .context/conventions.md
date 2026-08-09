# Perfil de convencoes do projeto

> Gerado pela skill `convention-detection` e revisado no `/aurea-context:init`.
> [detectado] = lido do codigo. [confirmado] = validado com o time / por evidencia no repo.

## Stack [detectado]
- Linguagem: TypeScript (Node), React 19
- Gerenciador de pacotes: npm (nao migrar sem decisao)
- Framework: Next.js 15 (App Router) + Turbopack no dev
- Estilo: Tailwind CSS 4, componentes locais em `components/ui`
- IA: OpenAI (`openai` v6) — Responses/Structured Outputs; Whisper p/ audio; vision p/ imagem
- Mensageria: Meta WhatsApp Business Cloud API
- Pagamentos: gateway plugavel (ADR-0021) — Mercado Pago + ASAAS; ASAAS e o default do produto. Segredos no Supabase Vault.
- Monorepo: nao (projeto unico)

## Dados [confirmado]
- Banco: Supabase Postgres
- Migrations: `supabase/migrations/*.sql` (timestamp + descricao; nunca editar migration ja aplicada — criar nova)
- RLS: habilitada em tabelas expostas a usuarios autenticados; o app acessa majoritariamente server-side via service role. **Todo dado de oficina e escopado por `oficina_id`.**
- Auditoria: payloads cros dos provedores sao guardados para auditoria e nao expostos ao usuario da oficina por padrao.
- Idempotencia: eventos e mensagens do WhatsApp sao idempotentes (indices unicos por provider ID / chave de negocio).

## Entrega [confirmado]
- CI/CD: **sem GitHub Actions**. Deploy git-integrado na Vercel (`installCommand: npm ci`, `buildCommand: next build`). Testes e lint sao rodados localmente antes do merge.
- Deploy: Vercel (framework nextjs, `vercel.json` na raiz)
- MCP local (`.mcp.json`): sim — Supabase, Linear e Windsor (HTTP). **`.mcp.json` e gitignored (contem token de acesso) — nunca commitar.**
- Agent assets (skills + prompt briefs): espelhados entre `.cursor/`, `.claude/`, `.codex/` e `.agents/`. Sync automatico via hook em `.cursor/hooks.json` e comando `npm run sync:agent-assets`. Regra: `.cursor/rules/agent-assets-sync.mdc`.

## Qualidade [confirmado]
- Testes: Vitest (`npm test`), suites em `tests/*.test.ts` + evals de agente em `tests/whatsapp-agent-evals/`
- Lint: ESLint (`npm run lint`, config `eslint.config.mjs`)
- Rodar `npm run build` em mudancas que tocam rotas Next, fronteira server/client ou uso de env.

## Decisoes do time [confirmado]
- **Padrao de camadas:** route handler (`app/api/**/route.ts`) -> guard de auth (`lib/admin/api-guard.ts`) -> modulo de dominio+dados (`lib/admin/*.ts`, `lib/whatsapp/*.ts`) -> Supabase (`lib/supabase/admin.ts`). Servico e repositorio ficam juntos por dominio, nao ha ORM.
- **Tratamento de erro:** rotas devolvem envelope `NextResponse.json({ ok: boolean, message })` com status HTTP adequado (401 nao-autenticado, etc.). Falhas de provider (WhatsApp, gateway de pagamento) sao registradas.
- **Validacao de input:** parsing deterministico primeiro quando o formato e previsivel; OpenAI so quando precisa interpretar texto livre, sempre com Structured Outputs (JSON estrito, enums fechados). Campo ausente / baixa confianca => uma pergunta de follow-up, nunca chute.
- **Auth/authz:** admin por OTP via WhatsApp (template Meta `WHATSAPP_TEMPLATE_OTP_NAME`, tipo AUTHENTICATION) -> sessao JWT (`jose`) em cookie -> `requireAdmin()` (server components, redireciona) / `requireAdminApi()` (route handlers, 401). Webhook WhatsApp valida verificacao e assinatura da Meta. Rotas internas de cron protegidas por segredo.
- **Commit/branch/PR:** Conventional Commits com escopo — `feat(whatsapp): ...`, `feat(admin): ...`, `docs(adr): ...`, `chore: ...`. Referenciar o ADR quando a mudanca aplica uma decisao. PRs squash-merge.
- **O que NUNCA fazer:**
  1. Deixar saida do LLM sozinha mudar `lead.status`, `participant_type`, `agent_mode`, estado de pagamento, opt-out ou status de lembrete (ADR-0001).
  2. Mover secret de service-role / OpenAI / WhatsApp para variavel `NEXT_PUBLIC_`.
  3. Commitar `.mcp.json`, `.env` ou `.env.local`.
  4. Quebrar a idempotencia de eventos/mensagens do WhatsApp.
  5. Refatorar codigo nao relacionado dentro de uma mudanca de comportamento do agente.
  6. Alterar comportamento de produto sem atualizar `docs/regras-de-negocio.md` no mesmo commit.
