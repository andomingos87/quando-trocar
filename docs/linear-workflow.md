# Linear Workflow — Quando Trocar

> Este documento e a fonte canonica deste repositorio para organizar projetos, issues e triagem
> do time Linear `QUANDO TROCAR` (`QTR`) no workspace `biapps`.
>
> O plugin `aurea-linear` (skills `linear-specialist` / `linear-plan` e comandos `/linear-*`)
> le este arquivo para saber o time, os projetos e as labels deste repo. Mantenha-o atualizado.

## Identidade Linear

- **Workspace:** biapps
- **Team:** QUANDO TROCAR
- **Team key:** QTR (issues aparecem como `QTR-123`)
- **Team ID:** `4558d4bc-b788-4628-8acd-d6ca1937c69c`

## Fontes oficiais Linear

As regras operacionais abaixo devem seguir a documentacao oficial da Linear. Em caso de duvida sobre
comportamento da ferramenta, verifique primeiro estas fontes:

- Project status: https://linear.app/docs/project-status
- Delete and archive issues: https://linear.app/docs/delete-archive-issues
- Projects: https://linear.app/docs/projects
- Display options: https://linear.app/docs/display-options

Pontos oficiais relevantes:

- Projetos usam categorias de status como `Backlog`, `Planned`, `In Progress`, `Completed` e `Canceled`.
- Arquivamento de issues, ciclos e projetos e automatico, nao uma acao manual comum.
- Projetos so ficam aptos ao auto-archive quando estao fechados (`Completed` ou `Canceled`).
- Para remover um projeto imediatamente da visao, a acao documentada e `Delete project`.

## Projetos oficiais

Este repo organiza o trabalho como **um projeto por plano/modulo grande**: cada plano em
`docs/backlog-*/` vira um projeto no Linear com **milestones por fase** e **uma issue por fase**
(padrao do `/linear-plan`). Use apenas estes projetos para novas issues do time `QUANDO TROCAR`:

| Projeto | Uso |
| --- | --- |
| `Representantes` | Modulo de representantes comerciais: atribuicao de origem, comissao e portal proprio do representante (fases R0–R4). |
| `Camada Conversacional — geração de resposta com validador` | Geracao de resposta do bot por LLM com validador deterministico pre-envio (fases CV0–CV8). |

Projetos legados que NAO devem receber novas issues: nenhum — os dois acima estao ativos. Um novo
plano grande ganha o proprio projeto (crie via `/linear-plan`); issues avulsas entram no projeto do
modulo correspondente.

## Workflow de status

- `Backlog`: capturado, ainda nao triado ou exploratorio.
- `Todo`: triado, priorizado e pronto para execucao.
- `In Progress`: em execucao ativa.
- `In Review`: implementacao/investigacao concluida; aguardando validacao, deploy ou aprovacao.
- `Done`: resolvido e validado.
- `Canceled`: descartado.
- `Duplicate`: consolidado em outra issue.

Regras:

- Toda issue nova deve ter projeto.
- Toda issue nova deve ter pelo menos uma label de tipo (`Feature`, `Improvement` ou `Bug`).
- Todo bug deve ter impacto e criterio de conclusao.
- Toda feature deve ter criterio de aceite.
- Issue operacional resolvida manualmente deve registrar a acao feita antes de fechar.
- Issue em `In Progress` sem atualizacao por 3 dias uteis recebe comentario de bloqueio ou volta para `Todo`.
- Issue em `In Review` so vai para `Done` depois de validacao clara.
- Grande plano = 1 projeto com **milestones por fase** e **1 issue por fase**; a fonte do plano vive
  em `docs/backlog-*/` e cada issue linka o arquivo de origem (ex.: projeto `Representantes` ↔
  `docs/backlog-whatsapp-bot/fase-representante-portal.md`).
- Mudanca que **altera comportamento de produto** deve atualizar `docs/regras-de-negocio.md` na mesma
  entrega (exigencia do `CLAUDE.md`) — vira criterio de conclusao da issue.
