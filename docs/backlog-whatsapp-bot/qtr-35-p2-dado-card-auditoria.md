# QTR-35 · P2 — dado, card e auditoria

**Status: plano proposto (aguardando aprovação para execução).**

Plano executável para os itens **9–12** da issue
[QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no).
P0 (itens 1–3) está entregue; P1 (itens 4–8) precisa estar concluída antes dos
pacotes que reutilizam o card e os botões, em especial o P1-8.

Origem: análise das conversas `31ad24dc-f0b1-439c-852f-e11ac98cc6d0` (oficina) e
`0468d1ab-70fa-46c4-9752-8281b5f0658d` (cliente final), cruzada com
`agent_tool_calls`, `outbound_messages`, `servicos`, `lembretes` e o código em
`lib/whatsapp/`. Plano-pai:
[`fase-camada-conversacional.md`](./fase-camada-conversacional.md).

## Problema comum

O bot já toma as decisões de negócio no backend, mas parte do que ele capturou,
mostrou e enviou não fica representada fielmente no dado ou na auditoria. Isso
prejudica tanto o painel de vendas quanto a capacidade de diagnosticar uma
decisão crítica sem reproduzir uma conversa real.

```
lead informa nome da oficina ──> [9] lead guarda a identidade canônica
                                      │
cadastro é revisado ────────────> [10] card mostra mudança e alerta seguro
                                      │
resposta / botão são enviados ──> [11] auditoria reproduz ação e interface
                                      │
cliente toca a confirmação ─────> [12] contrato Meta e handoff são verdadeiros
```

## Estado atual verificado

| # | Onde | Lacuna atual |
| --- | --- | --- |
| 9 | `sales-agent.ts` + `webhook-handler.ts` | `reply.nomeOficina` e `sales.workshop_name` existem, mas o handler só os entrega a `convertLeadToOficina`; `leads_oficina.nome_oficina` e `nome_responsavel` continuam sem preenchimento no turno de captura. |
| 9 | `repository.ts:convertLeadToOficina` | A oficina nasce de `input.nomeOficina`; a conversão não lê a identidade persistida no lead, logo não tem fonte de verdade durável entre captura e conversão. |
| 10 | `onboarding-agent.ts:confirmationReply` | O card usa apenas `confirmationSummary(draft)`. Uma correção reapresenta todos os campos sem indicar quais mudaram. |
| 10 | `handleConfirmation` | A guarda P0 poda campos suspeitos na extração, mas o contexto não carrega uma explicação para a oficina e um `service_draft` legado/completo não é revalidado imediatamente antes do "sim". |
| 10 | `mergeDraftCorrection` | A mesclagem já aceita mais de um campo retornado pelo extrator, mas não existe regressão que prove uma correção múltipla real nem uma apresentação explícita dos campos alterados. |
| 11 | `webhook-handler.ts` | A tool call `update_lead` registra como `input.status` o estado anterior, embora a mutação aplicada seja `reply.status`; o registro não representa o comando executado. |
| 11 | `webhook-handler.ts` + `outbound_messages` | Ao enviar reply buttons, `body` recebe só o texto principal. Os títulos/ids das opções não ficam em uma forma auditável. |
| 12 | `service-confirmation.ts:renderServiceConfirmation` | A cópia auditada diverge do texto aprovado na Meta: fala em "tocar no botão abaixo", enquanto o template aprovado manda responder por ali. |
| 12 | `cliente-final-concierge.ts` | A documentação/código assumem CTA URL, mas o template real usa quick reply. "Chamar no whatsapp" chega como texto e cai em `mensagem_indefinida`. |

## Decisões do plano

1. **`leads_oficina.nome_oficina` é a fonte de verdade do nome da oficina enquanto
   o registro ainda é lead.** A conversão o lê do banco; `reply.nomeOficina` fica
   apenas como fallback compatível para leads antigos.
2. **O responsável não será inferido por LLM.** Ao capturar a oficina, persistir
   `nome_responsavel` a partir de `leads_oficina.nome` quando ainda não houver valor
   explícito. O nome de perfil WhatsApp (`inbound.contactName`) continua apenas
   fallback para a criação da oficina, nunca sobrescreve o nome capturado do lead.
3. **Campo suspeito não recebe um botão Confirmar.** O card poderá explicar que um
   campo foi rejeitado, mas a confirmação só aparece novamente quando o rascunho
   revalidado estiver completo e sem suspeita. Isso mantém o gate do ADR-0017.
