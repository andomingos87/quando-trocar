# Runbook · Deploy na Vercel

## Quando usar

- Subir uma mudança para preview (PR ou branch).
- Promover preview para produção.
- Trocar uma variável de ambiente em produção.
- Reverter um deploy quebrado.

## O que você vai precisar antes

- Projeto vinculado na Vercel (já está — veja `vercel.json`).
- Variáveis de ambiente configuradas no Vercel — ver [env-setup](./env-setup.md).
- Acesso ao painel Vercel do projeto.
- Vercel CLI instalado (opcional, útil): `npm i -g vercel@latest`.

## Como o projeto está configurado

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm ci",
  "outputDirectory": ".next"
}
```

Fluxo padrão:

- **Push para branch** → Vercel cria preview deploy automático com URL única.
- **Merge para `main`** → Vercel promove para produção (`quandotrocar.com.br` ou domínio configurado).

## Deploy de preview

### Caminho preferido (Git)

1. Push da branch:

   ```bash
   git push origin minha-branch
   ```

2. Aguarde notificação no PR (ou no painel Vercel).
3. Abra a URL do preview (algo como `https://quando-trocar-git-minha-branch-anderson.vercel.app`).

### Caminho alternativo (CLI)

```bash
vercel
```

Cria preview manual sem precisar de PR. Útil para teste rápido sem commit.

## Deploy de produção

### Caminho preferido (merge)

1. Abra PR contra `main`.
2. Aguarde CI/preview passar.
3. Merge.
4. Vercel promove automaticamente.

### Caminho alternativo (CLI)

```bash
vercel --prod
```

Use apenas em emergência ou hotfix. Histórico no Git é a fonte de verdade.

## Configurar variáveis de ambiente

Ver [env-setup §Setup no Vercel](./env-setup.md#setup-no-vercel-production--preview).

Resumo: `Settings > Environment Variables` no painel Vercel. Marque Production/Preview/Development conforme aplicável. **Faça redeploy após adicionar/alterar** — variáveis só entram no runtime no próximo build.

## Smoke tests pós-deploy

Quando subir mudanças que afetam landing, webhook ou bot:

### Landing

1. Abra `https://quandotrocar.com.br` (ou preview URL).
2. Confirme que carrega.
3. Clique no CTA principal — abre WhatsApp com mensagem pré-preenchida.

### Webhook WhatsApp

1. Confirme que `https://SEU_DEPLOY/api/webhooks/whatsapp` responde 200 para `GET` com `hub.challenge` (se a Meta acabou de validar) ou 200 para `POST` (se for um evento).
2. Envie mensagem de teste para o número configurado.
3. Verifique no Supabase:

   ```sql
   select * from whatsapp_events order by created_at desc limit 5;
   select * from leads_oficina order by created_at desc limit 5;
   select * from mensagens order by created_at desc limit 10;
   ```

4. Confirme que recebeu resposta no WhatsApp.

### Build

```bash
npm run build
```

Se rodar localmente sem erros, geralmente passa na Vercel. Erros mais comuns: env var faltando em runtime (não em build), import de server-only em client component.

## Reverter um deploy

### Caminho preferido (rollback no painel)

1. Vercel → Deployments → encontre o deploy anterior estável.
2. Clique nos `...` → `Promote to Production`.
3. Confirme.

Não exige redeploy nem rebuild — instantâneo.

### Caminho alternativo (revert no Git)

```bash
git revert <commit-quebrado>
git push origin main
```

Vercel faz novo build e promove.

## Trocar de número de teste para número real

Quando sair do número de teste da Meta para um número real:

1. Atualize as variáveis no Vercel ([env-setup](./env-setup.md)):

   ```env
   WHATSAPP_PHONE_NUMBER_ID=novo_phone_number_id
   NEXT_PUBLIC_WHATSAPP_NUMBER=novo_numero_em_formato_internacional_sem_+
   ```

2. Faça redeploy.
3. Atualize o webhook URL na Meta se mudou o domínio ([Setup do WhatsApp na Meta](./meta-whatsapp-setup.md)).
4. Reaprove templates se necessário.
5. Smoke test completo.

## Problemas comuns

### Build falha por env var faltando

Algumas variáveis são lidas no build (ex: `NEXT_PUBLIC_*`). Confira que estão configuradas em `Production` no painel Vercel.

### Preview funciona, produção quebra

Provavelmente variáveis configuradas só em Preview, não em Production. Repita o setup para Production.

### Webhook funciona em preview mas Meta não valida produção

A Meta só valida 1 callback URL por App. Para produção use o domínio principal; para teste use um App separado ou troque a URL temporariamente.

### "Function exceeded execution timeout"

Algum handler está tentando processar síncrono. Veja [ADR-0004](../adr/0004-padrao-webhook-persist-fila-worker.md) — processar pesado deve ir para fila/worker, não no request HTTP.

### Mudança em variável não tem efeito

Variáveis só atualizam em runtime no próximo deploy. Faça redeploy.

## Referências

- `vercel.json`
- [env-setup](./env-setup.md)
- [Setup do WhatsApp na Meta](./meta-whatsapp-setup.md)
- [ADR-0004](../adr/0004-padrao-webhook-persist-fila-worker.md) — webhook não-síncrono.
