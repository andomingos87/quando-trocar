# PRD — Captura por comentário no Instagram (Comment → DM)

> **Status:** proposto · **Autor:** produto · **Depende de:** `docs/product/PRD-whatsapp-bot.md`, `docs/marketing/instagram/estrategia.md`, ADR-0012
> **Precisa de ADR novo:** sim — `ADR-00XX: automação de captura por comentário no Instagram` (registrar a decisão de API própria vs. ManyChat antes de codar)

---

## 0. Instruções para o agente

Antes de escrever qualquer linha de código:

1. **Leia primeiro**, nesta ordem: `AGENTS.md` / `CLAUDE.md`, `.context/` (se existir), `docs/adr/`, `docs/product/PRD-whatsapp-bot.md`, `docs/marketing/instagram/estrategia.md`, e o módulo de leads/atribuição (`lib/representante/` é o padrão de referência para atribuição de origem).
2. **Este PRD contém suposições sobre o repo.** Tudo marcado com `[VERIFICAR]` é hipótese minha sobre a estrutura atual — confirme no código antes de seguir. Se a realidade divergir, **adapte o PRD e avise**, não force o desenho proposto.
3. **Não invente.** Se faltar informação (nome de tabela, nome de módulo, política de secrets), pare e liste o que falta.
4. **Reaproveite antes de criar.** Cliente HTTP, validação de webhook, logger, cliente Supabase, tipos de `lead` e o mecanismo de atribuição por código (`#REP-<codigo>`) já existem — este módulo é um consumidor deles, não um novo silo.
5. **Escopo por fase.** A Fase 1 é a única com autorização de implementação agora. Fases 2 e 3 são contexto, não backlog aberto.
6. Idioma de código e commits: seguir o padrão do repo. Comentários e docs em pt-BR.

---

## 1. Contexto

O Instagram do Quando Trocar não fecha venda — ele empurra para o WhatsApp comercial. Hoje o único caminho é **"link na bio"**, que tem três problemas:

- Exige 3 toques do usuário (post → perfil → bio → navegador) e perde a maior parte no caminho.
- Não deixa rastro: não sabemos quem clicou, só o total agregado.
- Não gera sinal de engajamento para o algoritmo.

A mecânica **"comente QUANDO e eu te mando o link"** resolve os três: o comentário é 1 toque, vira lead identificado, e comentário é o sinal de engajamento mais forte do feed.

A Meta expõe isso oficialmente via **Private Replies API**: um comentário público autoriza **um** DM ao autor, sem conversa prévia e fora da janela de 24h. É exatamente o que o ManyChat revende por mensalidade.

### Decisão

Construir a integração direto contra a Graph API. Custo de infra ≈ R$ 0 (roda no hosting que já existe). O custo real é o **App Review da Meta**, que é lento e precisa começar cedo.

---

## 2. Objetivos

| # | Objetivo | Métrica |
|---|---|---|
| O1 | Converter comentário em conversa no WhatsApp sem intervenção humana | Comentários com keyword → DMs entregues (meta: ≥ 95%) |
| O2 | Atribuir o lead à origem `instagram_comment` e ao post específico | 100% dos leads dessa origem com `media_id` gravado |
| O3 | Nunca mandar DM duplicado nem DM errado | 0 duplicatas; 0 DMs para comentário sem keyword |
| O4 | Latência comentário → DM abaixo de 30s | p95 do tempo entre `webhook.received_at` e `dm_sent_at` |

### Não-objetivos (fora de escopo, não implementar)

- Fluxo conversacional multi-etapa no DM do Instagram (isso é papel do bot de WhatsApp).
- Responder DMs recebidos espontaneamente no Instagram.
- Publicar posts pela API.
- Moderação/ocultação automática de comentários.
- Dashboard visual — nesta fase, consulta SQL basta.
- Suporte a múltiplas contas de Instagram (multi-tenant). É uma conta só: a nossa.

---

## 3. Fases

| Fase | O que é | Autorizado agora? |
|---|---|---|
| **Fase 0 — validação manual** | Rodar "comente QUANDO" em 3 posts e responder na mão. Medir volume real. | Sim (não é código) |
| **Fase 1 — MVP funcional em dev mode + App Review submetido** | Webhook + private reply + reply público + persistência + atribuição. Funciona 100% com a nossa própria conta antes da aprovação. | **Sim — é este PRD** |
| **Fase 2 — produção** | Flip para Live Mode após aprovação da Meta. Só config, sem código novo previsto. | Depois |
| **Fase 3 — evolução** | Múltiplas keywords por post, follow-up, painel de conversão. | Não |