4. **`outbound_messages.body` será uma representação humana exata da interface
   entregue.** Para botões, é o corpo seguido de uma lista determinística de opções;
   não será necessário criar DDL apenas para recuperar esse contexto.
5. **Quick reply é a correção imediata do CTA da confirmação.** O clique
   "Chamar no whatsapp" ganha intent dedicado e devolve o `wa.me` da oficina. A
   migração futura para botão URL continua fora deste recorte e dependerá de nova
   aprovação Meta.

---

## Pacote 1 — Item 9: persistir identidade do lead no turno de captura

**Arquivos prováveis:** `lib/whatsapp/types.ts`, `lib/whatsapp/repository.ts`,
`lib/whatsapp/webhook-handler.ts`, `tests/whatsapp-route-generation.test.ts`,
`tests/whatsapp-route-phase2.test.ts`.

1. Adicionar ao contrato do repositório uma operação atômica, por exemplo
   `captureLeadWorkshopIdentity({ leadId, nomeOficina })`, que atualiza:
   - `nome_oficina` com o nome validado por `extractWorkshopName`;
   - `nome_responsavel` com `nome` do lead **somente** quando `nome_responsavel`
     estiver vazio;
   - `updated_at`.
   A operação não deve trocar status, converter o lead nem alterar dados que já foram
   preenchidos manualmente.
2. No branch de vendas do handler, chamar essa operação no mesmo turno em que
   `reply.nomeOficina` é válido, antes da conversão. Persistir uma tool call
   `capture_workshop_name` com entrada e resultado efetivamente aplicados.
3. Alterar `convertLeadToOficina` para buscar `nome_oficina`, `nome_responsavel` e
   `nome` do lead. Criar a oficina com `nome_oficina` persistido e responsável
   canônico; manter `input.nomeOficina` e `inbound.contactName` apenas como fallback
   para registros legados/incompletos.
4. Não criar migration: as colunas já existem. A mudança é de escrita, contrato do
   repositório e ordem de conversão.

**Testes:**

- Captura de "Oficina Marsili" preenche `nome_oficina` e promove o nome já existente
  do lead para `nome_responsavel`, sem sobrescrever um responsável previamente salvo.
- Conversão no mesmo turno usa o valor persistido e cria `oficinas.nome` correto.
- Conversão posterior, após reinício de processo/contexto, ainda usa a identidade do
  lead, não o texto transitório da resposta.
- Falha da persistência impede a conversão silenciosa: a exceção é tratada pelo
  processamento normal do webhook e não produz oficina parcialmente identificada.

**Critério do pacote:** painel de vendas e conversão mostram o mesmo nome de oficina
e responsável, com origem rastreável no turno de captura.

## Pacote 2 — Item 10: tornar o card de confirmação informativo e seguro

**Dependência:** concluir e estabilizar P1-8 (botões `Confirmar`/`Corrigir`) antes de
alterar este pacote, para não haver duas implementações concorrentes do card.

**Arquivos prováveis:** `lib/whatsapp/onboarding-agent.ts`,
`lib/whatsapp/types.ts`, `lib/whatsapp/payload.ts` (somente se o mapa de ids P1-8
não estiver concluído), `lib/whatsapp/webhook-handler.ts`,
`tests/whatsapp-onboarding-agent.test.ts`, `tests/whatsapp-route-phase2.test.ts`,
`tests/whatsapp-payload-audio.test.ts`.

1. Evoluir o estado transitório do rascunho com metadados de apresentação seguros:
   `changed_fields` (enum fechado dos campos de cadastro) e `suspect_fields`
   (campo + motivo controlado, sem repetir a fala ruim). Esses metadados vivem em
   `ConversationContext`, são substituídos a cada revisão e não chegam a
   `servicos`/templates.
2. Fazer `confirmationReply` receber os metadados e exibir, depois do resumo:
   - `Atualizado: Cliente, carro` quando uma correção de fato alterou esses valores;
   - aviso explícito e curto quando um campo foi rejeitado pela guarda, seguido da
     pergunta daquele campo, sem apresentar o rascunho como pronto.
3. Revalidar `service_draft` via `suspectDraftFields` em duas portas: ao restaurar
   contexto antes de renderizar o card e imediatamente antes de aceitar um
   "confirmar". Contexto legado/suspeito volta para campo faltante com explicação;
   nunca produz `registerServiceInput`.
