# Fase 2 - Conversao e onboarding

## Objetivo

Converter um lead interessado em oficina em teste e permitir que a oficina registre a primeira troca pelo WhatsApp, criando cliente final, veiculo, servico e lembrete.

## Escopo

Inclui:

- Conversao de `lead_oficina` para `oficina_cliente`.
- Criacao de registro em `oficinas`.
- Mudanca de `agent_mode` para `onboarding`.
- Instrucao de cadastro da primeira troca.
- Extracao estruturada de dados de troca.
- Perguntas de follow-up quando faltar dado obrigatorio.
- Criacao de cliente final, veiculo, servico e lembrete.
- Mudanca para `agent_mode = operacao` apos o primeiro registro bem-sucedido.

Nao inclui:

- Envio real do lembrete ao cliente final.
- Scheduler diario.
- Dashboard completo.
- Confirmacao real de agenda.
- Importacao de planilhas.

## Dependencias

- Fase 1 concluida.
- Lead com status `interessado` ou `teste_aceito`.
- Schema inicial com tabelas de lead, conversa e mensagens.
- Prompt de agente vendedor separado do prompt de onboarding.

## Dados

Tabelas novas ou ampliadas:

- `oficinas`
- `oficina_members`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`

Campos importantes:

```text
oficinas.status = ativa
oficinas.plano = teste
oficinas.origem = landing_whatsapp
clientes_finais.consentimento_whatsapp
lembretes.status = pendente
lembretes.scheduled_at = servicos.data_servico + 90 dias
```

## Tarefas tecnicas

- [ ] Criar tabelas `oficinas`, `oficina_members`, `clientes_finais`, `veiculos`, `servicos` e `lembretes`.
- [ ] Criar indices por `oficina_id` e telefone do cliente final.
- [ ] Criar unique index em `clientes_finais (oficina_id, whatsapp)`.
- [ ] Criar ferramenta `create_oficina`.
- [ ] Criar ferramenta `get_oficina_by_whatsapp`.
- [ ] Criar ferramenta `create_cliente_final`.
- [ ] Criar ferramenta `create_servico`.
- [ ] Criar ferramenta `create_lembrete`.
- [ ] Implementar transicao de lead convertido para oficina.
- [ ] Atualizar `leads_oficina.converted_at` e `leads_oficina.oficina_id`.
- [ ] Atualizar conversa para `participant_type = oficina_cliente`.
- [ ] Implementar prompt de onboarding.
- [ ] Criar schema estruturado para extracao de troca.
- [ ] Implementar validacao de campos obrigatorios.
- [ ] Implementar perguntas de follow-up para dado faltante.
- [ ] Criar transacao para inserir cliente, veiculo, servico e lembrete juntos.
- [ ] Enviar confirmacao de cadastro da primeira troca.
- [ ] Atualizar `agent_mode = operacao` depois do primeiro sucesso.

## Regras do agente

Dados obrigatorios para registrar troca:

- Nome do cliente final.
- WhatsApp do cliente final.
- Veiculo.
- Servico.
- Data do servico.

Quando faltar dado:

- Faltou WhatsApp: perguntar somente pelo WhatsApp.
- Faltou veiculo: perguntar somente qual e o carro.
- Faltou servico: perguntar se foi troca de oleo ou outro servico.
- Faltou data: assumir hoje somente quando a mensagem indicar "hoje"; caso contrario, perguntar a data.

Regra de agendamento:

- Default de lembrete: `data_servico + 90 dias`.
- O lembrete nasce como `pendente`.
- Nao criar lembrete sem consentimento quando `consentimento_whatsapp = false`.

## Criterios de aceite

- Dado um lead que aceita testar e informa dados minimos, o sistema cria uma oficina ativa em modo teste.
- Dado uma oficina ativa enviando "Joao, Civic 2018, troca de oleo hoje, 41999990000", o sistema cria cliente final, veiculo, servico e lembrete.
- Dado uma mensagem sem WhatsApp do cliente, o agente pede apenas o WhatsApp.
- Dado uma primeira troca cadastrada com sucesso, a conversa muda para `agent_mode = operacao`.
- Dado cliente ja existente pelo telefone na mesma oficina, o sistema reutiliza o cliente e cria novo servico/lembrete.

## Testes recomendados

- Teste de conversao de lead em oficina.
- Teste transacional de criacao de cliente, veiculo, servico e lembrete.
- Teste de deduplicacao de cliente por telefone dentro da oficina.
- Teste de extracao estruturada para mensagens de troca.
- Teste de follow-up para cada campo obrigatorio faltante.
- Teste de calculo de `scheduled_at`.

## Riscos

- Cadastro incompleto gerar lembrete invalido.
- Mesmo cliente ser criado duplicado por variacao de telefone.
- Agente assumir data errada quando a mensagem for ambigua.
- Oficina confundir o formato de cadastro no primeiro uso.

## Saida esperada

Ao final da fase, uma oficina convertida consegue registrar uma troca pelo WhatsApp e o sistema cria automaticamente a base operacional para lembrar esse cliente no futuro.
