# ADR 0014: Cadência e template Meta por tipo de serviço

- **Status**: superseded by [ADR-0031](./0031-catalogo-aberto-servicos-produtos.md) (catálogo aberto de serviços e produtos)
- **Data**: 2026-05-22
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/regras-de-negocio.md §3.2, §4.1, §4.4`; plano "3 níveis de produto" (Fases 1-2)

## Contexto

O produto Quando Trocar começou tratando "serviço" como texto livre, com cadência única (`oficinas.dias_lembrete_padrao = 90`) e template Meta único (`lembrete_troca_oleo`, hard-coded no RPC `enqueue_due_whatsapp_reminders` e no `reminder-worker.ts`).

O posicionamento real evoluiu: troca de óleo é o carro-chefe, **amortecedor** entrou como produto secundário com retorno típico de 2 anos (e captura de marca para inteligência de mercado — ADR adjacente sobre coleta de dados Perfect), e **revisão** virou catch-all.

Lembrar de trocar amortecedor 90 dias depois da troca queima o cliente. Mandar "está na hora da troca de óleo" para alguém que veio trocar amortecedor é incoerente. Sem cadência e template por tipo, o produto fica preso ao óleo.

A Fase 1 (migration `20260521000000_tipo_servico_marca_peca.sql`) já estruturou o dado em `servicos.tipo_servico` (enum fechado) e `servicos.marca_peca` (nullable). Falta usar esse dado no fluxo de lembrete.

## Decisão

**Tabela global `tipos_servico_default` define cadência e template Meta por tipo de serviço, gerenciável pelo admin em `/admin/tipos-servico`. Oficinas não sobrescrevem cadência no MVP — apenas o admin altera, e o efeito vale para todas as oficinas.**

### Arquitetura

- **`tipos_servico_default`** (migration `20260522000000_tipos_servico_default.sql`): PK `tipo_servico`, colunas `label`, `dias_lembrete`, `template_name`, `template_language`, `ativo`.
- **Seed inicial**: `troca_oleo=90d/lembrete_troca_oleo`, `amortecedor=730d/lembrete_amortecedor`, `revisao=180d/lembrete_revisao_geral`, `outro=180d/lembrete_revisao_geral`.
- **RPC `register_service_with_reminder`** lê cadência de `tipos_servico_default` (ativa) para o `p_tipo_servico` fornecido. Fallback: `oficinas.dias_lembrete_padrao` (preserva compatibilidade se admin desativar a linha).
- **RPC `enqueue_due_whatsapp_reminders`** faz join com `tipos_servico_default` para resolver `template_name`, `template_language` e o `body` renderizado (texto auditável em `outbound_messages.body`) dinamicamente, por tipo.
- **`reminder-worker.ts`** lê `templateName` e `templateLanguage` do payload do dequeue (em vez de hard-code). Fallback: `lembrete_troca_oleo` / `pt_BR` (resiliência se o scheduler não preencher).
- **`/admin/tipos-servico`** mostra 4 linhas (uma por tipo), permite editar `label`, `dias_lembrete`, `template_name`, `template_language`, `ativo`. Toda mutação grava em `admin_audit_log`. Tipo em si (`tipo_servico` PK) não muda.

### Templates Meta exigidos

Aprovação obrigatória antes de ativar o tipo:

- `lembrete_troca_oleo` — já existente, categoria Utility, 3 params.
- `lembrete_amortecedor` — novo, Utility, 3 params: `Oi {{1}}, aqui e da {{2}}. Ja faz um tempo que voce trocou os amortecedores do seu {{3}}. Recomendamos uma checagem. Quer agendar?`
- `lembrete_revisao_geral` — novo, Utility, 3 params: `Oi {{1}}, aqui e da {{2}}. Ja esta na hora da proxima revisao do seu {{3}}. Quer agendar?`

Se um template não estiver aprovado, o admin não deve ativar o tipo correspondente. O scheduler enfileira mesmo assim (o `ativo` em `tipos_servico_default` controla só a leitura no register, não no enqueue), e o provedor retorna erro 132001 — registrado como `erro_envio` permanente em `outbound_messages` ([ADR-0005](./0005-templates-meta-vs-mensagem-livre.md)).

## Alternativas consideradas

- **Manter `dias_lembrete_padrao` único + sem mudar template** — Descartado. Quebra a experiência do cliente em amortecedor (90 dias é cedo demais).
- **Cadência por oficina (`oficinas.dias_lembrete_por_tipo` jsonb)** — Descartado para o MVP. Adiciona complexidade no admin e no scheduler sem benefício imediato — todas as oficinas usariam os mesmos defaults. Pode virar feature futura sem mudar este ADR.
- **Template fixo por código, sem tabela** — Descartado. Mudar copy de lembrete viraria deploy. Tabela permite ajuste sem deploy depois de aprovação Meta.
- **Remover `oficinas.dias_lembrete_padrao`** — Descartado. Mantido como fallback final para preservar comportamento histórico se um tipo for desativado.

## Consequências

- **Positivas**:
  - Cadência por tipo abre o produto para além de óleo sem reescrever o scheduler depois.
  - Texto auditável em `outbound_messages.body` continua coerente com o template enviado.
  - Admin controla cadência sem precisar de PR.
- **Negativas / Risco**:
  - Mudança em `template_name` no admin **assume** que o template novo já está aprovado na Meta. Se admin trocar pra um template inválido, scheduler enfileira mas o envio falha (erro 132001). Mitigação: documentação do painel + alerta no admin (futuro).
  - `oficinas.dias_lembrete_padrao` agora é redundante para tipos cobertos na tabela — preserva-se só como fallback. Provavelmente vira `nullable` no futuro.

## Referências

- [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) — LLM apenas classifica `tipo_servico`; cadência e template são determinísticos via tabela.
- [ADR-0005](./0005-templates-meta-vs-mensagem-livre.md) — Templates aprovados pela Meta são obrigatórios fora da janela 24h.
- Migration `20260522000000_tipos_servico_default.sql`.
- `lib/admin/tipos-servico.ts`, `app/admin/(autenticado)/tipos-servico/page.tsx`.