4. Manter `extractCorrection` como extração estruturada parcial e tornar a correção
   múltipla um contrato explícito: normalizar, podar e mesclar **todos** os campos
   não vazios retornados. A comparação que popula `changed_fields` deve usar o
   rascunho normalizado, para não marcar apenas mudança de caixa/espaço.
5. Reusar os dois quick replies da P1-8. Com ou sem suporte a botões, os mesmos
   dados, guarda e transições são aplicados; a diferença fica restrita à ergonomia.

**Testes:**

- Card inicial completo contém `Confirmar`/`Corrigir` e não altera estado ao ser
  apenas exibido.
- `nome é Leonardo Viana e o carro é BMW` altera os dois campos em uma rodada,
  reapresenta o card uma vez e destaca ambos; o próximo `confirmar` registra o
  rascunho corrigido.
- Correção com veículo/serviço suspeito mostra aviso e pergunta o campo; não mostra
  botão de confirmação nem aceita um `sim` subsequente sem nova resposta válida.
- Contexto completo legado com campo suspeito não chega ao RPC.
- Clique e texto canônico de cada botão preservam o mesmo estado e as mesmas tool
  calls (ADR-0024).

**Critério do pacote:** cada reapresentação informa o que mudou, várias correções
cabem na mesma mensagem e nenhum campo que falhe a guarda chega à confirmação final.

## Pacote 3 — Item 11: registrar o que realmente aconteceu

**Arquivos prováveis:** `lib/whatsapp/webhook-handler.ts`,
`lib/whatsapp/types.ts`, `lib/whatsapp/repository.ts`,
`tests/whatsapp-route-generation.test.ts`, `tests/whatsapp-route-phase2.test.ts`.

1. Corrigir `update_lead`: após `updateLeadStatus` concluir, registrar como entrada
   o payload aplicado (`{ status: reply.status }`) e como saída uma transição
   inequívoca, por exemplo `{ applied: true, previousStatus: leadStatus,
   currentStatus: reply.status }`. A tool call só é gravada depois da mutação bem
   sucedida.
2. Centralizar uma função determinística de auditoria de interface interativa:
   `renderInteractiveAuditBody(body, buttons)` devolve o corpo enviado seguido de
   `Opções: <título 1> | <título 2> | ...`. Os títulos devem ser sanitizados e vir
   do mesmo array entregue à Cloud API.
3. Usar a representação acima apenas em `outbound_messages.body` para mensagens
   interativas. O payload da Meta e a linha em `mensagens` continuam preservando o
   corpo real do transporte; assim o histórico técnico e o painel conseguem explicar
   tanto o texto quanto as ações disponíveis.
4. Não reduzir os logs atuais de geração: manter no `reply_generation` a resposta
   reprovada e o motivo `cross_tenant`, pois esse é o artefato que permite investigar
   bloqueios sem expor uma saída ao usuário.

**Testes:**

- Transição `em_conversa → teste_aceito` audita exatamente o status aplicado e o
  anterior, nunca inverte entrada/saída.
- Fallback, explicador e card com botões persistem as opções na ordem mostrada.
- Sem suporte a botão, o `body` auditado é somente a degradação textual efetivamente
  enviada.
- Uma geração reprovada por `cross_tenant` continua registrando o texto rejeitado e
  não o envia.

**Critério do pacote:** uma pessoa no painel consegue reconstruir a transição de
estado e todas as escolhas oferecidas ao usuário sem consultar logs do provedor.

## Pacote 4 — Item 12: alinhar template aprovado, auditoria e CTA real

**Arquivos prováveis:** `lib/whatsapp/service-confirmation.ts`,
`lib/whatsapp/webhook-handler.ts`, `lib/whatsapp/cliente-final-concierge.ts`,
`lib/whatsapp/types.ts`, `tests/whatsapp-service-confirmation.test.ts`,
`tests/whatsapp-client-template.test.ts`, `tests/whatsapp-cliente-final-concierge.test.ts`,
`tests/whatsapp-route-phase3.test.ts`, `docs/adr/0018-cliente-final-concierge-pre-lembrete.md`.

1. Declarar em `service-confirmation.ts` o corpo aprovado como contrato único:

   ```text
   Oi {{nome}}! Aqui é da Quando Trocar 😃
   Registramos a troca de {{produto}} do seu carro: {{carro}}
   No local: {{oficina}}
   Vamos te avisar quando estiver perto da próxima troca. Se precisar de algo, é só responder por aqui.
   ```

   `renderServiceConfirmation` deve renderizar esse mesmo contrato por substituição
   controlada dos quatro parâmetros; não manter uma segunda copy manual. A lista de
   variáveis, o payload e o corpo auditado passam a ter uma única origem.