> **Racional do MVP:** a Fase 1 é construída para rodar com App Review pendente. Em dev mode o fluxo é integralmente testável com contas que tenham papel no app. Isso descola o desenvolvimento da fila da Meta.

---

## 4. Fluxo funcional

```
Usuário comenta "QUANDO" num post
        │
        ▼
Meta dispara webhook (object: instagram, field: comments)
        │
        ▼
POST /api/webhooks/instagram          [VERIFICAR: convenção de rotas do repo]
        │
        ├─ 1. valida X-Hub-Signature-256 (raw body)   → inválido: 401, encerra
        ├─ 2. grava evento cru (auditoria)
        ├─ 3. responde 200 IMEDIATAMENTE
        │
        └─ processamento (assíncrono ou pós-resposta)
             ├─ 4. é comentário nosso? (from.id == IG_USER_ID) → ignora
             ├─ 5. bate alguma keyword ativa?              → não: ignora
             ├─ 6. comment_id já processado?               → sim: ignora (idempotência)
             ├─ 7. envia PRIVATE REPLY (DM com o link)
             ├─ 8. envia REPLY PÚBLICO ("te mandei no direct")
             └─ 9. persiste resultado + status
```

### O DM enviado

Conteúdo curto, com link `wa.me` já carregando o código de origem — mesma mecânica de atribuição do `#REP-<codigo>`:

```
Opa! Aqui está 👇

https://wa.me/55XXXXXXXXXXX?text=Vim%20do%20Instagram%20%23IG-QUANDO

São 14 dias grátis, sem cartão. Qualquer dúvida é só chamar por aí.
```

O bot de WhatsApp já sabe ler o código na primeira mensagem `[VERIFICAR: confirmar em lib/whatsapp/ como o #REP- é parseado e estender para #IG-]`.

### O reply público

```
te mandei no direct 👍
```

Serve como prova social de que a automação funciona e multiplica o volume de comentários. É comportamento desejado, não efeito colateral.

### Guardrails de conteúdo

O texto do DM e do reply público **são conteúdo de marketing** e obedecem `docs/marketing/instagram/estrategia.md §4` integralmente:

- Nunca prometer retorno de cliente ou percentual de recuperação.
- Preço, quando citado, é sempre R$ 59/mês + 14 dias grátis sem cartão. Nunca promoção ou urgência.
- Nunca posicionar como sistema de gestão.
- Sem emoji decorativo em excesso, sem CAPSLOCK, sem exclamação em série.

**Consequência de desenho:** os templates ficam em banco (§6), editáveis sem deploy — mas qualquer alteração passa pelos mesmos guardrails. Documentar isso no README do módulo.

---

## 5. Contratos externos (Meta)

> Versão da Graph API: usar a mais recente estável no momento da implementação (referência atual: `v25.0`). Centralizar a versão numa constante única — nunca hardcode espalhado.

### 5.1 Verificação do webhook

```
GET /api/webhooks/instagram
  ?hub.mode=subscribe
  &hub.verify_token=<IG_WEBHOOK_VERIFY_TOKEN>
  &hub.challenge=<string>

→ 200 text/plain com o valor de hub.challenge, se o token conferir
→ 403 caso contrário
```

### 5.2 Recebimento de evento

```
POST /api/webhooks/instagram
Headers: X-Hub-Signature-256: sha256=<hmac>
```

Payload:

```json
{
  "object": "instagram",
  "entry": [{
    "id": "<IG_USER_ID>",
    "time": 1783746618,
    "changes": [{
      "field": "comments",
      "value": {
        "id": "<COMMENT_ID>",
        "text": "QUANDO",
        "media": { "id": "<MEDIA_ID>", "media_product_type": "FEED" },
        "from": { "id": "<AUTHOR_SCOPED_ID>", "username": "<username>" }
      }
    }]
  }]
}
```

> O formato do `value` varia por tipo de evento e por versão. **Não confie nesta estrutura cegamente** — parseie defensivamente com schema (zod ou equivalente já usado no repo) e logue payloads não reconhecidos em vez de estourar.

### 5.3 Private reply (o DM)