- **Este repo commita direto na `main`** (dono solo; sem feature branch / PR por padrao). Consequencia:
  a automacao de status por branch/PR (abaixo) **nao dispara sozinha**. Mova o status manualmente, ou
  adote branch-por-issue (nome sugerido pelo Linear, `qtr-123-...`) quando quiser a automacao.

## Automacao de status (ciclo de desenvolvimento)

A transicao de status NAO e manual: ela acompanha o ciclo de desenvolvimento por padrao,
num modelo **hibrido** (cada parte feita por quem faz melhor):

| Evento do desenvolvimento | Transicao | Quem faz |
| --- | --- | --- |
| Comecou a trabalhar (cria a branch da issue ou 1o commit) | `Todo`/`Backlog` -> `In Progress` | **hook local** `linear-autostatus` do `aurea-linear` |
| Abriu o Pull Request | `In Progress` -> `In Review` | **integracao nativa Linear <-> GitHub** |
| Abriu o Pull Request | **mini-doc do que foi implementado** postada como comentario na issue | `/linear-pr-doc` (agente, ao abrir o PR) |
| PR aprovado / merge | `In Review` -> `Done` | **integracao nativa Linear <-> GitHub** |
| PR fechado sem merge | volta para `In Progress`/`Todo` | integracao nativa (revisar manualmente se preciso) |
| CI quebrou | sem mudar status; vira comentario/flag | manual / pipeline |

Por que hibrido: a integracao nativa do Linear so age quando ja existe branch/PR linkada
(o Linear gera o nome de branch da issue, ex.: `qtr-123-...`, em minusculas). O hook cobre o
instante "comecei a trabalhar", anterior ao PR. Avanco apenas: o hook nunca volta o status.

> ⚠️ **Neste repo o padrao e commit direto na `main`**, entao nem o hook (depende de branch
> `qtr-123-...`) nem a integracao nativa (depende de PR) disparam no fluxo atual. Ative uma das
> alternativas abaixo so se decidir adotar branch/PR por issue; caso contrario, mova o status a mao.

**Requisitos para o hook funcionar:**
- Plugin `aurea-linear` instalado (traz o hook em `hooks/`).
- Variavel de ambiente `LINEAR_API_KEY` (Personal API key do Linear). Sem ela, o hook e no-op.
  Gere em Linear > Settings > Security & access > Personal API keys. **Nunca** escreva a chave em
  arquivo do repo.
- Branch nomeada com o identificador da issue (ex.: `qtr-123-...`, em minusculas) — use o nome de
  branch que o proprio Linear sugere na issue.
- Para desligar pontualmente: `LINEAR_AUTOSTATUS=0`.

**Integracao nativa Linear <-> GitHub:** habilite em Linear > Settings > Integrations > GitHub,
conectando o repositorio. Configure o mapeamento PR aberto -> `In Review` e PR merged -> `Done`.
Doc oficial: https://linear.app/docs/github

## Prioridade

- `Urgent`: producao parada ou incorreta afetando clientes reais — bot nao recebe/responde no
  WhatsApp, cobranca/comissao gerada errada, lembrete enviado sem consentimento ou opt-out ignorado,
  ou vazamento de dados/PII.
- `High`: impacto operacional relevante ou bug recorrente.
- `Medium`: melhoria importante sem bloqueio imediato.
- `Low`: ajuste pequeno, polimento ou oportunidade futura.
- `No priority`: ideias ainda nao triadas.

## Labels recomendadas

Tipo: `Feature`, `Improvement`, `Bug` (as tres que existem hoje no time).

Dominio: nenhuma criada ainda. Sugestoes (criar sob demanda), espelhando `.context/modules/`:
`whatsapp-bot`, `painel-admin`, `billing`, `representantes`, `database`, `site-publico`.

Origem/contexto: nenhuma criada ainda. Sugestoes: `lead-real` (caso real de oficina/cliente),
`interno`.

Bloqueio/decisao: nenhuma criada ainda. Sugestoes: `bloqueado`, `aguardando-decisao`, `precisa-ADR`.

