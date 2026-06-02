# ADR 0017: Confirmação da oficina antes de registrar a troca

- **Status**: accepted
- **Data**: 2026-06-02
- **Decisores**: Anderson Domingos
- **Fonte**: incidente real (cliente "Flaviane Marcille", serviço `40ab60ad`, 2026-05-29) + `docs/regras-de-negocio.md §3.4`
- **Estende**: [ADR-0015](./0015-suporte-audio-whisper.md) (transcrição de áudio Whisper)

## Contexto

No fluxo de onboarding/operação, assim que o draft de cadastro ficava completo (`nome_cliente`, `whatsapp_cliente`, `veiculo`, `servico`, `data_servico` e, p/ amortecedor, `marca_peca`), o agente devolvia `registerServiceInput` imediatamente. O webhook então: (1) gravava `clientes_finais`/`veiculos`/`servicos`/`lembretes` via RPC e (2) **disparava o template `confirmacao_servico` ao número do cliente final** — um número frio, fora da janela de 24h, envio irreversível ([ADR-0005](./0005-templates-meta-vs-mensagem-livre.md)).

Em 2026-05-29 uma oficina cadastrou por áudio. À pergunta "Qual é o carro do cliente?", o Whisper transcreveu o áudio como **"Não houve loucura."** (alucinação clássica em áudio curto/ruidoso). O agente aceitou essa string como `veiculo` ([onboarding-agent.ts](../../lib/whatsapp/onboarding-agent.ts) — branch de follow-up aceita qualquer texto ≥3 chars que não seja saudação/pergunta), gravou o serviço e mandou ao cliente final: *"Registramos a troca de amortecedor do seu carro: Não houve loucura."*

O [ADR-0015](./0015-suporte-audio-whisper.md) já tinha **previsto e aceito** que o Whisper erraria nomes próprios e termos automotivos, com a mitigação declarada: *"a oficina ainda pode corrigir manualmente quando a resposta do bot não bater"*. Só que essa rede de segurança **nunca foi implementada**: não havia passo de revisão antes do envio, e quando a oficina tentou corrigir o nome na sequência o agente perdeu o contexto e voltou ao prompt genérico.

## Decisão

**O cadastro vira fluxo de dois passos.** Quando o draft fica completo, o agente devolve um resumo dos dados e marca `conversas.context.awaiting_confirmation = true` — **não** grava nem dispara template. Só depois de uma resposta afirmativa da oficina o agente devolve `registerServiceInput` (registra + notifica o cliente). Qualquer resposta não-afirmativa é tratada como correção: re-extrai os campos informados via LLM, mescla sobre o draft e reapresenta o resumo para novo "sim".

## Alternativas consideradas

- **Validar só o campo `veiculo`** (rejeitar frases que não parecem carro) — Descartado: frágil. Não pegaria um carro errado mas plausível (Whisper transcrevendo "Onix" em vez de "Gol") nem erros em `nome`/`servico`. Trata o sintoma de um campo, não a classe do problema.
- **Permitir só correção pós-cadastro** (editar o serviço recém-criado) — Descartado como solução principal: o template errado já teria ido ao cliente frio antes da correção. Resolve o registro interno, não o dano externo irreversível.
- **Confiar no Whisper / melhorar transcrição** — Fora de alcance: o ADR-0015 já aceita que o Whisper erra; a decisão é construir a rede de segurança, não perseguir transcrição perfeita.
- **Confirmação só quando a captura veio de áudio** — Descartado: adiciona ramo condicional frágil e não cobre erros de parsing de texto. Confirmar sempre é mais simples e uniforme.

## Consequências

### Positivas

- A oficina vê os dados antes do envio irreversível ao cliente — pega alucinação do Whisper, parsing errado e qualquer outro lixo, não só no campo `veiculo`.
- Implementa a mitigação que o ADR-0015 assumia mas não existia.
- Correção acontece **durante** a confirmação (antes de gravar), resolvendo de quebra a perda de contexto que ocorria quando a oficina tentava corrigir após o cadastro.
- Respeita [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md): o cadastro só ocorre por ação afirmativa explícita da oficina, nunca por output do LLM sozinho.
- Mudança contida no agente (`onboarding-agent.ts` + `context.awaiting_confirmation`); o webhook não muda — continua agindo sobre `registerServiceInput`.

### Negativas / trade-offs

- Um turno a mais de conversa por cadastro (a oficina precisa responder "sim").
- A re-extração de correção é via LLM e pode errar; mitigado porque o resultado é sempre reapresentado para nova confirmação (o loop é auto-corretivo).
- A detecção de afirmação é por whitelist de tokens; uma confirmação muito fora do padrão cai no fluxo de correção e pede esclarecimento (custo: um turno extra, nunca grava errado).

## Referências

- [ADR-0015](./0015-suporte-audio-whisper.md) (origem da mitigação assumida), [ADR-0005](./0005-templates-meta-vs-mensagem-livre.md) (template irreversível ao cliente frio), [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md)
- `docs/regras-de-negocio.md §3.4`
- `lib/whatsapp/onboarding-agent.ts` (`handleConfirmation`, `confirmationReply`, `isAffirmativeConfirmation`)
- `tests/whatsapp-onboarding-agent.test.ts`, `tests/whatsapp-agent-evals/onboarding.json` (onb-008, onb-009)
