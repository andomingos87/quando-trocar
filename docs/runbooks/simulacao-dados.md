# Runbook · Simulação de dados (projeto `quando-trocar-simulacao`)

Banco de simulação com a foto "197 oficinas pagantes hoje, 6 meses de história" para demonstrar o
produto (admin, portal do representante, métricas) sem tocar em produção. Plano e premissas:
[`docs/simulacao/plano-simulacao-197-clientes.md`](../simulacao/plano-simulacao-197-clientes.md).

## Projetos

| | ref | uso |
|---|---|---|
| Produção | `crxrdypnefgexifbrdij` | operação real. **O gerador recusa esse ref.** |
| Simulação | `fplkasckmvvccnkrkszr` | dados fictícios. Único alvo permitido. |

Credenciais em `.env.simulacao` (entrada própria no `.gitignore`; confira com
`git check-ignore .env.simulacao` antes de commitar).

## Estado do projeto de simulação

- Migrations de `supabase/migrations/` aplicadas pela Management API (registradas em
  `supabase_migrations.schema_migrations`). A função `public.rls_auto_enable()` foi criada à mão
  (em produção ela vem do painel do Supabase) antes da migration `harden_rls_auto_enable_grants`.
- Crons **desligados**: `whatsapp-reminders-enqueue`, `whatsapp-reminders-consume`,
  `followup-leads-daily`, `ad-insights-sync-daily`. Só `prospeccao-expirar-cache-places` continua
  (inofensivo). Não religar: sem token Meta/OpenAI o dano é zero, mas o enqueue moveria lembretes.
- `configuracoes_vendedor.geracao_llm_modo = on` e `configuracoes_pagamento.provedor_ativo = asaas`
  (ajustados pelo gerador para as telas de métricas fazerem sentido).

## Comandos

```bash
npm run sim:gerar -- --dry          # gera em memória e imprime a foto (nada gravado)
```

```bash
npm run sim:gerar                   # gera e grava (recusa se já houver oficinas; use --forcar)
```

```bash
npm run sim:verificar               # foto do banco x alvos + guardrails
```

```bash
npm run sim:purgar -- --confirmar   # apaga tudo que é transacional (mantém config)
```

Flags do gerador: `--seed N` (default 197; mesmo seed = mesmo mundo), `--ate AAAA-MM-DD` (default hoje
em BRT; é o "agora" da simulação), `--forcar`, `--dry`.

## Guardrails (o gerador aborta se violar)

1. `SUPABASE_URL` precisa ser o projeto de simulação. Ref de produção é recusado.
2. Todo telefone gerado usa DDD inexistente: `+5500` (leads/oficinas/reps), `+5501` (clientes finais),
   `+5502` (prospecção). Passa no check E.164 do banco e nunca alcança ninguém.
3. Nenhum `lembretes.pendente` com `scheduled_at` antes de hoje e nenhum `outbound_messages.pending`
   antigo: um scheduler ligado por engano não teria o que disparar.
4. Nenhum registro com `created_at` no futuro.

## Preview público (Vercel)

O projeto Vercel `quando-trocar-simulacao` é um deploy **de arquivos locais** (não ligado ao GitHub):
para atualizar, rode `vercel --prod` numa cópia limpa do repositório linkada a esse projeto (ver
histórico no `CONTEXT_CHANGELOG`). Envs lá: `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` da simulação,
`ADMIN_SESSION_SECRET`, `REP_SESSION_SECRET`, `ADMIN_OTP_DEV_BYPASS_CODE`, `REP_OTP_DEV_BYPASS_CODE`,
`NEXT_PUBLIC_*`. **Sem** token Meta, OpenAI, ASAAS ou `INTERNAL_JOB_SECRET`. O login funciona porque
o bypass de OTP é liberado quando o banco é o projeto de simulação (`lib/supabase/simulacao.ts`,
regra 11.1).

## Como ver no admin

Rode o app apontando para o projeto de simulação (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de
`.env.simulacao`, mais `ADMIN_SESSION_SECRET`, `REP_SESSION_SECRET` e `ADMIN_OTP_DEV_BYPASS_CODE`
para logar sem WhatsApp). O admin cadastrado é o Anderson (`+5511945207618`, vindo da migration);
representantes fictícios: `CARLOS`, `RENATA`, `JORGE`, `PAULA` (telefones `+5500…`, login só com
bypass de OTP). Deixe `WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY` e `ASAAS_API_KEY` vazios.

## O que o gerador NÃO faz

- Não chama OpenAI nem Meta: o texto do bot é o copy real espelhado em
  `scripts/db/simulacao/lib/copy.ts` (quando o copy mudar no código, atualizar lá).
- Não usa dados de produção (nem `ad_insights_daily`, nem `prospeccao_estabelecimentos`): tudo fictício.
- Não cria `retornos` (tabela não existe): "cliente voltou" é o segundo `servicos` do mesmo
  cliente/veículo depois de um lembrete enviado.

## Limitações conhecidas (bugs do produto que a simulação expõe)

- Card "Oficinas em teste" do `/admin` conta `plano = 'teste'` sem filtrar status: inclui os testes
  expirados (cancelados). Mostra 144 em vez de 34.
- Card "retornos concluídos" no detalhe da oficina conta `lembretes.status = 'agendado'`, status
  removido pela ADR-0009: mostra 0.
- `lembretes` no banco não aceita `handoff_iniciado` (o doc de regras lista): handoff do cliente
  final fica em `conversas.handoff_required` com o lembrete em `enviado`.