Evite criar labels com nomes de pessoas ou situacoes pontuais, exceto filtros operacionais
recorrentes e aprovados.

## Identificadores de negocio

Quando a issue envolver um caso real, inclua os identificadores do dominio deste projeto:

- `oficina_id` — a oficina (empresa cliente do produto); escopo multi-tenant.
- `lead_id` — `leads_oficina.id` (oficina que ainda nao comprou).
- `cliente_final_id` — `clientes_finais.id` (cliente da oficina que recebe lembretes).
- `representante_id` / codigo `#REP-<codigo>` — representante comercial que trouxe a oficina.
- `pagamento_id` / `mp_payment_id` / `gateway_payment_id` — cobranca; base da comissao.
- `lembrete_id` — lembrete agendado de retorno.
- `whatsapp_message_id`, `webhook_event_id` — idempotencia de mensagens/eventos.

## Templates de issue

### Bug ou incidente

```markdown
## Contexto

## Impacto

## Identificadores
oficina_id: · lead_id: · cliente_final_id: · representante_id: · pagamento_id/mp_payment_id: · whatsapp_message_id:

## Sintoma

## Causa suspeita

## Criterio de conclusao
```

### Demanda operacional

```markdown
## Solicitacao

## Caso / referencia

## Acao esperada

## Risco se nao fizer

## Criterio de conclusao
```

### Feature ou produto

```markdown
## Problema

## Objetivo

## Escopo

## Fora de escopo

## Criterios de aceite

## Impacto tecnico
```

### Debito tecnico

```markdown
## Contexto

## Problema tecnico

## Proposta

## Risco atual

## Criterios de aceite

## Verificacao esperada
```

## Gates de seguranca deste projeto

Cuidados especificos que devem virar issue/criterio quando o plano tocar areas sensiveis:

- **Migrations:** nunca editar migration ja aplicada — criar nova (`YYYYMMDDHHMMSS_descricao.sql`);
  habilitar RLS em tabela nova; escopar dado por `oficina_id`; rodar `get_advisors` do Supabase apos DDL.
- **Deploy corre na frente das migrations:** apos deploy de schema, conferir `list_migrations` vs
  arquivos (licao `.context/lessons/0002-deploy-corre-na-frente-das-migrations.md`).
- **SECURITY DEFINER:** funcoes em `public` vazam para `anon`/`authenticated` — revogar e rodar
  `get_advisors` (licao `.context/lessons/0001-security-definer-grants-vazam.md`).
- **ADR-0001 (LLM nao decide estado):** LLM nunca muda sozinho `lead.status`, `participant_type`,
  `agent_mode`, estado de pagamento, opt-out ou status de lembrete.
- **Secrets:** service-role / OpenAI / WhatsApp fora de `NEXT_PUBLIC_`; segredos de gateway no
  Supabase Vault; nunca commitar `.mcp.json`, `.env` ou `.env.local`.
- **Idempotencia:** eventos/mensagens do WhatsApp e webhooks de pagamento sao idempotentes (indices
  unicos por provider ID) — nao quebrar.
- **Webhooks:** validar assinatura/origem (Meta, Mercado Pago, ASAAS).
- **LGPD / PII:** mascarar/limitar PII de cliente final (`lib/admin/pii.ts`); nova superficie de
  acesso (ex.: portal do representante) nao expoe PII de cliente final.
- **Regras de negocio:** comportamento de produto mudou → atualizar `docs/regras-de-negocio.md` na
  mesma entrega.

## Encerramento e limpeza

- Nao prometa "arquivar manualmente" um projeto.
- Para tirar um projeto da visao sem acao destrutiva, marque como `Completed`/`Canceled` e ajuste display options.
- Para retirar imediatamente da lista, use `Delete project` ciente de que vai para `Recently deleted projects`.

## Rotina recomendada

- Triagem diaria curta para novas issues.
- Revisao semanal de `In Progress` e `In Review`.
- Revisao quinzenal de backlog.
- Encerramento mensal de issues antigas sem dono, sem proximo passo ou sem criterio.