2. Adicionar teste de contrato que compara o corpo renderizado com o template aprovado
   preenchido por fixture. Qualquer mudança no template exige alterar deliberadamente
   o contrato/teste e a aprovação Meta correspondente.
3. Remover a configuração/código que tenta enviar `urlButtonParameter` para esta
   versão do template. O botão atual é quick reply; incluir componente URL em um
   template sem URL é incompatibilidade de payload, não fallback.
4. Criar intent fechado `chamar_oficina` no concierge. `"Chamar no whatsapp"` e a
   variação normalizada do título retornam a mesma resposta determinística de handoff:
   link `https://wa.me/<whatsapp_da_oficina>` quando disponível, ou instrução com o
   nome da oficina quando não houver telefone válido. Registrar reason
   `cta_confirmacao` e manter a allowlist do link.
5. Corrigir ADR-0018 e regras de negócio: nesta versão o botão **devolve quick reply
   ao bot**, que encaminha à oficina; botão URL com sufixo dinâmico é uma evolução
   futura dependente de submissão/aprovação na Meta, não parte da implantação.

**Testes:**

- Os quatro parâmetros nomeados continuam no payload na ordem contratada e o corpo
  salvo para auditoria é exatamente o texto aprovado preenchido.
- Diferença de espaço, frase ou CTA entre o contrato e `renderServiceConfirmation`
  falha no teste.
- Nenhum payload de `confirmacao_servico` inclui componente URL nesta versão.
- Quick reply `Chamar no whatsapp` classifica como `chamar_oficina`, envia/retorna o
  `wa.me` da própria oficina e não cai em `mensagem_indefinida` nem em vendas.
- Número de oficina ausente/malformado mantém handoff seguro sem inventar link.

**Critério do pacote:** o que o cliente lê na Meta, o que o painel audita e o que o
código declara são o mesmo contrato; o CTA de maior intenção leva à oficina correta.

## Documentação, validação e rollout

1. Atualizar `docs/regras-de-negocio.md`:
   - §2.1/§2.2: identidade capturada é persistida no lead e usada na conversão;
   - §3.4/§3.5: card informa mudança, aplica a guarda antes de confirmar e aceita
     correções múltiplas;
   - §3.6/§3.7: corpo aprovado e quick reply de encaminhamento;
   - §11: auditoria de transição e de botões.
2. Atualizar `.context/modules/whatsapp-bot/AGENTS.md` e o changelog de contexto com
   os contratos confirmados. Revisar/corrigir ADR-0018 como descrito no pacote 4.
3. Rodar testes focados durante cada pacote e, antes do handoff,
   `npm test`, `npm run lint` e `npm run build` (o handler e contratos server-side são
   alterados).
4. Fazer deploy do app somente após os testes. Não há migration nem Edge Function
   neste recorte. Depois do deploy, executar um teste controlado com número autorizado
   para confirmar: captura do nome, card com alteração, auditoria dos botões e CTA
   quick reply.
5. Atualizar a QTR-35 em português com escopo entregue, evidências de teste, ausência
   de migration/Edge Function e pendência externa inexistente para a opção (a). Mover
   para `In Review` após evidência factual; `Done` somente após validação explícita.

## Sequência recomendada

| Ordem | Commit sugerido | Dependência |
| --- | --- | --- |
| 1 | `Persistir identidade capturada da oficina no lead` | nenhuma |
| 2 | `Tornar card de confirmação explícito e revalidado` | P1-8 concluído |
| 3 | `Auditar transições e opções interativas fielmente` | botões P1-8 concluídos |
| 4 | `Alinhar confirmação Meta e CTA quick reply` | nenhuma |
| 5 | `Documentar regras e contrato da confirmação` | pacotes 1–4 |

Os pacotes 1 e 4 podem ser desenvolvidos em paralelo conceitualmente, mas a integração
deve respeitar a ordem acima para manter os testes de rota e a documentação coesos.

## Fora do escopo

- Reescrever `conversation-router.ts` ou mudar os invariantes dos ADRs 0001/0002.
- Tela admin para o volante de retroalimentação do item 4 da QTR-35.
- Trocar o quick reply da Meta por botão URL dinâmico; exige nova submissão e aprovação
  do template.
- Alterar schema, RLS, Edge Functions ou a cadência de lembretes.
