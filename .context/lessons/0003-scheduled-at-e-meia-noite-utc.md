# LICAO 0003: `scheduled_at` e meia-noite UTC — formatar no fuso da oficina devolve o dia anterior

- **Data:** 2026-07-25
- **Modulo(s):** [[whatsapp-bot]], [[database]]
- **Severidade:** media
- **Descoberta por:** teste, ao implementar o P0-3 da QTR-35 (a copy do cadastro passou a
  informar a data agendada em vez de "em N dias")

## Sintoma
Um lembrete agendado para o dia 24/07/2026 aparecia como **23/07/2026** na mensagem enviada
a oficina. Erro constante de um dia, em todo registro — silencioso, porque a data continua
plausivel.

## Causa
A sessao do Postgres deste projeto roda em **UTC** (`current_setting('TimeZone')` = `UTC`).
O RPC monta a data do lembrete com:

```sql
p_data_servico::timestamptz + make_interval(days => v_dias_lembrete)
```

`p_data_servico` e um `date`. O cast `::timestamptz` usa o fuso da sessao, entao o valor gravado
em `lembretes.scheduled_at` e **meia-noite UTC do dia de calendario pretendido**
(`2026-07-24 00:00:00+00`). Formatar esse instante em `America/Sao_Paulo` (UTC-3) cai em
`2026-07-23 21:00`, ou seja, **o dia anterior**.

O mesmo vale para qualquer `timestamptz` derivado de um `date` por essa via — nao e especifico
de lembrete.

## Como evitar / resolver
- **Formatar em UTC** quando o `timestamptz` representa um *dia de calendario* derivado de um
  `date` no banco (`formatDateBRFromIso` em `lib/whatsapp/webhook-handler.ts` usa
  `timeZone: "UTC"` de proposito, com comentario explicando).
- Nao confundir com **instante real** (`created_at`, `sent_at`, `now()`): esses sim devem ser
  exibidos no fuso do leitor.
- A janela de envio do lembrete e caso separado e continua no fuso da oficina
  (`now() at time zone o.timezone` em `enqueue_due_whatsapp_reminders`) — ali o que importa e a
  hora local, nao o dia de calendario.
- Ao ler `timestamptz` vindo do Postgres em JS, normalizar o formato antes do `new Date()`: o
  texto cru usa espaco e offset curto (`2026-07-24 00:00:00+00`), que `new Date()` **recusa**
  silenciosamente (`Invalid Date`); PostgREST devolve `2026-07-24T00:00:00+00:00`. Foi assim que
  um teste "perdeu" a data e o codigo caiu no caminho de "sem lembrete agendado".

## Referencias
- [ADR-0027](../../docs/adr/0027-extracao-de-cadastro-por-llm.md) e o P0-3 do plano
  `docs/backlog-whatsapp-bot/qtr-35-p0-qualidade-cadastro.md`
- Regras de negocio §4.1 (`docs/regras-de-negocio.md`)
- Migration `20260725120000_register_service_returns_scheduled_at.sql`
- Testes: `tests/whatsapp-cadastro-ack.test.ts`
