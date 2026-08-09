# Prospec-2 — Painel de prospecção e promoção a lead

## Objetivo

Dar uma tela à fila do Prospec-1 e fechar a ponte com o funil: aprovar um estabelecimento cria
um `leads_oficina`, que é onde o produto já sabe trabalhar.

**Nada é promovido automaticamente.** O gargalo humano é intencional: o custo de errar não é
uma linha errada no banco, é queimar a relação com uma oficina real.

## Dependências

- Prospec-1 (sem score, a lista não tem ordem útil).
- Migration soltando o `check` de `leads_oficina.origem`.

## Tarefas

### Migration

- [ ] `alter table leads_oficina drop constraint leads_oficina_origem_check;`
      recriar com `('landing_page','manual_whatsapp','prospeccao')`.
- [ ] **Atualizar `docs/regras-de-negocio.md` no mesmo commit** — nova origem de lead é mudança
      de comportamento de produto (novo caminho de entrada no funil).

### UI

- [ ] `app/admin/(autenticado)/prospeccao/page.tsx` — server component, lista ordenada por
      `score_icp desc`.
- [ ] `components/admin/prospeccao-table.tsx` (client) — colunas: nome, score, CNAE, bairro,
      telefone (com selo de celular), e-mail, porte, abertura, status.
- [ ] Filtros: cidade/UF, faixa de score, status, CNAE, "só com celular", "só com e-mail",
      busca por nome.
- [ ] Drawer de detalhe: todos os campos + `score_motivos` legível (por que esse score) + link
      para o Google Maps montado por busca de nome+endereço — **sem chamar API**, é só um link.
- [ ] Ações por linha: **Aprovar**, **Descartar** (com motivo), **Marcar duplicata**.
- [ ] Ação em lote: aprovar selecionados (com confirmação mostrando a contagem).
- [ ] Registrar em `app/admin/(autenticado)/nav-items.ts`, grupo `comercial`.

### Backend

- [ ] `lib/admin/prospeccao.ts` — consultas e mutações, padrão dos outros domínios admin.
- [ ] `app/api/admin/prospeccao/route.ts` — `GET` lista paginada com filtros.
- [ ] `app/api/admin/prospeccao/[id]/route.ts` — `PATCH` (aprovar/descartar/duplicata).
- [ ] `app/api/admin/prospeccao/promover/route.ts` — `POST`, promove um ou vários.
- [ ] Todas passam por `requireAdminApi()` e `withAdminAudit`.

### Promoção a lead

- [ ] Cria `leads_oficina` com `origem = 'prospeccao'`, `status = 'novo'`,
      `nome_oficina`, `cidade`, `whatsapp = telefone_e164`, `representante_id` opcional.
- [ ] Grava `prospeccao_estabelecimentos.lead_id` e muda `status` para `promovido`.
- [ ] **Idempotente**: linha com `lead_id` preenchido não cria segundo lead.
- [ ] **Só promove com `telefone_movel = true`.** `leads_oficina.whatsapp` tem check de E.164 e
      o funil inteiro pressupõe que dá para conversar por WhatsApp; promover um fixo cria um
      lead que o bot nunca vai conseguir atender. Sem celular, o caminho é Prospec-3 (e-mail)
      ou visita do representante.
- [ ] Antes de criar, reconferir se o telefone já existe em `leads_oficina` ou `oficinas` — a
      base pode ter mudado desde a ingestão.

### Auditoria

- `prospeccao.aprovar` — payload: id, score, versão do score.
- `prospeccao.descartar` — payload: id, motivo.
- `prospeccao.promover` — payload: id do estabelecimento, id do lead criado, representante.
- `prospeccao.duplicata` — payload: id, id do original.

## Critérios de aceite

- Admin abre `/admin/prospeccao` e vê a fila ordenada por score, com filtro por bairro.
- Aprovar cria o lead; ele aparece em `/admin/leads` com origem `prospeccao`.
- Promover o mesmo estabelecimento duas vezes não cria dois leads.
- Tentar promover sem celular é bloqueado com mensagem explicando o caminho alternativo.
- Descartar exige motivo e sai da fila.
- Toda ação gera entrada em `admin_audit_log`.

## Testes

- `tests/prospeccao-admin.test.ts` — filtros e paginação; promoção idempotente; bloqueio sem
  celular; recheck contra o funil; payloads de auditoria.
- Rodar `npm run build` (mexe em rotas e fronteira server/client).
