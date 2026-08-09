# Prospec-3 — Canal de e-mail

## Objetivo

Alcançar as oficinas que o WhatsApp não alcança, sem colocar em risco nenhum ativo de
comunicação existente.

O e-mail é o canal de **maior alcance** da base e o de **montagem mais lenta**. Vale começar
cedo mesmo que o volume só escale depois — reputação de domínio leva semanas para construir e
minutos para destruir.

## Por que e-mail

| | E-mail | WhatsApp |
|---|---|---|
| Cobertura em Guarulhos | 5.173 (95,2%) | 2.043 (37,6%) |
| Risco ao ativo de produção | nenhum (domínio separado) | alto (quality rating da Meta) |
| Custo por mil | ~US$ 0,10 | template pago + risco |
| Precisa de opt-in prévio | não (legítimo interesse B2B) | na prática, sim |

**2,5× mais alcance que o celular.** E o dado é bom: dos 5.173 e-mails, 4.938 são únicos — só
7,4% compartilham endereço (contador). São e-mails **pessoais do dono** (57% gmail, 16,5%
hotmail), não caixas corporativas genéricas. Isso é bom para leitura e ruim para reclamação de
spam: quem recebe é uma pessoa, e pessoa clica em "marcar como spam" sem pensar duas vezes.

## O CTA é o WhatsApp

O e-mail **não vende e não pede resposta por e-mail**. Ele leva para o WhatsApp.

Quando a oficina clica e manda mensagem, ela **inicia** a conversa. Isso resolve de graça três
problemas: abre a janela de 24h da Meta, dispensa template aprovado, e o `agent_mode = vendas`
assume automaticamente pelo `conversation-router` que já existe. **Zero código de agente novo.**

Usar o link do representante (`/r/<CODIGO>`, [ADR-0030](../adr/0030-link-de-indicacao-do-representante.md))
quando houver rep atribuído — a atribuição e a janela de 30 dias vêm junto. Sem rep, `wa.me`
com prefill.

## Compliance — ler antes de escrever código

### O domínio de envio é separado. Não negociável.

Mesmo raciocínio do número WhatsApp: cold outreach queima reputação, e reputação de domínio é
compartilhada. Se sair de `quandotrocar.com.br`, o OTP do painel admin, os avisos de cobrança e
qualquer e-mail transacional futuro vão para a caixa de spam junto.

Usar **domínio distinto** (ex.: `falecomquandotrocar.com.br`), não subdomínio — alguns filtros
propagam reputação organizacional entre subdomínios.

### LGPD

Os e-mails são de pessoas naturais (gmail/hotmail do dono), não de pessoa jurídica. O rigor é
maior do que "é B2B, pode tudo":

- [ ] **Teste de legítimo interesse documentado** (art. 7º, IX) antes do primeiro envio:
      finalidade, necessidade, e o balanceamento contra a expectativa do titular. Guardar em
      `docs/legal/` ou equivalente.
- [ ] **Informar a origem do dado no próprio e-mail**: "obtivemos seu contato no cadastro
      público de CNPJ da Receita Federal". Transparência é requisito, e de quebra reduz
      reclamação de spam — a pessoa entende por que recebeu.
- [ ] **Opt-out em um clique**, honrado imediatamente e para sempre.
- [ ] Apontar para as páginas que já existem: `/privacidade` e `/exclusao-dados`.
- [ ] Identificação completa do remetente (razão social e endereço) no rodapé.

### Requisitos técnicos de quem envia em volume

Gmail e Yahoo passaram a exigir, desde 2024, de remetentes em volume:

- [ ] SPF **e** DKIM **e** DMARC alinhados (começar `p=none`, subir para `quarantine`).
- [ ] **One-click unsubscribe** por cabeçalho (`List-Unsubscribe` + `List-Unsubscribe-Post`,
      RFC 8058) — não basta o link no rodapé.
- [ ] Taxa de reclamação de spam abaixo de 0,3%; mirar em **< 0,1%**.

Sem isso a entrega despenca independentemente do conteúdo.

## Sub-fases

### E-0 — Decisões e infraestrutura (sem código)

- [ ] **Escolher provedor lendo a política de uso aceitável primeiro.** Vários proíbem cold
      outreach explicitamente e derrubam a conta sem aviso — Postmark é o caso mais conhecido.
      Verificar a AUP antes de integrar, não depois. Candidatos: AWS SES (permissivo, mais
      barato, mas transfere toda a responsabilidade de reputação), ou uma plataforma de
      outbound que já faça warm-up. **Decisão do Anderson.**
- [ ] Registrar o domínio de envio.
- [ ] Configurar SPF, DKIM, DMARC e verificar com uma ferramenta de checagem.
- [ ] Sair do sandbox do provedor (SES começa limitado).
- [ ] Escrever o teste de legítimo interesse.

### E-1 — Modelo de dados

- [ ] Migration com:

