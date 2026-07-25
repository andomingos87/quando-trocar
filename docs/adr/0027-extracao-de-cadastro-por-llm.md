# ADR 0027: Extração de cadastro por LLM, com guarda de sanidade determinística

- **Status**: accepted
- **Data**: 2026-07-25
- **Decisores**: Anderson Domingos
- **Fonte**: [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no) — análise das conversas de teste ponta a ponta em produção (`conversas.id = 31ad24dc-f0b1-439c-852f-e11ac98cc6d0`, cadastro da Oficina Marsili em 24/07/2026).
- **Relaciona-se com**: [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) (o LLM extrai campo, não decide estado), [ADR-0017](./0017-confirmacao-antes-de-registrar-troca.md) (a confirmação da oficina segue sendo o gate), [ADR-0015](./0015-suporte-audio-whisper.md) (transcrição de áudio), [ADR-0014](./0014-cadencia-e-template-por-tipo-de-servico.md) (cadência por tipo)

## Contexto

O cadastro de troca era extraído por um **parser posicional** (`parseDeterministic`): a mensagem era quebrada por vírgula e as posições viravam campos — `parts[0]` = nome, `parts[1]` = veículo, `parts[2..]` = serviço. O LLM (`extractWithOpenAI`) só era chamado quando o parser deixava campo faltando. Esse formato (`Nome, Carro, Servico, Data, Telefone`) só existe para quem digita seguindo o exemplo que o bot ensina.

Em produção, a oficina manda áudio. E **transcrição de fala é toda vírgula**, então o parser sempre "tinha sucesso" e sempre curto-circuitava o LLM — exatamente no caso em que ele era indispensável.

O áudio da Oficina Marsili foi transcrito com fidelidade total:

> "Ó, o nome dele é Leonardo, ele tem, ele acabou de trocar um amortecedor da Perfect, ele tem uma BMW e na data de hoje."

E foi **persistido** como `clientes_finais.nome = "Ó"` (corrigido à mão depois), `veiculos.descricao = "Nome Dele É Leonardo"` e `servicos.tipo/descricao` = a frase inteira. O card de confirmação exibiu `Cliente: Ó`. Esse é o dado que alimenta o lembrete, que é o produto — e o `veiculo` vai direto para a mensagem que o cliente da oficina lê (`{{carro}}` do `confirmacao_servico`).

O problema não é o Whisper nem a normalização por campo (`normalizeNomeCliente`/`normalizeVeiculo` já existiam e fizeram o que podiam): é a **premissa** de que posição de vírgula carrega significado.

## Decisão

**Inverter a ordem: o LLM passa a ser o extrator primário; o parser posicional é fallback.** E, porque o extrator primário passa a ser não-determinístico, adicionar uma **guarda de sanidade determinística depois dele**.

1. **LLM primeiro, sempre** que há sinal de cadastro. O prompt de extração carrega o contrato de dados real (`nome_cliente`, `whatsapp_cliente`, `veiculo` só marca/modelo, `servico` descrição curta, `data_servico`, `tipo_servico`, `marca_peca`, `valor`, `consentimento_whatsapp`), a data de hoje, e a informação de que o texto pode ser transcrição. Schema `strict: true`, como já era.
2. **Parser posicional é fallback** — sem `OPENAI_API_KEY`, erro de API ou timeout — e **nunca roda em texto vindo de áudio**. Em áudio, o caminho determinístico contribui só com o que não depende de posição (`parseNonPositional`: telefone, data, marca, consentimento).
3. **A `data_servico` continua determinística.** `parseBrazilianDate(message, today)` prevalece sobre a data do LLM, que não tem referência temporal confiável ("na data de hoje"). Data errada não é campo feio: é lembrete agendado no ano errado.
4. **Merge que não apaga campo bom** (`mergeDrafts`). O spread cru (`{ ...base, ...ai }`) zerava campo, porque a extração devolve `undefined` para o que o modelo não encontrou — uma extração parcial apagava o que já estava certo. Só valor não-vazio sobrescreve. `consentimento_whatsapp` só se move na direção segura (`false` ganha).
5. **Guarda de sanidade** (`suspectDraftFields`), rodando depois da extração e antes de o rascunho ser aceito, nas três portas de captura (extração, follow-up, correção na confirmação):
   - `nome_cliente` — muleta de fala, rótulo, contaminação de outro campo;
   - `veiculo` — frase, > 40 chars, > 6 tokens;
   - `servico` — > 60 chars ou verbo conjugado de fala;
   - `data_servico` — não-ISO ou > 366 dias de distância (erro de ordem de grandeza).

   Campo reprovado **sai do rascunho e volta a ser perguntado**. Auditado em `extracao_suspeita`, com os valores descartados. Reprovar `servico` derruba o `tipo_servico` derivado dele, para não agendar com a cadência de um serviço que foi corrigido.
6. **`normalizeServico`** guarda a descrição curta, aparando o embrulho de fala nas pontas ("ele acabou de trocar um amortecedor da Perfect" → "amortecedor da Perfect"), nunca o miolo.
7. **Origem da mensagem chega ao agente** (`sourceMediaType`) e vai à tool call `solicitou_confirmacao_cadastro`, para medir acerto de extração por origem (digitado vs. transcrição).

