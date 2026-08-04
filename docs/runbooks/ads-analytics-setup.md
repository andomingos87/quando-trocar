# Runbook · Setup do Analytics de anúncios (Meta Ads via Windsor.ai)

## Quando usar

- Primeira vez ativando a tela `/admin/analytics-ads`.
- Trocando de conta de anúncios do Meta (ex.: nova ad account).
- Diagnosticando por que a tela mostra "Nenhum dado de anúncio sincronizado ainda".

## O que essa feature faz

Liga o gasto/resultado do Meta Ads (Instagram/Facebook) ao funil real do CRM
(lead → qualificado → convertido), respondendo "esse anúncio gerou venda de
verdade?". Duas fontes de dado, capturadas de formas diferentes:

1. **Atribuição do lead** (de graça, sem setup): quando alguém clica em
   "Enviar mensagem" num anúncio do Instagram/Facebook, a Meta manda um objeto
   `referral` (com `ctwa_clid`, `source_id` = id do anúncio, `headline`) na
   primeira mensagem do WhatsApp. `lib/whatsapp/payload.ts` já captura isso e
   `leads_oficina` já grava (`ad_id`, `ad_ctwa_clid`, `ad_headline`, ...) —
   first-touch, nunca sobrescrito. **Isso já funciona sem nenhuma configuração
   adicional.**
2. **Gasto/resultado do anúncio** (precisa de setup, 1x): sincronizado 1×/dia
   do Meta Ads via [Windsor.ai](https://windsor.ai) para a tabela
   `ad_insights_daily`. Sem isso, a tela mostra o funil de leads mas sem
   comparar com o gasto.

## Setup (fonte 2 — Windsor.ai)

### 1. Conectar a conta de Meta Ads no Windsor

No painel do Windsor.ai (ou via `get_connector_authorization_url` do MCP
Windsor, se estiver usando Claude Code): conecte o conector **`facebook`**
(cobre Meta Ads / Facebook & Instagram Ads) com a conta que tem acesso à ad
account usada nas campanhas do Instagram. **Atenção**: não confundir com o
conector `instagram` (orgânico) — são conectores diferentes.

### 2. Confirmar os nomes de campo do conector

Os nomes de campo em `lib/windsor/meta-ads.ts` (`campaign`, `adset`, `ad`,
`actions`, etc.) são os documentados publicamente pelo Windsor, mas só dá pra
confirmar de fato com a conta já conectada. Depois de conectar, rode (via MCP
Windsor, se disponível) `get_fields` para o conector `facebook` e compare com
a constante `FIELDS` em `lib/windsor/meta-ads.ts`. Se algum campo não existir,
ajuste a constante e o parsing de `actions` (`extractMessagingResults`).

### 3. Pegar a API key do Windsor

No painel do Windsor (Settings → API), copie a API key. Configure em
`WINDSOR_API_KEY` no `.env.local` (dev) e nas envs do Vercel (produção) — ver
[env-setup.md](./env-setup.md).

### 4. Configurar o sync automático (Supabase Cron)

A rota `app/api/internal/sync-ad-insights/route.ts` puxa os últimos 7 dias do
Meta Ads e faz upsert em `ad_insights_daily`. Ela é protegida por
`INTERNAL_JOB_SECRET` (mesma variável usada pelos lembretes/follow-up).

Uma vez, no SQL Editor do Supabase (ou via MCP), registre a URL do endpoint
publicado no Vault:

```sql
select vault.create_secret(
  'https://SEU_HOST/api/internal/sync-ad-insights',
  'ad_insights_sync_url'
);
```

O cron (`ad-insights-sync-daily`, 11:30 UTC / ~08:30 BRT) e a função
`dispatch_ad_insights_sync` já foram criados pela migration
`20260803120100_ad_insights_sync_cron.sql` — sem a URL no Vault, o job
simplesmente não faz nada (não quebra).

### 5. Rodar o primeiro sync manualmente (opcional, pra não esperar o cron)

```bash
curl -X POST https://SEU_HOST/api/internal/sync-ad-insights \
  -H "Authorization: Bearer $INTERNAL_JOB_SECRET"
```

## Diagnosticando "Nenhum dado sincronizado ainda"

1. `WINDSOR_API_KEY` está configurada no ambiente que roda a rota? (Vercel →
   Settings → Environment Variables)
2. A ad account do Meta está mesmo conectada no Windsor (conector
   `facebook`, não `instagram`)?
3. O secret `ad_insights_sync_url` existe no Vault e aponta pro host certo?
4. Rode o curl do passo 5 acima e olhe a resposta — erro de
   `windsor_fetch_failed` geralmente é API key errada ou conta não conectada;
   erro de campo inválido é a constante `FIELDS` desatualizada (passo 2).