```sql
create table public.prospeccao_emails (
  id                 uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.prospeccao_estabelecimentos(id) on delete cascade,
  email              text not null,
  sequencia          text not null,          -- 'apresentacao-v1'
  passo              integer not null check (passo between 1 and 5),
  status             text not null default 'agendado'
                     check (status in ('agendado','enviado','entregue','aberto','clicado',
                                       'respondeu','bounce','spam','cancelado')),
  provider_message_id text unique,
  agendado_para      timestamptz not null,
  enviado_em         timestamptz,
  erro               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (estabelecimento_id, sequencia, passo)   -- idempotência do disparo
);

-- Supressão é GLOBAL e PERMANENTE. Quem saiu, saiu — de qualquer sequência, para sempre.
create table public.prospeccao_email_supressao (
  email      text primary key,
  motivo     text not null check (motivo in ('descadastro','bounce_hard','spam','manual')),
  origem     text,
  created_at timestamptz not null default now()
);
```

- [ ] RLS habilitada sem policy nas duas (padrão do módulo).
- [ ] Índices: `(status, agendado_para)` para a fila; `(estabelecimento_id)`.

### E-2 — Envio e webhook

- [ ] `lib/prospeccao/email-client.ts` — envio pelo provedor, com `List-Unsubscribe`.
- [ ] `lib/prospeccao/email-templates.ts` — corpo em texto e HTML. Texto puro importa:
      e-mail só-HTML com uma imagem e um botão tem cara de marketing em massa e é filtrado.
- [ ] Token de descadastro assinado (`jose`, como as outras sessões do projeto), não
      sequencial — senão qualquer um descadastra qualquer um.
- [ ] `app/descadastro/page.tsx` — página pública, um clique, sem login.
- [ ] `app/api/webhooks/email/route.ts` — eventos do provedor, **com verificação de
      assinatura** (padrão dos webhooks existentes).
- [ ] Hard bounce → supressão automática. Spam complaint → supressão + alerta.
- [ ] Persistir o payload cru para auditoria, como nos outros webhooks.

### E-3 — Sequência e guardrails

- [ ] Cadência de 3 passos: **D+0**, **D+4**, **D+11**.
- [ ] **Parar a sequência inteira** se: responder, clicar, descadastrar, dar bounce, virar lead
      por qualquer outro caminho, ou o telefone aparecer em `leads_oficina`/`oficinas`.
- [ ] Cron diário processa a fila respeitando o teto do dia.
- [ ] **Warm-up obrigatório**: 30/dia na primeira semana, dobrando a cada 4 dias até o teto.
      Guarulhos leva ~6 semanas para escoar. Tentar mandar 5 mil e-mails numa semana de um
      domínio novo é o caminho mais rápido para a blocklist.
- [ ] **Kill switch determinístico**: bounce > 5% ou spam > 0,1% na janela de 7 dias pausa
      todas as sequências e alerta. Regra no banco, não julgamento humano no meio da noite.
- [ ] Só envia em dia útil, horário comercial (fuso `America/Sao_Paulo`).

### E-4 — Métricas

- [ ] Aba em `/admin/prospeccao`: enviados, entregues, aberturas, cliques, respostas, bounces,
      descadastros, e **quantos viraram lead** — a única métrica que decide se o canal fica.
- [ ] Funil por sequência e por passo (qual e-mail da série puxa o clique).
- [ ] Alerta visível quando o kill switch disparar.

## Regras

- [ ] Nunca enviar para quem está em `prospeccao_email_supressao`. Checar no momento do envio,
      não só no agendamento.
- [ ] Nunca enviar para quem já é lead ou cliente.
- [ ] Um estabelecimento recebe **uma sequência por vez**.
- [ ] Conteúdo é estático e versionado no repositório. **Sem LLM gerando texto de e-mail em
      massa** — [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md) vale aqui: o que sai
      com o nome da empresa é revisado por humano.

## Critérios de aceite

- Envio de teste passa em SPF, DKIM e DMARC (verificar com ferramenta de checagem).
- One-click unsubscribe funciona pelo cabeçalho, sem abrir o navegador.
- Descadastro entra na supressão e o passo 2 **não** sai.
- Hard bounce simulado no webhook suprime o endereço.
- Kill switch dispara em cenário simulado e pausa os envios.
- Lote de warm-up respeita o teto do dia.
- Clique no CTA leva ao WhatsApp e a conversa entra em `agent_mode = vendas`.

## Testes

- `tests/prospeccao-email.test.ts` — supressão bloqueia envio; idempotência por
  `(estabelecimento, sequencia, passo)`; cadência calcula as datas certas; parada por resposta
  ou clique; token de descadastro assinado rejeita adulteração; kill switch nos limiares.
- `tests/prospeccao-email-webhook.test.ts` — assinatura inválida é rejeitada; evento repetido é
  idempotente; hard bounce suprime; soft bounce não.

## Custo

~15.500 envios (5.173 × 3 passos) a ~US$ 0,10/mil = **menos de US$ 2** para Guarulhos inteira.
O custo real desta fase é o domínio, o warm-up e a atenção à reputação — não o envio.