```
POST https://graph.instagram.com/{VERSION}/{IG_USER_ID}/messages
Authorization: Bearer {IG_ACCESS_TOKEN}
Content-Type: application/json

{
  "recipient": { "comment_id": "<COMMENT_ID>" },
  "message":   { "text": "<texto>" }
}
```

`recipient.comment_id` no lugar de um user id é o que autoriza iniciar a conversa.

### 5.4 Reply público

```
POST https://graph.instagram.com/{VERSION}/{COMMENT_ID}/replies
{ "message": "te mandei no direct 👍" }
```

### 5.5 Limites impostos pela Meta

| Limite | Valor | Implicação no código |
|---|---|---|
| Private replies por comentário | **1, para sempre** | Idempotência é obrigatória, não opcional |
| Janela de private reply | 7 dias após o comentário | Descartar comentário antigo com status `expired` |
| Rate limit de mensagens | ~2 req/s por conta | Processar sequencialmente; sem paralelismo |
| Timeout do webhook | Responder rápido | 200 antes de processar; Meta re-entrega se demorar |
| Validade do token | Long-lived, ~60 dias | Job de refresh (§8) |

---

## 6. Modelo de dados

> `[VERIFICAR]` schema, convenção de nomes, uso de `snake_case`, presença de RLS e padrão de `updated_at` (trigger vs. aplicação) no repo antes de escrever a migration.

### `ig_keyword_rules` — configuração sem deploy

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `keyword` | text not null | comparação case/acento-insensitive |
| `media_id` | text null | null = vale para todos os posts |
| `active` | boolean default true | |
| `dm_template` | text not null | suporta `{{username}}` |
| `public_reply_template` | text null | null = não responde publicamente |
| `destination_url` | text not null | o `wa.me` com o código de origem |
| `created_at` / `updated_at` | timestamptz | |

### `ig_comment_leads` — um registro por comentário processado

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `comment_id` | text **unique not null** | a trava de idempotência |
| `media_id` | text | atribuição por post |
| `author_scoped_id` | text | id do autor, escopado ao app |
| `author_username` | text | |
| `comment_text` | text | |
| `matched_rule_id` | uuid fk → `ig_keyword_rules` | |
| `status` | text | enum abaixo |
| `dm_sent_at` | timestamptz null | |
| `public_reply_id` | text null | |
| `error_code` / `error_message` | text null | erro cru da Meta, para diagnóstico |
| `lead_id` | uuid null fk → `leads` | preenchido quando o contato chegar no WhatsApp `[VERIFICAR nome da tabela]` |
| `created_at` / `updated_at` | timestamptz | |

**Enum `status`:** `pending` · `dm_sent` · `dm_failed` · `public_reply_failed` · `skipped_own_comment` · `skipped_no_match` · `skipped_duplicate` · `expired`

### `ig_webhook_events` — auditoria crua

| Coluna | Tipo |
|---|---|
| `id` | uuid pk |
| `payload` | jsonb |
| `signature_valid` | boolean |
| `received_at` / `processed_at` | timestamptz |
| `error` | text null |

Retenção: 30 dias, purga por job. Serve para depurar formato de payload novo, não para relatório.

### Índices

- `ig_comment_leads(comment_id)` — unique
- `ig_comment_leads(media_id, created_at desc)` — relatório por post
- `ig_comment_leads(status)` — reprocessamento de falha
- `ig_webhook_events(received_at)` — purga

---

## 7. Estrutura de código proposta

> `[VERIFICAR]` a convenção do repo. Se houver módulos declarados em `.context/modules`, **registrar este como módulo novo** antes de criar arquivo.

```
app/api/webhooks/instagram/route.ts     GET (verify) + POST (events). Fino: valida, grava, delega.
lib/instagram/
  ├── client.ts          chamadas à Graph API (private reply, comment reply). Reusar HTTP client do repo.
  ├── signature.ts       HMAC SHA-256 do raw body
  ├── schema.ts          parse defensivo do payload
  ├── keyword.ts         normalização (lowercase, sem acento) + match
  ├── process.ts         orquestração: regras → dedupe → envio → persistência
  ├── templates.ts       render de {{username}} etc.
  ├── token.ts           leitura e refresh do long-lived token
  └── types.ts
supabase/migrations/<timestamp>_instagram_comment_capture.sql
```

**Regra de ouro do route handler:** ele valida assinatura, persiste o evento cru, responde 200 e só então dispara o processamento. Nenhuma chamada à Meta acontece antes do 200.

---

