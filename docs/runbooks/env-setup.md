# Runbook · Setup de variáveis de ambiente

## Quando usar

- Primeira vez clonando o projeto e configurando `.env.local`.
- Adicionando uma variável nova ao projeto.
- Configurando variáveis no Vercel para deploy.
- Trocando entre número de teste e número real do WhatsApp.

## O que você vai precisar antes

- Acesso ao projeto Supabase (URL e service role key).
- Acesso ao OpenAI (API key).
- Acesso ao App da Meta WhatsApp (App Secret, Access Token, Phone Number ID) — ver [Setup do WhatsApp na Meta](./meta-whatsapp-setup.md).
- Para deploy: acesso ao projeto na Vercel.

## Variáveis usadas

A fonte oficial é `.env.local.example` na raiz. Lista atual:

### Públicas (`NEXT_PUBLIC_*` — vão para o browser)

```env
NEXT_PUBLIC_WHATSAPP_NUMBER=15556669965
NEXT_PUBLIC_CONTACT_EMAIL=contato@quandotrocar.com.br
NEXT_PUBLIC_SITE_URL=https://quandotrocar.com.br
```

### Backend / server-only (nunca prefixar com `NEXT_PUBLIC_`)

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...

WHATSAPP_VERIFY_TOKEN=...     # você inventa, igual ao configurado na Meta
WHATSAPP_APP_SECRET=...        # do App da Meta > Básico
WHATSAPP_ACCESS_TOKEN=...      # do usuário do sistema na Meta
WHATSAPP_PHONE_NUMBER_ID=...   # do telefone configurado na Meta

INTERNAL_JOB_SECRET=...        # protege endpoints internos (scheduler, workers)
```

Regra inviolável: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `INTERNAL_JOB_SECRET` **nunca** podem ser `NEXT_PUBLIC_*`. Se aparecerem no bundle do browser, troque imediatamente (já vazaram).

## Setup local (`.env.local`)

1. Copie o template:

   ```bash
   cp .env.local.example .env.local
   ```

2. Preencha cada variável seguindo a lista acima. Para WhatsApp veja o [runbook da Meta](./meta-whatsapp-setup.md).

3. Confirme que `.env.local` está gitignored (já está em `.gitignore`).

4. Reinicie o dev server (`npm run dev`) — Next.js lê env vars no boot.

## Setup no Vercel (Production / Preview)

1. Acesse o projeto na Vercel → `Settings` → `Environment Variables`.
2. Adicione cada variável da lista acima.
3. Para cada uma, marque os ambientes onde aplica:
   - `Production` — sempre.
   - `Preview` — sempre (para validar PRs).
   - `Development` — só se você usar `vercel env pull` localmente.
4. Salve e faça redeploy. Variáveis só entram em runtime após novo deploy.

Variáveis sensíveis (tokens, secrets) podem ser marcadas como "Sensitive" no Vercel — não aparecem na UI depois de salvas.

## Como verificar que funcionou

### Local

```bash
npm run dev
# abra http://localhost:3000
# o site deve carregar com link de WhatsApp para o número configurado
```

Para testar webhook localmente, use túnel HTTPS (ngrok, Cloudflare Tunnel) e atualize o callback URL na Meta.

### Vercel

1. Faça um deploy de preview.
2. Abra `https://SEU_PREVIEW.vercel.app` — site deve carregar.
3. Para testar o webhook, atualize o callback URL na Meta para o preview e envie mensagem.
4. Confirme em `whatsapp_events` no Supabase que o evento foi persistido.

## Problemas comuns

### `Module not found: Can't resolve '@supabase/...'`

Falta `npm install`. Rode no projeto.

### Webhook validation falha na Meta

Provavelmente `WHATSAPP_VERIFY_TOKEN` não é idêntico ao configurado no painel da Meta. Confira espaços e quebras de linha.

### Bot não envia mensagem (mas recebe)

`WHATSAPP_ACCESS_TOKEN` pode estar expirado (token temporário). Gere um novo (temporário para teste rápido) ou crie permanente via usuário do sistema. Ver [Setup do WhatsApp na Meta §7.2](./meta-whatsapp-setup.md).

### "Invalid signature" ao receber webhook

`WHATSAPP_APP_SECRET` errado. Pegue novamente em `developers.facebook.com/apps > Configurações do app > Básico`.

### Supabase: `JWT expired` ou `Invalid API key`

`SUPABASE_SERVICE_ROLE_KEY` está incorreta. Confira no painel do Supabase em `Project Settings > API > service_role`.

## Referências

- `.env.local.example`
- `AGENTS.md §Environment`
- [Setup do WhatsApp na Meta](./meta-whatsapp-setup.md)
- [Deploy na Vercel](./deploy-vercel.md)
