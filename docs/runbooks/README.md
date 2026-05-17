# Runbooks · Quando Trocar

Procedimentos operacionais passo a passo. Cada runbook responde uma pergunta operacional concreta com instruções verificáveis.

Se você precisa fazer X e não sabe por onde começar, o runbook é o lugar.

## Índice

| Runbook | Quando usar |
|---------|-------------|
| [Setup do WhatsApp na Meta](./meta-whatsapp-setup.md) | Configurar Cloud API, tokens, webhook e Phone Number ID na Meta. Primeira vez ou ao trocar de número. |
| [Setup de variáveis de ambiente](./env-setup.md) | Configurar `.env.local` no desenvolvimento, ou variáveis no Vercel para deploy. |
| [Migrations do Supabase](./supabase-migrations.md) | Criar, revisar e aplicar uma migration. Especialmente importante para mudanças que afetam RLS. |
| [Deploy na Vercel](./deploy-vercel.md) | Fazer deploy de preview ou produção, configurar env vars no Vercel, smoke tests pós-deploy. |

## Convenções dos runbooks

- Cada runbook começa com **quando usar** e **o que você vai precisar antes de começar**.
- Passos são imperativos e numerados. Comandos em blocos `bash` ou `env`.
- Cada runbook termina com **como verificar que funcionou** e **problemas comuns**.
- Erros conhecidos vão na seção "Problemas comuns" — se você encontrar um novo, adicione.

## Como criar um novo runbook

1. Identifique a tarefa operacional repetível.
2. Copie a estrutura de um runbook existente (`meta-whatsapp-setup.md` é um bom exemplo).
3. Adicione no índice acima.
4. Linka do `docs/README.md` na seção "Operação".