## 8. Regras de negócio e casos de borda

| Caso | Comportamento esperado |
|---|---|---|
| Assinatura inválida | 401, grava evento com `signature_valid = false`, não processa |
| Comentário do próprio perfil | `skipped_own_comment` — **crítico**, senão o reply público vira loop infinito |
| Comentário sem keyword | `skipped_no_match` |
| `comment_id` repetido | `skipped_duplicate`, nenhuma chamada à Meta |
| Comentário > 7 dias | `expired`, não tenta enviar |
| Autor com DM fechado / bloqueado | `dm_failed` + guarda `error_code`. Ainda assim envia o reply público, apontando o link da bio |
| DM ok, reply público falha | `public_reply_failed` — o DM já saiu, **não retentar o DM** |
| Comentário editado | Novo webhook, mesmo `comment_id` → dedupe cobre |
| Comentário apagado antes do envio | Chamada retorna erro; registrar `dm_failed` e não retentar |
| Regra desativada no meio | Verificar `active` no momento do processamento, não no do comentário |
| Meta reentrega o mesmo evento | Dedupe por `comment_id` cobre |
| Rate limit (429) | Backoff exponencial, máx. 3 tentativas, sequencial |
| Token expirado | Job de refresh diário; se falhar, alertar. Nunca falhar silenciosamente |

**Match de keyword:** normalizar removendo acento, caixa e pontuação, e casar por *palavra contida* — `"quando"` deve casar em `"QUANDO"`, `"quando!"`, `"Quando 🙏"`, `"eu quero, quando"`. Não deve casar em `"quandotrocar"` como substring de outra palavra sem separador.

---

## 9. Segurança e privacidade

- **Secrets** em variável de ambiente / vault do projeto, nunca no código nem em tabela sem criptografia. `[VERIFICAR política de secrets do repo]`
- Validação de assinatura HMAC é **obrigatória** e usa o **raw body** — em Next.js Route Handler, `await req.text()`, nunca `req.json()` antes de validar.
- `IG_WEBHOOK_VERIFY_TOKEN` gerado aleatoriamente, ≥ 32 chars.
- **LGPD:** guardamos `author_scoped_id` e `author_username` — dado pessoal. Definir base legal (legítimo interesse, comentário público em resposta a chamada explícita nossa), retenção (sugestão: 12 meses sem conversão → anonimizar) e caminho de exclusão a pedido. Adicionar à política de privacidade da landing.
- RLS nas tabelas novas seguindo o padrão do repo. Nada de acesso anônimo.

### Variáveis de ambiente

```
IG_APP_ID
IG_APP_SECRET               # usado na validação HMAC
IG_ACCESS_TOKEN             # long-lived, rotacionado
IG_USER_ID                  # id da conta profissional
IG_WEBHOOK_VERIFY_TOKEN
IG_GRAPH_API_VERSION        # ex.: v25.0
IG_AUTOMATION_ENABLED       # kill switch global
```

`IG_AUTOMATION_ENABLED=false` deve desligar o envio mantendo o registro dos comentários. Não é opcional — é a válvula para o dia em que algo sair errado ao vivo.

---

## 10. Observabilidade

Reusar o logger e o Sentry (ou equivalente) já configurados. Instrumentar:

- Evento recebido / assinatura inválida
- DM enviado / DM falhou (com `error_code` da Meta)
- Latência comentário → DM
- Contagem diária por `status`

**Alertar** quando: taxa de `dm_failed` > 10% na janela de 1h · token a menos de 7 dias do vencimento · assinatura inválida recorrente (tentativa de forjar webhook).

---

## 11. Testes

**Unitários**
- `signature.ts`: assinatura válida, inválida, header ausente, body vazio
- `keyword.ts`: acento, caixa, pontuação, emoji, keyword como substring (não deve casar)
- `templates.ts`: interpolação e placeholder ausente
- `schema.ts`: payload válido, payload com campo faltando, payload de outro `field`

**Integração** (Meta mockada)
- Fluxo feliz completo
- Comentário próprio → nenhuma chamada externa
- Comentário duplicado → nenhuma chamada externa
- DM falha → reply público ainda sai; status correto
- 429 → backoff e retry

**Manual em dev mode**
- Conta de teste comenta no post real → DM chega → link abre WhatsApp com o código de origem preenchido

Fixtures de payload em `lib/instagram/__fixtures__/`.

---

## 12. Critérios de aceite