## Por que isto não viola a ADR-0001

A ADR-0001 proíbe o LLM **decidir estado**: `lead.status`, `participant_type`, `agent_mode`, pagamento, opt-out, status de lembrete. Aqui o LLM **extrai campos de um rascunho** — que é dado de entrada, não transição de estado.

As três travas continuam de pé, e uma foi reforçada:

- **O gate é humano** (ADR-0017): nada é gravado nem enviado antes do "sim" explícito da oficina, sobre um card que mostra os campos exatos.
- **A validação do enum é do backend**: `tipo_servico` e `marca_peca` são validados no RPC, que rejeita valor fora da lista.
- **A cadência é do banco** (ADR-0014): quantos dias até o lembrete não passa pelo LLM.
- **Novo**: a guarda de sanidade determinística é uma trava que o caminho anterior **não tinha** — o parser podia gravar `"Ó"` sem ninguém reclamar.

O saldo é uma extração mais permissiva na entrada e mais restritiva na aceitação.

## Alternativas consideradas

- **Manter o parser primeiro e melhorar as heurísticas de fala** — Descartado. Já era a terceira rodada de heurísticas em cima do mesmo parser (`normalizeNomeCliente`, `normalizeVeiculo`, `cleanServiceText`). A premissa errada é a posição da vírgula; nenhuma heurística conserta isso, e o custo de errar é dado corrompido no produto.
- **Detectar o formato e escolher o extrator** (vírgulas bem-formadas → parser; senão → LLM) — Descartado. É exatamente o heurístico que falhou: a transcrição do caso real *parecia* bem-formada (5 vírgulas).
- **Só bloquear na saída (sanitizar o template) e deixar a extração como estava** — Descartado como solução única. Protege o cliente final, mas o dado continua corrompido no banco, e é ele que alimenta o lembrete. As duas coisas foram feitas; esta ADR é a da entrada.
- **Ler os rótulos de `tipos_servico_default.label` para o `{{produto}}` do template** — Descartado: campo editável no admin não pode virar parâmetro de template (hoje vale `"Revisao"`, sem acento). Mapa fechado no código, exaustivo por `TipoServico`.
- **Aceitar a data do LLM quando ele devolver ISO** — Descartado: foi assim que apareceu `2028-07-23`. O parser determinístico é a autoridade; a data do modelo só entra quando o parser não achou nada, e ainda passa pela janela de sanidade.

## Consequências

### Positivas

- Áudio — o canal que a oficina realmente usa — passa a produzir dado limpo em vez de dado corrompido.
- A guarda de sanidade é uma rede que vale para **qualquer** extrator futuro, inclusive um modelo pior ou um prompt regredido.
- O log `extracao_suspeita` dá visibilidade sobre o que a extração está errando, por origem de mídia — insumo para tunar o prompt sem adivinhar.
- Campo suspeito virar pergunta é uma degradação honesta: o bot pergunta em vez de gravar errado.

### Negativas / trade-offs

- **Uma chamada OpenAI a mais** por turno com sinal de cadastro (antes o caminho por vírgulas curto-circuitava). É `gpt-4o-mini` com schema `strict`, no mesmo turno que já chama transcrição — mas é custo e latência novos.
- **Dependência de disponibilidade da OpenAI** no caminho principal do cadastro. Mitigado pelo fallback determinístico, que em áudio degrada para "o bot pergunta campo por campo" em vez de gravar errado.
- **A guarda pode reprovar dado legítimo** (nome muito curto, veículo com nome incomum). O custo é um turno a mais de pergunta; o custo do oposto é dado corrompido no produto. Limites e listas ficam num só lugar (`suspectDraftFields`) para serem afinados com o log.
- Fica um **segundo caminho de extração** para manter (LLM + fallback). Aceito: o fallback é o código que já existia e está coberto por teste.

## Referências

- [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no) — issue de origem, com o rastro em `agent_tool_calls`.
- Plano de execução: [`docs/backlog-whatsapp-bot/qtr-35-p0-qualidade-cadastro.md`](../backlog-whatsapp-bot/qtr-35-p0-qualidade-cadastro.md).
- Regras de negócio: [§3.2](../regras-de-negocio.md) (campos e extração), [§3.6](../regras-de-negocio.md) (confirmação ao cliente), [§4.1](../regras-de-negocio.md) (cadência e data informada).
- Código: `lib/whatsapp/onboarding-agent.ts` (`extractDraft`, `mergeDrafts`, `suspectDraftFields`, `normalizeServico`), `lib/whatsapp/service-confirmation.ts` (barreira de saída), `lib/whatsapp/webhook-handler.ts` (`sourceMediaType`, ack de cadastro).
- Testes: `tests/whatsapp-onboarding-agent.test.ts` (transcrição literal do caso real), `tests/whatsapp-service-confirmation.test.ts`, `tests/whatsapp-agent-evals/onboarding.json` (`onb-010`).