1. `GET` no webhook responde o `hub.challenge` e o app dashboard da Meta valida a inscrição em `comments`.
2. Comentário com a keyword, feito por conta de teste, gera DM em menos de 30s.
3. O link do DM abre o WhatsApp com o texto contendo o código de origem, e o bot atribui o lead a `instagram_comment`.
4. Reply público aparece no post.
5. Reenviar o mesmo payload de webhook não gera segundo DM.
6. Comentário do próprio perfil não dispara nada.
7. Comentário sem keyword não dispara nada.
8. Webhook com assinatura inválida retorna 401 e não dispara nada.
9. `IG_AUTOMATION_ENABLED=false` para os envios e mantém o registro.
10. Suíte de testes verde; lint e typecheck limpos.
11. Migration aplica e reverte sem erro.
12. README do módulo documenta setup, variáveis e como editar os templates dentro dos guardrails.

---

## 13. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| App Review rejeitado ou lento | Alta | Bloqueia produção | Submeter no dia 1 da Fase 1; screencast completo; §14 |
| Loop de auto-resposta | Média | Ban da conta | Filtro `from.id == IG_USER_ID` com teste dedicado |
| Formato do payload muda | Média | Quebra silenciosa | Parse defensivo + log de payload não reconhecido + alerta |
| Volume insuficiente para justificar | Média | Trabalho desperdiçado | Fase 0 mede antes |
| Meta trata como engagement bait | Baixa | Alcance reduzido | Mecânica é padrão da plataforma; não prometer nada falso no post |
| Token expira sem refresh | Média | Automação morre calada | Job de refresh + alerta de 7 dias |

---

## 14. Checklist de App Review

Fazer **em paralelo** ao desenvolvimento, não depois.

- [ ] Conta Instagram Professional (Business ou Creator)
- [ ] Configurações do Instagram → **Allow access to messages** ligado
- [ ] App criado no Meta for Developers, produto Instagram adicionado
- [ ] Verificação de negócio (Business Verification) concluída — costuma ser o gargalo
- [ ] Callback URL do webhook configurada e verificada, inscrita em `comments`
- [ ] Permissões solicitadas: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`
- [ ] Screencast por permissão, mostrando o fluxo real ponta a ponta com conta de teste
- [ ] Descrição de uso por permissão, em inglês, específica (genérico é rejeitado)
- [ ] Política de privacidade pública cobrindo o tratamento desses dados
- [ ] Prova de chamada de API por permissão (o dashboard exige)

---

## 15. Entregáveis

**Arquivos novos**
- `app/api/webhooks/instagram/route.ts`
- `lib/instagram/{client,signature,schema,keyword,process,templates,token,types}.ts`
- `lib/instagram/__fixtures__/*.json` + testes correspondentes
- `supabase/migrations/<timestamp>_instagram_comment_capture.sql`
- `docs/adr/ADR-00XX-instagram-comment-capture.md`
- `lib/instagram/README.md`

**Arquivos alterados (esperado)**
- `.env.example` — variáveis do §9
- Módulo de WhatsApp — estender o parser de código de origem para aceitar `#IG-`
- `.context/modules` ou equivalente — declarar o módulo novo `[VERIFICAR]`

**Migrations a aplicar**
- `<timestamp>_instagram_comment_capture.sql` — 3 tabelas, índices, RLS, seed de 1 regra (`QUANDO`)

**Edge functions a deployar**
- Nenhuma, se o webhook viver como Route Handler no Next/Vercel.
- Se o repo padroniza webhooks em Supabase Edge Function `[VERIFICAR]`, então: `instagram-webhook` + `instagram-token-refresh` (cron diário).

**Config fora do código**
- Variáveis de ambiente em dev, preview e produção
- Webhook e permissões no app dashboard da Meta

---

## 16. Perguntas em aberto

1. Número de WhatsApp de destino e formato exato do código de origem (`#IG-QUANDO`? `#IG-<media_id>`?).
2. O parser de origem do bot de WhatsApp aceita prefixo diferente de `#REP-` hoje, ou precisa de alteração?
3. Webhooks no repo vivem em Route Handler ou Edge Function?
4. Existe fila/job runner (cron, pg_cron, QStash) ou o refresh de token precisa de infra nova?
5. Retenção e anonimização: 12 meses é aceitável para o jurídico?
6. Uma keyword só (`QUANDO`) ou já nasce com regra por post?
